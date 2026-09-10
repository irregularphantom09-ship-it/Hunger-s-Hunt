async function initRestaurantPage() {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider") || params.get("source") || "local";
    const restaurantId = params.get("id");
    const selectedCategory = params.get("category");
    const near = params.get("near") || sessionStorage.getItem("hh.location") || "";
    const detailLoading = document.querySelector("#detail-loading");
    const main = document.querySelector("main") || document.body;

    function finishLoading() {
        if (detailLoading) detailLoading.remove();
    }

    function showNotFound(message = "Sorry, we couldn't find the restaurant you're looking for.") {
        finishLoading();
        main.innerHTML = `<div class="not-found"><h1>Restaurant not found</h1><p>${escapeHtml(message)}</p><a href="index.html" class="btn">Back to Home</a></div>`;
    }

    let restaurant;
    try {
        if (provider === "foursquare" && restaurantId) {
            restaurant = await loadFoursquarePlace(restaurantId);
        } else if (provider === "osm" && restaurantId) {
            restaurant = await loadOsmPlace(restaurantId);
        } else {
            await restaurantsReady;
            const localRestaurantId = Number(restaurantId);
            restaurant = restaurants.find(record => record.id === localRestaurantId);
            if (!restaurant && Number.isInteger(localRestaurantId) && localRestaurantId > 0) {
                const response = await fetch(`/api/restaurants/${localRestaurantId}`);
                if (response.ok) restaurant = await response.json();
            }
        }
    } catch (error) {
        console.warn(`Could not fetch ${provider} place:`, error);
        showNotFound(provider === "local" ? "The curated restaurant could not be loaded." : "Live restaurant details are temporarily unavailable.");
        return;
    }

    if (!restaurant) {
        showNotFound();
        return;
    }

    finishLoading();
    const popularBadge = document.querySelector("#popular-badge");
    const featureBadge = document.querySelector("#featured-badge");
    if (provider === "local" && restaurant.popular) {
        popularBadge.textContent = "Popular";
        popularBadge.style.display = "inline-block";
    }
    if (provider === "local" && restaurant.featured) {
        featureBadge.textContent = "Featured";
        featureBadge.style.display = "inline-block";
    }

    function setOptionalText(selector, value, prefix = "") {
        const element = document.querySelector(selector);
        if (!element) return;
        if (value) {
            element.textContent = `${prefix}${value}`;
            element.style.display = "";
        } else {
            element.style.display = "none";
        }
    }

    document.querySelector("#restaurant-name").textContent = restaurant.name || "Unknown place";
    setOptionalText("#restaurant-category", restaurant.category);
    setOptionalText("#restaurant-cuisine", restaurant.cuisine, "Cuisine: ");
    setOptionalText("#restaurant-address", restaurant.address, "Location: ");
    setOptionalText("#restaurant-city", restaurant.city);
    setOptionalText("#restaurant-description", restaurant.description);

    const phoneLink = document.querySelector("#restaurant-phone");
    if (restaurant.phone) {
        phoneLink.href = `tel:${restaurant.phone}`;
        phoneLink.textContent = `Call ${restaurant.phone}`;
        phoneLink.style.display = "";
    } else phoneLink.style.display = "none";

    const mapLink = document.querySelector("#restaurant-map");
    if (restaurant.location) {
        mapLink.href = restaurant.location;
        mapLink.style.display = "";
    } else mapLink.style.display = "none";

    const image = document.querySelector("#restaurant-image");
    const imagePlaceholder = document.querySelector("#image-placeholder");
    const imageModal = document.querySelector("#image-modal");
    const modalImage = document.querySelector("#modal-image");
    const imageInstruction = document.querySelector("#image-instruction");
    const imageUrl = getRestaurantImage(restaurant);
    let hasImage = Boolean(imageUrl && imageUrl !== "images/not_found.png");

    function showImagePlaceholder() {
        hasImage = false;
        image.style.display = "none";
        imageInstruction.style.display = "none";
        imagePlaceholder.hidden = false;
    }

    if (hasImage) {
        imagePlaceholder.hidden = true;
        image.classList.add("image-loading");
        image.src = imageUrl;
        image.alt = restaurant.name || "Restaurant image";
        image.style.display = "";
        image.addEventListener("load", () => image.classList.remove("image-loading"), { once: true });
        image.addEventListener("error", showImagePlaceholder, { once: true });
        imageInstruction.textContent = "Click the image to see clear image.";
        imageInstruction.style.display = "";
        image.addEventListener("click", () => {
            modalImage.src = image.currentSrc || image.src;
            imageModal.style.display = "flex";
        });
    } else {
        showImagePlaceholder();
    }
    document.querySelector("#close-modal").addEventListener("click", () => { imageModal.style.display = "none"; });
    imageModal.addEventListener("click", event => { if (event.target === imageModal) imageModal.style.display = "none"; });

    function createStars(value) {
        const rating = Math.min(5, Math.max(0, Number(value) || 0));
        return Array.from({ length: Math.floor(rating) }, () => '<i class="fa-solid fa-star rating-star"></i>').join("") +
            (rating % 1 > 0 ? '<i class="fa-solid fa-star-half-stroke rating-star"></i>' : "");
    }

    const serviceRow = document.querySelector("#service-stars").closest(".rating");
    const tasteRow = document.querySelector("#taste-price-stars").closest(".rating");
    if (typeof restaurant.serviceRating === "number") {
        document.querySelector("#service-stars").innerHTML = createStars(restaurant.serviceRating);
        document.querySelector("#service-score").textContent = `${restaurant.serviceRating}/5`;
    } else serviceRow.style.display = "none";
    if (typeof restaurant.tastePriceRating === "number") {
        document.querySelector("#taste-price-stars").innerHTML = createStars(restaurant.tastePriceRating);
        document.querySelector("#taste-price-score").textContent = `${restaurant.tastePriceRating}/5`;
    } else tasteRow.style.display = "none";

    const backButton = document.querySelector("#back-button");
    const explicitBack = params.get("back");
    if (explicitBack) backButton.href = explicitBack;
    else if ((provider === "osm" || provider === "foursquare") && near) backButton.href = `restaurants.html?provider=${encodeURIComponent(provider)}&near=${encodeURIComponent(near)}${selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : ""}`;
    else if (provider === "local" && selectedCategory) backButton.href = `categories.html?category=${encodeURIComponent(selectedCategory)}`;
    else backButton.href = "index.html";
}

initRestaurantPage();
