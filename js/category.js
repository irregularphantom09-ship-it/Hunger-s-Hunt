async function initCategoryPage() {

    await restaurantsReady;

    const restaurantContainer = document.querySelector("#restaurant-container");
    const categoryTitle = document.querySelector("#category-title");
    const searchInput = document.querySelector("#search-input");
    const searchBtn = document.querySelector(".search-btn");

    const params = new URLSearchParams(window.location.search);
    const selectedCategory = params.get("category");
    let requestId = 0;
    let searchTimer;

    if (!selectedCategory) {
        window.location.href = "index.html";
        return;
    }

    categoryTitle.textContent = selectedCategory;

    function filterByCategory(list, searchTerm = "") {
        const cat = selectedCategory.toLowerCase();
        const term = searchTerm.trim().toLowerCase();

        return list.filter(r => {
            const sameCategory = (r.category || "").toLowerCase() === cat;
            const matchesSearch = !term || (r.name || "").toLowerCase().includes(term);
            return sameCategory && matchesSearch;
        });
    }

    async function loadCategoryData(searchTerm = "") {
        const currentRequestId = ++requestId;
        let data = filterByCategory(restaurants, searchTerm);
        restaurantContainer.innerHTML = `<div class="page-loading" role="status"><span class="pacman-loader" aria-hidden="true"><span></span><span></span><span></span><span></span></span><p>Loading ${escapeHtml(selectedCategory)} restaurants...</p></div>`;

        try {
            let url = `/api/restaurants?category=${encodeURIComponent(selectedCategory)}`;
            if (searchTerm.trim() !== "") {
                url += `&search=${encodeURIComponent(searchTerm.trim())}`;
            }

            const response = await fetch(url);
            if (response.ok) {
                const apiData = await response.json();
                data = filterByCategory(Array.isArray(apiData) ? apiData : [], searchTerm);
            }
        } catch (error) {
            console.warn("Category API unavailable, filtering loaded data instead:", error);
        }

        if (currentRequestId !== requestId) return;

        if (data.length === 0) {
            restaurantContainer.innerHTML = `
                <div class="no-results">
                    <img src="images/not_found.png" alt="No results found">
                    <h2>No Restaurants Found</h2>
                    <p>No restaurants found in this category${searchTerm ? ` matching "${searchTerm}"` : ""}.</p>
                </div>`;
        } else {
            displayRestaurants(data, restaurantContainer, selectedCategory);
        }
    }

    await loadCategoryData();

    searchInput?.addEventListener("input", (event) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadCategoryData(event.target.value.trim()), 250);
    });

    if (searchBtn) {
        searchBtn.addEventListener("click", (e) => {
            e.preventDefault();
            loadCategoryData(searchInput.value.trim());
        });
    }
}

initCategoryPage();
