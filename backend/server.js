require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const {
    checkDatabaseConnection,
    insertFeedback,
    listFeedback,
    listRestaurants: listDatabaseRestaurants,
    findRestaurant: findDatabaseRestaurant
} = require('./db');
const { searchPlaces: searchFoursquarePlaces, getPlace: getFoursquarePlace, resolveSearchQuery } = require('./foursquare');
const { searchPlaces: searchOsmPlaces, getPlace: getOsmPlace } = require('./osm');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_PROVIDER = process.env.PLACE_PROVIDER === 'foursquare' ? 'foursquare' : 'osm';
const FEEDBACK_ADMIN_TOKEN = process.env.FEEDBACK_ADMIN_TOKEN || '';
const FEEDBACK_TYPES = [
    'General Feedback',
    'Bug Report',
    'Restaurant Information',
    'Suggestion',
    'UI/UX',
    'Other'
];
const searchProviders = {
    osm: searchOsmPlaces,
    foursquare: searchFoursquarePlaces
};

const feedbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many feedback submissions. Please try again later.' }
});

const discoveryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many location searches. Please slow down and try again soon.' }
});

function sanitizeText(value, { maxLength = 1000, allowEmpty = true } = {}) {
    const stringValue = typeof value === 'string' ? value : String(value ?? '');
    const normalized = stringValue.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    if (!normalized && allowEmpty) return '';
    return normalized.slice(0, maxLength);
}

app.disable('x-powered-by');
app.use(cors());
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https://nominatim.openstreetmap.org https://overpass-api.de https://places-api.foursquare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';");
    next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/api/feedback', feedbackLimiter);
app.use('/api/restaurants/search', discoveryLimiter);
app.use('/api/restaurants/suggestions', discoveryLimiter);

const dataPath = path.join(__dirname, '../js/data/restaurant.json');
const publicDir = path.join(__dirname, "..");

function loadRestaurants() {
    try {
        const raw = fs.readFileSync(dataPath, 'utf8');
        const restaurants = JSON.parse(raw);
        return Array.isArray(restaurants) ? restaurants : [];
    } catch (error) {
        console.error('Error reading restaurant data:', error);
        return [];
    }
}

// ===== Test route (early, to confirm server works) =====
app.get('/test', (req, res) => {
    res.send('Server is alive!');
});

app.get('/api/health/database', async (req, res) => {
    const result = await checkDatabaseConnection();
    if (!result.connected) {
        return res.status(503).json({
            status: 'unavailable',
            database: 'postgresql',
            reason: result.reason
        });
    }

    return res.json({
        status: 'ok',
        database: 'postgresql'
    });
});

app.use((error, req, res, next) => {
    if (error && error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Malformed JSON request.' });
    }
    if (error && error.status) {
        return res.status(error.status).json({ error: error.message || 'Request failed.' });
    }
    console.error('Unhandled server error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

// ===== Feedback =====
app.post('/api/feedback', async (req, res) => {
    try {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        const type = sanitizeText(payload.type, { maxLength: 80 });
        const name = sanitizeText(payload.name, { maxLength: 100, allowEmpty: true });
        const email = sanitizeText(payload.email, { maxLength: 255, allowEmpty: true });
        const message = sanitizeText(payload.message, { maxLength: 2000, allowEmpty: false });

        if (!type || !FEEDBACK_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Please select a valid feedback type.' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Feedback message is required.' });
        }

        if (message.length < 10 || message.length > 2000) {
            return res.status(400).json({ error: 'Feedback message must be between 10 and 2000 characters.' });
        }

        if (name && name.length > 100) {
            return res.status(400).json({ error: 'Name must be under 100 characters.' });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }

        const feedbackEntry = {
            type,
            name: name || 'Anonymous',
            email: email || '',
            message
        };

        const savedFeedback = await insertFeedback(feedbackEntry);

        return res.status(201).json({
            message: 'Feedback submitted successfully.',
            id: String(savedFeedback.id)
        });
    } catch (error) {
        console.error('Feedback submission error:', error);
        return res.status(503).json({
            error: 'Unable to save feedback right now. Please try again later.'
        });
    }
});

app.get('/api/feedback', async (req, res) => {
    if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'token')) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }
    if (!FEEDBACK_ADMIN_TOKEN) {
        return res.status(503).json({ error: 'Feedback administration is not configured.' });
    }
    if (req.get('x-admin-token') !== FEEDBACK_ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }

    try {
        const feedback = await listFeedback();
        return res.json(feedback);
    } catch (error) {
        console.error('Feedback retrieval error:', error);
        return res.status(503).json({
            error: 'Feedback storage is temporarily unavailable.'
        });
    }
});

// ===== Local restaurants =====
app.get('/api/restaurants', async (req, res) => {
    const category = String(req.query.category || "").trim();
    const search = String(req.query.search || "").trim();

    try {
        return res.json(await listDatabaseRestaurants({ category, search }));
    } catch (error) {
        console.warn('Database restaurant read unavailable, using JSON seed:', error.message);
        let filtered = loadRestaurants();
        if (category) {
            const cat = category.toLowerCase();
            filtered = filtered.filter(r => (r.category || '').trim().toLowerCase() === cat);
        }
        if (search) {
            const term = search.toLowerCase();
            filtered = filtered.filter(r => (r.name || '').toLowerCase().includes(term));
        }
        return res.json(filtered);
    }
});

