(function () {
    const HOME_MODE = {
        NORMAL: 'normal',
        LIVE_SEARCH: 'live-search',
        PESHAWAR_HYBRID: 'peshawar-hybrid'
    };

    function getHomeMode({ selectedLocation = '', isSearchActive = false } = {}) {
        const normalized = String(selectedLocation || '').trim().toLowerCase();

        if (!normalized || !isSearchActive) {
            return HOME_MODE.NORMAL;
        }

        if (normalized === 'peshawar') {
            return HOME_MODE.PESHAWAR_HYBRID;
        }

        return HOME_MODE.LIVE_SEARCH;
    }

    if (typeof window !== 'undefined') {
        window.HOME_MODE = HOME_MODE;
        window.getHomeMode = getHomeMode;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { HOME_MODE, getHomeMode };
    }
})();
