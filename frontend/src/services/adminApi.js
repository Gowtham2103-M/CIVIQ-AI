const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export function getAdminToken() {
  return localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");
}

export function clearAdminAuth() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
  sessionStorage.removeItem("admin_token");
  sessionStorage.removeItem("admin_user");
}

export async function adminRequest(path, options = {}) {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (response.status === 401) {
    clearAdminAuth();
    window.location.assign("/admin/login");
    throw new Error("Your admin session has expired. Please sign in again.");
  }
  if (response.status === 403) throw new Error("Access denied.");
  if (response.status === 404) throw new Error("The requested admin resource was not found.");
  if (!response.ok) throw new Error(payload.detail || "The admin service returned an error.");
  return payload;
}

export async function adminLogin(username, password) {
  return adminRequest("/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export { API_BASE_URL };
