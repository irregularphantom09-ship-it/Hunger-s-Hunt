// ===== UI Rendering Functions =====

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    })[character]);
}

function getRestaurantImage(restaurant) {
    const source = ["foursquare", "osm"].includes(restaurant.source) ? restaurant.source : "local";
    const image = String(restaurant.image || "").trim();
    if (!image) return source === "local" ? "images/not_found.png" : "";

    try {
        const url = new URL(image, window.location.origin);
        if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch (error) {
        // Use the local fallback image for invalid external image URLs.
    }

    return source === "local" ? "images/not_found.png" : "";
}

function getCategoryId(category) {
    return String(category || "Restaurant").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
}

// Create a restaurant card with optional category context
function createRestaurantCard(restaurant, category = "") {
    const provider = ["foursquare", "osm"].includes(restaurant.source) ? restaurant.source : "local";
    const restaurantId = provider === "foursquare"
        ? restaurant.fsqPlaceId
        : provider === "osm"
            ? restaurant.osmPlaceId
            : restaurant.id;
    const params = new URLSearchParams({ provider, id: String(restaurantId ?? "") });

    if (category) {
        params.set("category", category);
    }
    if (restaurant.discoveryNear) params.set("near", restaurant.discoveryNear);
    if (restaurant.discoveryBack) params.set("back", restaurant.discoveryBack);
    const restaurantURL = `restaurant.html?${params.toString()}`;

    // Calculate average rating (service + taste) / 2
    const hasRating = typeof restaurant.serviceRating === "number" || typeof restaurant.tastePriceRating === "number";
    const serviceRating = Number(restaurant.serviceRating) || 0;
    const tastePriceRating = Number(restaurant.tastePriceRating) || 0;
    const avgRating = ((serviceRating + tastePriceRating) / 2).toFixed(1);

    // Generate stars (full and half)
    let stars = '';
    for (let i = 0; i < Math.floor(avgRating); i++) {
        stars += `<i class="fa-solid fa-star rating-star"></i>`;
    }
    if (Number(avgRating) % 1 > 0) {
        stars += `<i class="fa-solid fa-star-half-stroke rating-star"></i>`;
    }

    const image = escapeHtml(getRestaurantImage(restaurant));
    const name = escapeHtml(restaurant.name || "Unknown place");
    const restaurantCategory = escapeHtml(restaurant.category || "Restaurant");
    const city = escapeHtml(restaurant.city || "Location unavailable");
    const imageMarkup = image
        ? `<img src="${image}" alt="${name}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="card-image-placeholder" hidden>Image unavailable</div>`
        : `<div class="card-image-placeholder">Image unavailable</div>`;

    return `
    <div class="restaurant-card" data-id="${escapeHtml(restaurantId)}" data-source="${provider}">
        ${imageMarkup}
        <h2>${name}</h2>
        ${provider !== "local" ? `<span class="source-label">Live Discovery</span>` : `<span class="source-label">Hunger's Hunt Curated</span>`}
        ${restaurant.category ? `<p><i class="fa-solid fa-utensils"></i> ${restaurantCategory}</p>` : ""}
        ${restaurant.city ? `<p><i class="fa-solid fa-location-dot"></i> ${city}</p>` : ""}
        ${hasRating ? `<p class="rating">${stars} <span>(${avgRating})</span></p>` : ""}
        <a href="${restaurantURL}" class="btn">View Details</a>
    </div>`;
}

// Display a list of restaurants in a given container
function displayRestaurants(restaurants, container, category = "") {
    if (!container) return;
    container.innerHTML = "";
    for (const restaurant of restaurants) {
        container.innerHTML += createRestaurantCard(restaurant, category);
    }
}

// Create a category section with a header and container
function createCategorySection(category, options = {}) {
    const categoryText = String(category || "Restaurant");
    const categoryId = getCategoryId(categoryText);
    const viewAllHref = options.viewAllHref || `categories.html?category=${encodeURIComponent(categoryText)}`;
    return `
    <section class="category-section">
        <div class="category-header">
            <h2 class="title">${escapeHtml(categoryText)}</h2>
            <a href="${escapeHtml(viewAllHref)}" class="view-all">View All →</a>
        </div>
        <div id="${categoryId}-container" class="restaurant-container"></div>
    </section>`;
}
