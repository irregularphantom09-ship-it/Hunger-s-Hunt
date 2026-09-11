let restaurants = [];

async function loadFromApi() {
    const response = await fetch(apiUrl("restaurants"));
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return response.json();
}

async function loadFromFile() {
    const response = await fetch("js/data/restaurant.json");
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return response.json();
}

const restaurantsReady = loadFromApi()
    .catch(error => {
        console.warn("API unavailable, loading restaurant.json instead:", error);
        return loadFromFile();
    })
    .then(data => {
        restaurants = Array.isArray(data) ? data : [];
        return restaurants;
    })
    .catch(error => {
        console.error("Restaurant data loading failed:", error);
        restaurants = [];
        return restaurants;
    });

async function searchFoursquareRestaurants({ near, ll, search, category, radius, limit, openNow, signal } = {}) {
    const params = new URLSearchParams();
    const values = { near, ll, search, category, radius, limit };

    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            params.set(key, String(value).trim());
        }
    });

    params.set("provider", "foursquare");
    if (openNow) params.set("openNow", "true");

    const response = await fetch(`${apiUrl("restaurants/search")}?${params.toString()}`, { signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP error ${response.status}`);
    return Array.isArray(body) ? body : [];
}

async function loadFoursquarePlace(fsqPlaceId) {
    const response = await fetch(apiUrl(`foursquare/places/${encodeURIComponent(fsqPlaceId)}`));
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP error ${response.status}`);
    return body;
}

async function searchOsmRestaurants({ near, ll, search, category, radius, limit, signal } = {}) {
    const params = new URLSearchParams();
    const values = { near, ll, search, category, radius, limit };

    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            params.set(key, String(value).trim());
        }
    });

    params.set("provider", "osm");
    const response = await fetch(`${apiUrl("restaurants/search")}?${params.toString()}`, { signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP error ${response.status}`);
    return Array.isArray(body) ? body : [];
}

async function getRestaurantSuggestions({ near, query, provider = "osm", signal } = {}) {
    const params = new URLSearchParams({ provider });
    if (near) params.set("near", near);
    if (query) params.set("query", query);

    const response = await fetch(`${apiUrl("restaurants/suggestions")}?${params.toString()}`, { signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP error ${response.status}`);
    return Array.isArray(body) ? body : [];
}

async function loadOsmPlace(osmPlaceId) {
    const response = await fetch(apiUrl(`osm/places/${encodeURIComponent(osmPlaceId)}`));
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP error ${response.status}`);
    return body;
}
