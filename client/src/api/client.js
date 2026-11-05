/**
 * EduVibe Frontend API Client
 * - Manages session cookie credentials ('credentials: include')
 * - Fetches and injects CSRF token for state-changing requests
 * - Standardizes error handling and API communication
 */

let cachedCsrfToken = null;

export async function fetchCsrfToken() {
  try {
    const res = await fetch("/api/csrf-token", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch CSRF token (${res.status})`);
    }
    const payload = await res.json();
    if (payload.success && payload.data?.csrfToken) {
      cachedCsrfToken = payload.data.csrfToken;
      return cachedCsrfToken;
    }
  } catch (err) {
    console.warn("CSRF token fetch error:", err);
  }
  return cachedCsrfToken;
}

export function getCachedCsrfToken() {
  return cachedCsrfToken;
}

export function setCachedCsrfToken(token) {
  cachedCsrfToken = token;
}

/**
 * Universal wrapper around fetch for EduVibe REST APIs
 */
export async function apiFetch(endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  // State-changing requests require a CSRF token
  const requiresCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (requiresCsrf) {
    if (!cachedCsrfToken) {
      await fetchCsrfToken();
    }
    if (cachedCsrfToken) {
      headers["x-csrf-token"] = cachedCsrfToken;
    }
  }

  // Auto-set Content-Type for JSON body
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(endpoint, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  // Parse JSON response
  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  // If CSRF error (403 invalid token), refresh token once and retry if configured
  if (response.status === 403 && data?.error?.code === "CSRF_ERROR" && !options._retried) {
    await fetchCsrfToken();
    return apiFetch(endpoint, { ...options, _retried: true });
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error?.message || response.statusText || "Request failed";
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.code || data?.error?.code || `HTTP_${response.status}`;
    error.data = data;
    throw error;
  }

  // Update cached CSRF token if returned in response payload (e.g. login)
  if (data?.data?.csrfToken) {
    cachedCsrfToken = data.data.csrfToken;
  }

  return data;
}

export const authApi = {
  getCsrfToken: fetchCsrfToken,

  async getMe() {
    return apiFetch("/api/auth/me");
  },

  async login(credentials) {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: credentials,
    });
    return res;
  },

  async logout() {
    try {
      return await apiFetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      cachedCsrfToken = null;
    }
  },

  async changePassword(passwords) {
    return apiFetch("/api/auth/change-password", {
      method: "POST",
      body: passwords,
    });
  },
};
