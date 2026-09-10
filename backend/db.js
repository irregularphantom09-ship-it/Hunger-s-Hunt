const { Pool } = require('pg');

let pool;

function getPool() {
    if (!process.env.DATABASE_URL) return null;

    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
        });
    }

    return pool;
}

async function checkDatabaseConnection() {
    const database = getPool();
    if (!database) {
        return {
            connected: false,
            reason: 'DATABASE_URL is not configured.'
        };
    }

    try {
        await database.query('SELECT 1');
        return { connected: true };
    } catch (error) {
        console.error('Database health check failed:', error.message);
        return {
            connected: false,
            reason: 'Database connection failed.'
        };
    }
}

async function insertFeedback(feedback) {
    const database = getPool();
    if (!database) throw new Error('DATABASE_URL is not configured.');

    const result = await database.query(
        `INSERT INTO feedback (type, name, email, message)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [feedback.type, feedback.name, feedback.email, feedback.message]
    );

    return result.rows[0];
}

async function listFeedback() {
    const database = getPool();
    if (!database) throw new Error('DATABASE_URL is not configured.');

    const result = await database.query(
        `SELECT id, type, name, email, message, created_at AS "createdAt"
         FROM feedback
         ORDER BY created_at DESC`
    );

    return result.rows;
}

async function upsertRestaurants(restaurants) {
    const database = getPool();
    if (!database) throw new Error('DATABASE_URL is not configured.');

    const client = await database.connect();
    try {
        await client.query('BEGIN');
        for (const restaurant of restaurants) {
            await client.query(
                `INSERT INTO restaurants (
                    name, category, cuisine, city, address, phone, image, location,
                    service_rating, taste_price_rating, description, featured, popular,
                    provider, provider_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (provider, provider_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    cuisine = EXCLUDED.cuisine,
                    city = EXCLUDED.city,
                    address = EXCLUDED.address,
                    phone = EXCLUDED.phone,
                    image = EXCLUDED.image,
                    location = EXCLUDED.location,
                    service_rating = EXCLUDED.service_rating,
                    taste_price_rating = EXCLUDED.taste_price_rating,
                    description = EXCLUDED.description,
                    featured = EXCLUDED.featured,
                    popular = EXCLUDED.popular,
                    updated_at = NOW()`,
                [
                    restaurant.name,
                    restaurant.category || 'Restaurant',
                    restaurant.cuisine || null,
                    restaurant.city || null,
                    restaurant.address || null,
                    restaurant.phone || null,
                    restaurant.image || null,
                    restaurant.location || null,
                    restaurant.serviceRating ?? null,
                    restaurant.tastePriceRating ?? null,
                    restaurant.description || null,
                    Boolean(restaurant.featured),
                    Boolean(restaurant.popular),
                    'local',
                    String(restaurant.id)
                ]
            );
        }
        await client.query('COMMIT');
        return restaurants.length;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function listRestaurants({ category = '', search = '' } = {}) {
    const database = getPool();
    if (!database) throw new Error('DATABASE_URL is not configured.');

    const values = [];
    const conditions = [];
    if (category) {
        values.push(category.trim().toLowerCase());
        conditions.push(`LOWER(category) = $${values.length}`);
    }
    if (search) {
        values.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(`LOWER(name) LIKE $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(
        `SELECT id::integer, name, category, cuisine, city, address, phone, image,
                location, service_rating AS "serviceRating",
                taste_price_rating AS "tastePriceRating", description, featured, popular
         FROM restaurants ${where} ORDER BY id`,
        values
    );
    return result.rows;
}

async function findRestaurant(id) {
    const database = getPool();
    if (!database) throw new Error('DATABASE_URL is not configured.');
    const result = await database.query(
        `SELECT id::integer, name, category, cuisine, city, address, phone, image,
                location, service_rating AS "serviceRating",
                taste_price_rating AS "tastePriceRating", description, featured, popular
         FROM restaurants WHERE provider = 'local' AND provider_id = $1`,
        [String(id)]
    );
    return result.rows[0] || null;
}

module.exports = {
    getPool,
    checkDatabaseConnection,
    insertFeedback,
    listFeedback,
    upsertRestaurants,
    listRestaurants,
    findRestaurant
};
