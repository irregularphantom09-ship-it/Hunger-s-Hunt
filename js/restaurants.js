async function initRestaurantsPage() {
    const container = document.querySelector("#restaurant-container");
    const loading = document.querySelector("#restaurant-loading");
    const pageTitle = document.querySelector("#page-title");
    const searchInput = document.querySelector("#restaurant-search");
    const searchBtn = document.querySelector(".search-btn");
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("filter");
    const provider = params.get("provider") || params.get("source") || "local";
    const externalLocation = params.get("near") || "";
    const externalCategory = params.get("category") || "";
    const isExternal = provider === "osm" || provider === "foursquare";
    const isCombinedPeshawar = isExternal && externalLocation.trim().toLowerCase() === "peshawar" && provider === "osm";
    let requestId = 0;
    let activeController;

    if (externalLocation) sessionStorage.setItem("hh.location", externalLocation);
    if (isExternal && externalLocation) {
        pageTitle.textContent = `${externalCategory || "Nearby"} in ${externalLocation}`;
    } else if (filter === "featured") {
        pageTitle.textContent = "Featured Restaurants";
    } else if (filter === "popular") {
        pageTitle.textContent = "Popular Restaurants";
    } else {
        pageTitle.textContent = "All Restaurants";
    }

    function showLoading() {
        container.innerHTML = `<div class="page-loading" role="status"><span class="pacman-loader" aria-hidden="true"><span></span><span></span><span></span><span></span></span><p>Loading restaurants...</p></div>`;
    }

    function showEmpty() {
        container.innerHTML = `<div class="no-results"><img src="images/not_found.png" alt=""><h2>No Restaurants Found</h2><p>${isExternal ? "We couldn't find restaurants matching this category in this location." : "No restaurants matched your search."}</p></div>`;
    }

    function showProviderError() {
        container.innerHTML = `<div class="provider-error" role="alert"><h2>Live Discovery Temporarily Unavailable</h2><p>Please try again in a moment.</p></div>`;
    }

    async function loadRestaurants(searchTerm = "") {
        const currentRequestId = ++requestId;
        if (activeController) activeController.abort();
        activeController = new AbortController();
        showLoading();
        try {
            let data;
            if (isExternal) {
                const liveData = await (provider === "foursquare"
                    ? searchFoursquareRestaurants({ near: externalLocation, search: searchTerm || externalCategory || "restaurant", limit: 50, signal: activeController.signal })
                    : searchOsmRestaurants({ near: externalLocation, search: searchTerm || externalCategory || "restaurant", limit: 50, signal: activeController.signal }));
                data = liveData.map(record => ({
                    ...record,
                    discoveryNear: externalLocation,
                    discoveryBack: `restaurants.html?provider=${encodeURIComponent(provider)}&near=${encodeURIComponent(externalLocation)}&category=${encodeURIComponent(externalCategory)}`
                }));
                if (isCombinedPeshawar) {
                    await restaurantsReady;
                    const localData = restaurants
                        .filter(record => !externalCategory || (record.category || "").toLowerCase() === externalCategory.toLowerCase())
                        .map(record => ({ ...record, source: "local" }));
                    data = [...localData, ...data];
                }
                if (externalCategory) {
                    data = data.filter(record => (record.category || record.cuisine || "").toLowerCase() === externalCategory.toLowerCase());
                }
            } else {
                await restaurantsReady;
                const response = await fetch(`${apiUrl("restaurants")}${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`, { signal: activeController.signal });
                if (!response.ok) throw new Error("API error");
                data = await response.json();
                if (filter === "featured") data = data.filter(record => record.featured);
                if (filter === "popular") data = data.filter(record => record.popular);
            }

            if (currentRequestId !== requestId) return;
            if (!Array.isArray(data) || !data.length) {
                showEmpty();
                return;
            }
            displayRestaurants(data, container, externalCategory);
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error("Failed to load restaurants:", error);
            if (isExternal) showProviderError();
            else container.innerHTML = `<p class="error">Could not load restaurants. Please try again.</p>`;
        }
    }

    await loadRestaurants();
    if (loading) loading.remove();

    function performSearch() {
        loadRestaurants(searchInput.value.trim());
    }

    searchBtn?.addEventListener("click", performSearch);
    searchInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") performSearch();
    });
}

initRestaurantsPage();
