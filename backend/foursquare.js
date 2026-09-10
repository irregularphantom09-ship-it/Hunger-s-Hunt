const FOURSQUARE_BASE = "https://places-api.foursquare.com";
const PLACES_API_VERSION = "2025-06-17";
const PLACE_FIELDS = [
    "fsq_place_id",
    "name",
    "latitude",
    "longitude",
    "categories",
    "location",
    "tel",
    "rating",
    "distance",
    "description",
    "photos"
].join(",");

const CATEGORY_QUERY = {
    bakery: "bakery",
    cafe: "cafe",
    "fast food": "fast food",
    dinner: "restaurant",
    restaurant: "restaurant"
};

function photoUrl(photos) {
    const photo = Array.isArray(photos) && photos[0];
    if (!photo) return "";
    if (photo.prefix && photo.suffix) {
        return `${photo.prefix}300x300${photo.suffix}`;
    }
    return photo.url || "";
}

function mapPlace(place) {
    const category = place.categories && place.categories[0];
    const loc = place.location || {};
    const lat = place.latitude;
    const lng = place.longitude;
    const rating = typeof place.rating === "number" ? place.rating : 0;

    return {
        id: place.fsq_place_id,
        providerId: place.fsq_place_id,
        name: place.name || "Unknown place",
        category: category ? category.name : "Restaurant",
        cuisine: category ? category.name : "",
        city: loc.locality || loc.region || "",
        address: loc.formatted_address || loc.address || "",
        phone: place.tel || "",
        image: photoUrl(place.photos),
        location: lat != null && lng != null
            ? `https://www.google.com/maps?q=${lat},${lng}`
            : "",
        serviceRating: rating,
        tastePriceRating: rating,
        description: place.description || "",
        featured: false,
        popular: false,
        source: "foursquare",
        distance: place.distance,
        fsqPlaceId: place.fsq_place_id
    };
}

function getApiKey() {
    const apiKey = process.env.FOURSQUARE_API_KEY;
    if (!apiKey) {
        const error = new Error("FOURSQUARE_API_KEY is not set. Add it to your .env file.");
        error.status = 503;
        throw error;
    }
    return apiKey;
}

async function requestFoursquare(url) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${getApiKey()}`,
            "X-Places-Api-Version": PLACES_API_VERSION
        }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.message || body.error || `Foursquare error ${response.status}`);
        error.status = response.status;
        error.details = body;
        throw error;
    }

    return body;
}

async function searchPlaces({ query, ll, near, radius, sort, limit, openNow }) {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (ll) params.set("ll", ll);
    if (near) params.set("near", near);
    if (radius) params.set("radius", String(radius));
    if (sort) params.set("sort", sort);
    if (limit) params.set("limit", String(limit));
    if (openNow) params.set("open_now", "true");
    params.set("fields", PLACE_FIELDS);

    const url = `${FOURSQUARE_BASE}/places/search?${params.toString()}`;
    const body = await requestFoursquare(url);

    const results = Array.isArray(body.results) ? body.results : [];
    return results.map(mapPlace);
}

async function getPlace(fsqPlaceId) {
    if (!fsqPlaceId || !String(fsqPlaceId).trim()) {
        const error = new Error("A Foursquare place ID is required.");
        error.status = 400;
        throw error;
    }

    const params = new URLSearchParams({ fields: PLACE_FIELDS });
    const placeId = encodeURIComponent(String(fsqPlaceId).trim());
    const url = `${FOURSQUARE_BASE}/places/${placeId}?${params.toString()}`;
    const body = await requestFoursquare(url);
    return mapPlace(body);
}

function resolveSearchQuery(search, category) {
    if (search && search.trim()) return search.trim();
    const key = (category || "").trim().toLowerCase();
    return CATEGORY_QUERY[key] || "restaurant";
}

module.exports = {
    searchPlaces,
    getPlace,
    resolveSearchQuery
};
