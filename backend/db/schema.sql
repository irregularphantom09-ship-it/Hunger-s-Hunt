CREATE TABLE IF NOT EXISTS restaurants (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Restaurant',
    cuisine TEXT,
    city TEXT,
    address TEXT,
    phone TEXT,
    image TEXT,
    location TEXT,
    service_rating NUMERIC(2, 1) CHECK (service_rating >= 0 AND service_rating <= 5),
    taste_price_rating NUMERIC(2, 1) CHECK (taste_price_rating >= 0 AND taste_price_rating <= 5),
    description TEXT,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    popular BOOLEAN NOT NULL DEFAULT FALSE,
    provider TEXT NOT NULL DEFAULT 'local',
    provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Anonymous',
    email TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS restaurants_city_idx ON restaurants (city);
CREATE INDEX IF NOT EXISTS restaurants_category_idx ON restaurants (category);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
