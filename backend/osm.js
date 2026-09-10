const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";
const GEOCODE_CACHE_TTL = 24 * 60 * 60 * 1000;
const geocodeCache = new Map();

// Helper to create standardized errors
function createError(message, status = 500) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function toCoordinates(ll) {
    const [lat, lng] = String(ll || "").split(",").map(value => Number(value.trim()));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw createError('Invalid "ll" value. Expected format "lat,lng".', 400);
    }
    return { lat, lng, city: "" };
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        ...options,
        headers: {
            Accept: "application/json",
            "User-Agent": "HungerHuntApp/2.0 (contact@yourdomain.com)",
            ...options.headers
        }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw createError(body.error || body.message || `OSM service error ${response.status}`, response.status);
    }
    return body;
}

async function geocodeLocation(near) {
    const location = String(near || "").trim();
    if (!location) throw createError("A city or area name is required.", 400);

    const cacheKey = location.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < GEOCODE_CACHE_TTL) return cached.value;

    const params = new URLSearchParams({
        q: location,
        format: "jsonv2",
        limit: "1"
    });

    const results = await requestJson(`${NOMINATIM_BASE}/search?${params.toString()}`);
    const result = Array.isArray(results) ? results[0] : null;
    if (!result) throw createError(`Could not find location matching "${location}".`, 404);

    const value = {
        lat: Number(result.lat),
        lng: Number(result.lon),
        city: result.display_name ? result.display_name.split(",")[0] : location
    };

    if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) {
        throw createError("Location did not return valid coordinate data.", 502);
    }

    geocodeCache.set(cacheKey, { createdAt: Date.now(), value });
    return value;
}

function coordinatesFor(element) {
    if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
        return { lat: element.lat, lng: element.lon };
    }
    if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) {
        return { lat: element.center.lat, lng: element.center.lon };
    }
    return null;
}

function formatCategory(amenity) {
    const categories = {
        cafe: "Cafe",
        fast_food: "Fast Food",
        food_court: "Food Court",
        restaurant: "Restaurant",
        pub: "Pub",
        bar: "Bar",
        bakery: "Bakery",
        ice_cream: "Ice Cream"
    };
    return categories[amenity] || "Restaurant";
}

function formatAddress(tags) {
    if (tags["addr:full"]) return tags["addr:full"];
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    return [street, tags["addr:suburb"]].filter(Boolean).join(", ") || "Address not listed";
}

// Extracts direct images (JPEG, PNG, WebP) while filtering out web pages
function directImageUrl(image) {
    const value = String(image || "").trim();
    if (/^https?:\/\/.*\.(jpeg|jpg|png|webp|svg)/i.test(value)) {
        return value;
    }
    return ""; // Fallback will be handled on front-end
}

function mapElement(element, fallbackCity = "") {
    const tags = element.tags || {};
    const coordinates = coordinatesFor(element);
    const osmPlaceId = `${element.type}/${element.id}`;

    return {
        id: osmPlaceId,
        providerId: osmPlaceId,
        name: tags.name || "Unnamed Place",
        category: formatCategory(tags.amenity),
        cuisine: tags.cuisine ? tags.cuisine.replace(/;/g, ", ") : "General Cuisine",
        city: tags["addr:city"] || fallbackCity,
        address: formatAddress(tags),
        phone: tags.phone || tags["contact:phone"] || "",
        image: directImageUrl(tags.image),
        coordinates: coordinates,
        location: coordinates ? `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}` : "",
        openingHours: tags.opening_hours || "",
        website: tags.website || tags["contact:website"] || "",
        source: "osm",
        osmPlaceId
    };
}

function hasUsableName(element) {
    return Boolean(String(element.tags?.name || "").trim());
}

function matchesSearch(place, query) {
    const term = String(query || "").trim().toLowerCase();
    if (!term || term === "restaurant") return true;
    return [place.name, place.category, place.cuisine]
        .some(value => String(value || "").toLowerCase().includes(term));
}

async function queryOverpass(query) {
    const body = new URLSearchParams({ data: query });
    const response = await fetch(OVERPASS_BASE, {
        signal: AbortSignal.timeout(20000),
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "HungerHuntApp/2.0 (contact@yourdomain.com)"
        },
        body
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw createError(result.remark || `Overpass error ${response.status}`, response.status);
    }
    return Array.isArray(result.elements) ? result.elements : [];
}

async function searchPlaces({ near, ll, radius, limit, query }) {
    const location = ll ? toCoordinates(ll) : await geocodeLocation(near);
    const searchRadius = Math.min(Math.max(Number(radius) || 2000, 100), 10000);
    const resultLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

    // Filter server-side in Overpass QL if a query is provided to reduce data payload size
    const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"~"^(restaurant|cafe|fast_food|food_court|pub|bar|bakery|ice_cream)$"](around:${searchRadius},${location.lat},${location.lng});
          way["amenity"~"^(restaurant|cafe|fast_food|food_court|pub|bar|bakery|ice_cream)$"](around:${searchRadius},${location.lat},${location.lng});
        );
        out body center tags;
    `;

    const elements = await queryOverpass(overpassQuery);

    return elements
        .filter(hasUsableName)
        .map(element => mapElement(element, location.city))
        .filter(place => matchesSearch(place, query))
        .slice(0, resultLimit);
}

async function getPlace(osmPlaceId) {
    const match = /^((?:node|way|relation))\/(\d+)$/.exec(String(osmPlaceId || "").trim());
    if (!match) throw createError("Invalid OSM place ID string format.", 400);

    const [, type, id] = match;
    const elements = await queryOverpass(`[out:json][timeout:25];\n${type}(${id});\nout body center tags;`);
    if (!elements[0]) throw createError("OSM place details not found.", 404);
    
    return mapElement(elements[0]);
}

module.exports = {
    searchPlaces,
    getPlace
};