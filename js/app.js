// ===== Homepage Logic =====

async function initHomepage() {
    await restaurantsReady;

    const featuredSection = document.querySelector("#featured");
    const popularSection = document.querySelector("#popular");
    const categoriesSection = document.querySelector("#categories");
    const featuredContainer = document.querySelector("#featured-container");
    const popularContainer = document.querySelector("#popular-container");
    const categoriesContainer = document.querySelector("#categories-container");
    const categoryGrid = document.querySelector("#category-grid");
    const homeSearch = document.querySelector("#home-search");
    const homeLocation = document.querySelector("#home-location");
    const confirmLocation = document.querySelector("#confirm-location");
    const locationMessage = document.querySelector("#location-message");
    const suggestions = document.querySelector("#suggestions");
    const searchResults = document.querySelector("#search-results");
    const localSearchSection = document.querySelector("#local-search-section");
    const localSearchResults = document.querySelector("#local-search-results");
    const externalSection = document.querySelector("#external-search-section");
    const externalResults = document.querySelector("#external-search-results");
    const externalResultsTitle = document.querySelector("#external-results-title");
    const categoryCue = document.querySelector("#category-cue");

    if (!homeSearch || !homeLocation || !confirmLocation) return;

    let selectedLocation = "";
    let activeController;
    let suggestionController;
    let requestId = 0;
    let suggestionTimer;
    let searchTimer;
    const SEARCH_DEBOUNCE_MS = 400;

    const isPeshawar = location => location.trim().toLowerCase() === "peshawar";
    const localRecords = restaurants.map(record => ({ ...record, source: "local" }));

    function getCurrentMode() {
        return getHomeMode({ selectedLocation, isSearchActive: Boolean(homeSearch.value.trim()) || Boolean(selectedLocation) && searchResults.classList.contains("is-visible") });
    }

    function clearSearchContent() {
        if (localSearchResults) localSearchResults.innerHTML = "";
        if (externalResults) externalResults.innerHTML = "";
        if (categoriesContainer) categoriesContainer.innerHTML = "";
        if (categoryGrid) categoryGrid.innerHTML = "";
        if (localSearchSection) localSearchSection.hidden = true;
        if (externalSection) externalSection.hidden = true;
        setCategoriesVisible(false);
        if (categoryCue) categoryCue.hidden = true;
        if (searchResults) searchResults.classList.remove("is-visible");
    }

    function setMainSectionsVisible(visible) {
        [featuredSection, popularSection].forEach(section => {
            if (section) section.style.display = visible ? "" : "none";
        });
    }

    function setCategoriesVisible(visible) {
        if (categoriesSection) {
            categoriesSection.style.display = visible ? "" : "none";
        }
    }

    function setLocationMessage(message = "") {
        locationMessage.textContent = message;
        locationMessage.hidden = !message;
    }

    function showNoResults(container, title, message) {
        container.innerHTML = `<div class="no-results"><img src="images/not_found.png" alt=""><h2>${title}</h2><p>${message}</p></div>`;
    }

    function showLoading() {
        externalResults.innerHTML = `<div class="live-loading" role="status"><span class="pacman-loader" aria-hidden="true"><span></span><span></span><span></span><span></span></span><p>Finding restaurants near ${escapeHtml(selectedLocation)}...</p></div>`;
    }

    function showProviderError() {
        externalResults.innerHTML = `<div class="provider-error" role="alert"><h2>Live Discovery Temporarily Unavailable</h2><p>Please try again in a moment.</p></div>`;
    }

    function rememberLocation() {
        if (selectedLocation) sessionStorage.setItem("hh.location", selectedLocation);
        else sessionStorage.removeItem("hh.location");
    }

    function renderLocalSections() {
        const featured = localRecords.filter(record => record.featured);
        const popular = localRecords.filter(record => record.popular && !record.featured);
        const withLocalContext = records => records.map(record => ({
            ...record,
            discoveryNear: selectedLocation,
            discoveryBack: `restaurants.html?provider=osm&near=${encodeURIComponent(selectedLocation)}&category=${encodeURIComponent(record.category || "")}`
        }));
        setMainSectionsVisible(true);
        displayRestaurants(withLocalContext(featured), featuredContainer);
        displayRestaurants(withLocalContext(popular), popularContainer);
        featuredSection.style.display = featured.length ? "" : "none";
        popularSection.style.display = popular.length ? "" : "none";
    }

    function renderCombinedCategories(liveRecords) {
        const isHybrid = isPeshawar(selectedLocation);
        const combined = isHybrid ? [...localRecords, ...liveRecords] : [...liveRecords];
        const categories = [...new Set(combined.map(record => record.category || record.cuisine || "Restaurant").filter(Boolean))];
        categoriesContainer.innerHTML = "";
        categoryGrid.innerHTML = categories.map(category => `<a href="#${getCategoryId(category)}-container" class="category-btn">${escapeHtml(category)}</a>`).join("");

        categories.forEach(category => {
            const viewAllHref = `restaurants.html?provider=osm&near=${encodeURIComponent(selectedLocation)}&category=${encodeURIComponent(category)}`;
            const records = combined
                .filter(record => (record.category || record.cuisine || "Restaurant") === category)
                .map(record => record.source === "local"
                    ? { ...record, discoveryNear: selectedLocation, discoveryBack: viewAllHref }
                    : record);
            categoriesContainer.insertAdjacentHTML("beforeend", createCategorySection(category, { viewAllHref }));
            displayRestaurants(records.slice(0, 6), document.querySelector(`#${getCategoryId(category)}-container`), category);
        });
        categoriesSection.style.display = categories.length ? "" : "none";
        if (categoryCue) categoryCue.hidden = !categories.length;
    }

    function renderLocalSearch(query) {
        const matches = localRecords.filter(record => (record.name || "").toLowerCase().includes(query.toLowerCase()));
        localSearchSection.hidden = false;
        displayRestaurants(matches, localSearchResults);
        if (!matches.length) showNoResults(localSearchResults, "No Curated Restaurants Found", `No local restaurant matches "${escapeHtml(query)}".`);
    }

    async function performExternalSearch(query = "") {
        const normalizedQuery = String(query || "").trim();
        if (!selectedLocation) {
            setLocationMessage("Please select a location before searching.");
            return;
        }

        const currentRequestId = ++requestId;
        if (activeController) activeController.abort();
        activeController = new AbortController();
        externalSection.hidden = false;
        setMainSectionsVisible(false);
        showLoading();
        try {
            const records = await searchOsmRestaurants({
                near: selectedLocation,
                search: normalizedQuery || "restaurant",
                limit: 50,
                signal: activeController.signal
            });
            if (currentRequestId !== requestId) return;
            const liveRecords = records.map(record => ({
                ...record,
                source: "osm",
                discoveryNear: selectedLocation,
                discoveryBack: `index.html?near=${encodeURIComponent(selectedLocation)}`
            }));
            const localKeys = new Set(localRecords.map(record => `${String(record.name || "").trim().toLowerCase()}|${String(record.city || "").trim().toLowerCase()}`));
            const liveKeys = new Set();
            const uniqueLiveRecords = liveRecords.filter(record => {
                const key = `${String(record.name || "").trim().toLowerCase()}|${String(record.city || "").trim().toLowerCase()}`;
                if (liveKeys.has(key) || (isPeshawar(selectedLocation) && localKeys.has(key))) return false;
                liveKeys.add(key);
                return true;
            });
            if (!uniqueLiveRecords.length) {
                showNoResults(externalResults, "No Restaurants Found", `We couldn't find restaurants matching your search in ${escapeHtml(selectedLocation)}.`);
                categoriesContainer.innerHTML = "";
                setCategoriesVisible(false);
                if (categoryCue) categoryCue.hidden = true;
                return;
            }
            displayRestaurants(uniqueLiveRecords, externalResults);
            renderCombinedCategories(uniqueLiveRecords);
            if (isPeshawar(selectedLocation)) {
                setMainSectionsVisible(true);
            } else {
                setMainSectionsVisible(false);
                setCategoriesVisible(true);
            }
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error("External discovery failed:", error);
            if (currentRequestId === requestId) showProviderError();
        }
    }

    async function loadLocation(location) {
        const normalized = location.trim();
        if (!normalized) {
            selectedLocation = "";
            rememberLocation();
            clearSearchContent();
            setMainSectionsVisible(false);
            setLocationMessage("");
            return;
        }

        selectedLocation = normalized;
        homeLocation.value = normalized;
        rememberLocation();
        setLocationMessage("");
        hideSuggestions();
        requestId += 1;
        homeSearch.value = "";
        clearSearchContent();
        localSearchSection.hidden = true;
        externalSection.hidden = false;
        externalResultsTitle.textContent = `Live Discovery Near ${normalized}`;

        if (isPeshawar(normalized)) {
            renderLocalSections();
            setMainSectionsVisible(true);
        } else {
            setMainSectionsVisible(false);
            setCategoriesVisible(false);
        }
        searchResults.classList.add("is-visible");
        await performExternalSearch();
    }

    function hideSuggestions() {
        suggestions.hidden = true;
        suggestions.innerHTML = "";
    }

    function renderSuggestions(records) {
        suggestions.innerHTML = "";
        records.forEach(record => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "suggestion-item";
            button.textContent = record.name || record.category || "Place";
            button.addEventListener("click", () => {
                homeSearch.value = record.name || "";
                hideSuggestions();
                homeSearch.focus();
            });
            suggestions.appendChild(button);
        });
        suggestions.hidden = !records.length;
    }

    function updateSuggestions() {
        clearTimeout(suggestionTimer);
        const query = homeSearch.value.trim();
        if (!selectedLocation || query.length < 2) {
            hideSuggestions();
            return;
        }
        suggestionTimer = setTimeout(async () => {
            if (suggestionController) suggestionController.abort();
            suggestionController = new AbortController();
            try {
                const records = await getRestaurantSuggestions({ near: selectedLocation, query, signal: suggestionController.signal });
                renderSuggestions(records);
            } catch (error) {
                if (error.name !== "AbortError") console.warn("Suggestions unavailable:", error);
            }
        }, 350);
    }

    function performSearch() {
        const query = homeSearch.value.trim();
        if (!selectedLocation) {
            setLocationMessage("Please select a location before searching.");
            homeLocation.focus();
            return;
        }
        hideSuggestions();
        searchResults.classList.add("is-visible");
        clearSearchContent();
        if (isPeshawar(normalizedLocation())) {
            renderLocalSearch(query);
            setMainSectionsVisible(true);
        } else {
            setMainSectionsVisible(false);
            setCategoriesVisible(false);
        }
        externalSection.hidden = false;
        performExternalSearch(query);
    }

    function scheduleSearch() {
        clearTimeout(searchTimer);
        if (!selectedLocation) {
            hideSuggestions();
            return;
        }
        searchTimer = setTimeout(() => {
            if (homeSearch.value.trim()) {
                performSearch();
            }
        }, SEARCH_DEBOUNCE_MS);
    }

    function normalizedLocation() {
        return selectedLocation.trim();
    }

    clearSearchContent();
    setMainSectionsVisible(false);

    const storedLocation = sessionStorage.getItem("hh.location");
    if (storedLocation) loadLocation(storedLocation);

    confirmLocation.addEventListener("click", () => loadLocation(homeLocation.value));
    homeLocation.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            loadLocation(homeLocation.value);
        }
    });
    homeLocation.addEventListener("input", () => {
        if (homeLocation.value.trim().toLowerCase() !== selectedLocation.toLowerCase()) {
            selectedLocation = "";
            rememberLocation();
            requestId += 1;
            if (activeController) activeController.abort();
            setMainSectionsVisible(false);
            externalSection.hidden = true;
            localSearchSection.hidden = true;
            searchResults.classList.remove("is-visible");
        }
    });
    homeSearch.addEventListener("input", () => {
        updateSuggestions();
        scheduleSearch();
    });
    homeSearch.addEventListener("keydown", event => {
        if (event.key === "Escape") hideSuggestions();
        if (event.key === "Enter") {
            event.preventDefault();
            clearTimeout(searchTimer);
            performSearch();
        }
    });
    document.addEventListener("click", event => {
        if (!event.target.closest(".search-wrapper")) hideSuggestions();
    });
    document.querySelector(".home-search-btn")?.addEventListener("click", event => {
        event.preventDefault();
        performSearch();
    });
}

initHomepage();
