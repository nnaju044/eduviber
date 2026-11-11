import { apiFetch } from "./client.js";

/**
 * Public Courses and Catalog API
 */
export async function getPublicCourses(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);
  if (params.q) query.set("q", params.q);
  if (params.teacherId) query.set("teacherId", params.teacherId);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch(`/api/public/courses${qs}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Failed to fetch courses (${res.status})`);
  }
  const payload = await res.json();
  return payload.data;
}

export async function getPublicCourseDetail(slug) {
  const res = await apiFetch(`/api/public/courses/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Failed to fetch course details (${res.status})`);
  }
  const payload = await res.json();
  return payload.data;
}

export async function getPublicTeachers(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);
  if (params.q) query.set("q", params.q);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch(`/api/public/teachers${qs}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Failed to fetch instructors (${res.status})`);
  }
  const payload = await res.json();
  return payload.data;
}

/**
 * Public & Auth Password Recovery APIs
 */
export async function requestForgotPassword(email) {
  const res = await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || `Failed to request password reset (${res.status})`);
  }
  return payload;
}

export async function submitResetPassword({ token, password, confirmPassword }) {
  const res = await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: { token, password, confirmPassword },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || `Failed to reset password (${res.status})`);
  }
  return payload;
}

