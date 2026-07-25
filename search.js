const searchInput = document.getElementById("searchInput");

let currentCategory = "all";

searchInput.addEventListener("keyup", function () {
    filterRestaurants();
});

function filterCards(category) {
    currentCategory = category;
    filterRestaurants();
}

function filterRestaurants() {

    const searchValue = searchInput.value.toLowerCase();

    const sections = document.querySelectorAll(".food_section");

    const notFound = document.getElementById("not_found");

    let anyVisible = false;

    sections.forEach(function(section) {

        const cards = section.querySelectorAll(".card");

        let sectionHasVisibleCard = false;

        cards.forEach(function(card) {

            const restaurantName = card.querySelector("h2").textContent.toLowerCase();

            const categories = card.dataset.category.toLowerCase();

            const matchesSearch =
                restaurantName.includes(searchValue);

            const matchesCategory =
                currentCategory === "all" ||
                categories.includes(currentCategory);

            if (matchesSearch && matchesCategory) {

                card.style.display = "block";
                sectionHasVisibleCard = true;

            } else {

                card.style.display = "none";

            }

        });

        if (sectionHasVisibleCard) {

            section.style.display = "block";
            anyVisible = true;

        } else {

            section.style.display = "none";

        }

    });

    if (anyVisible) {

        notFound.style.display = "none";

    } else {

        notFound.style.display = "flex";

    }

}