// ===== External place search – MUST come before /:id =====
app.get('/api/restaurants/search', async (req, res) => {
    try {
        const { radius, search, query, category, limit, openNow } = req.query;
        const near = String(req.query.near || "").trim();
        const ll = String(req.query.ll || "").trim();
        const provider = String(req.query.provider || DEFAULT_PROVIDER).trim().toLowerCase();
        const searchPlaces = searchProviders[provider];
        if (!searchPlaces) {
            return res.status(400).json({
                error: `Unsupported place provider "${provider}". Use "osm" or "foursquare".`,
                provider
            });
        }

        const searchTerm = provider === 'foursquare'
            ? resolveSearchQuery(search || query, category)
            : search || query || category || "restaurant";
        const parsedRadius = Number.parseInt(radius, 10);
        const parsedLimit = Number.parseInt(limit, 10);
        const searchParams = {
            near: near || undefined,
            ll: ll || undefined,
            radius: Number.isFinite(parsedRadius) ? Math.min(Math.max(parsedRadius, 100), 10000) : 1500,
            limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20,
            query: searchTerm,
            openNow: openNow === 'true'
        };

        if (!searchParams.near && !searchParams.ll) {
            return res.status(400).json({
                error: 'Missing location parameter. Provide either "near" (city) or "ll" (lat,lng).'
            });
        }

        const results = await searchPlaces(searchParams);
        res.json(results);
    } catch (error) {
        const provider = String(req.query.provider || DEFAULT_PROVIDER).trim().toLowerCase();
        console.error(`${provider} search error:`, error);
        res.status(error.status || 500).json({
            error: error.message || 'Failed to search places',
            provider
        });
    }
});

// ===== Provider-backed autocomplete =====
app.get('/api/restaurants/suggestions', async (req, res) => {
    try {
        const provider = String(req.query.provider || DEFAULT_PROVIDER).trim().toLowerCase();
        const near = String(req.query.near || '').trim();
        const query = String(req.query.query || req.query.search || '').trim();
        const searchPlaces = searchProviders[provider];

        if (!searchPlaces) {
            return res.status(400).json({
                error: `Unsupported place provider "${provider}". Use "osm" or "foursquare".`,
                provider
            });
        }
        if (!near) {
            return res.status(400).json({ error: 'Missing location parameter.', provider });
        }
        if (query.length < 2) return res.json([]);

        const searchTerm = provider === 'foursquare'
            ? resolveSearchQuery(query)
            : query;
        const results = await searchPlaces({ near, query: searchTerm, limit: 6, radius: 5000 });
        res.json(results.slice(0, 6));
    } catch (error) {
        const provider = String(req.query.provider || DEFAULT_PROVIDER).trim().toLowerCase();
        console.error(`${provider} suggestion error:`, error);
        res.status(error.status || 500).json({
            error: error.message || 'Failed to load suggestions',
            provider
        });
    }
});

// ===== OSM place details =====
app.get('/api/osm/places/:osmPlaceId', async (req, res) => {
    try {
        const place = await getOsmPlace(req.params.osmPlaceId);
        res.json(place);
    } catch (error) {
        console.error('OSM place detail error:', error);
        res.status(error.status || 500).json({
            error: error.message || 'Failed to load place details',
            source: 'osm'
        });
    }
});

// ===== Foursquare place details (retained for a future provider switch) =====
app.get('/api/foursquare/places/:fsqPlaceId', async (req, res) => {
    try {
        const place = await getFoursquarePlace(req.params.fsqPlaceId);
        res.json(place);
    } catch (error) {
        console.error('Foursquare place detail error:', error);
        res.status(error.status || 500).json({
            error: error.message || 'Failed to load place details',
            source: 'foursquare'
        });
    }
});

// ===== Single restaurant by ID =====
app.get('/api/restaurants/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    let restaurant;
    try {
        restaurant = await findDatabaseRestaurant(id);
    } catch (error) {
        console.warn('Database restaurant detail unavailable, using JSON seed:', error.message);
        const restaurants = loadRestaurants();
        restaurant = restaurants.find(r => r.id === id);
    }

    if (restaurant) {
        res.json(restaurant);
    } else {
        res.status(404).json({ error: 'Restaurant not found' });
    }
});

// ===== Static frontend files =====
app.use((req, res, next) => {
    const blockedPath = req.path === '/.env'
        || req.path === '/package.json'
        || req.path === '/package-lock.json'
        || req.path === '/backend'
        || req.path.startsWith('/backend/');
    if (blockedPath) return res.sendStatus(404);
    next();
});
app.use(express.static(publicDir));

// ===== Fallback to index.html for root =====
app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

// ===== Start server =====
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📡 Local API: http://localhost:${PORT}/api/restaurants`);
        console.log(`🌍 ${DEFAULT_PROVIDER} search: http://localhost:${PORT}/api/restaurants/search?provider=${DEFAULT_PROVIDER}&near=Peshawar`);
    });
}

module.exports = app;
