const configuredApiBase = typeof window !== "undefined"
    ? String(window.HUNGER_HUNT_API_BASE || "").trim().replace(/\/+$/, "")
    : "";
const API_BASE = configuredApiBase
    ? (configuredApiBase.endsWith("/api") ? configuredApiBase : `${configuredApiBase}/api`)
    : "/api";

function apiUrl(path) {
    return `${API_BASE}/${String(path).replace(/^\/+/, "")}`;
}