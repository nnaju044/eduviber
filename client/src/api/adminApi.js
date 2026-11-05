import { apiFetch } from "./client.js";

export const adminApi = {
  // Platform Overview
  async getStats() {
    const res = await apiFetch("/api/admin/stats");
    return res?.data?.stats || null;
  },

  // Teacher Management
  async listTeachers() {
    const res = await apiFetch("/api/admin/teachers");
    return res?.data?.teachers || [];
  },

  async getTeacher(id) {
    const res = await apiFetch(`/api/admin/teachers/${id}`);
    return res?.data || null;
  },

  async createTeacher(payload) {
    const res = await apiFetch("/api/admin/teachers", {
      method: "POST",
      body: payload,
    });
    return res?.data?.teacher || null;
  },

  async approveTeacher(id) {
    const res = await apiFetch(`/api/admin/teachers/${id}/approve`, {
      method: "POST",
    });
    return res?.data?.teacher || null;
  },

  async toggleTeacherStatus(id) {
    const res = await apiFetch(`/api/admin/teachers/${id}/toggle-status`, {
      method: "POST",
    });
    return res?.data?.teacher || null;
  },

  // Course Management
  async listCourses() {
    const res = await apiFetch("/api/admin/courses");
    return res?.data?.courses || [];
  },

  async createCourse(payload) {
    const res = await apiFetch("/api/admin/courses", {
      method: "POST",
      body: payload,
    });
    return res?.data?.course || null;
  },

  async toggleCoursePublication(id) {
    const res = await apiFetch(`/api/admin/courses/${id}/toggle-publication`, {
      method: "POST",
    });
    return res?.data?.course || null;
  },

  async deleteCourse(id) {
    return apiFetch(`/api/admin/courses/${id}`, {
      method: "DELETE",
    });
  },

  // Student & Enrollment Management
  async listStudents(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    const qs = query.toString() ? `?${query.toString()}` : "";
    const res = await apiFetch(`/api/admin/students${qs}`);
    return res?.data || { students: [], pagination: {} };
  },

  async getStudent(id) {
    const res = await apiFetch(`/api/admin/students/${id}`);
    return res?.data || null;
  },

  async updateEnrollmentStatus(id, status) {
    const res = await apiFetch(`/api/admin/enrollments/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
    return res?.data?.enrollment || null;
  },

  // Payment Management
  async listPayments(statusFilter = "") {
    const qs = statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const res = await apiFetch(`/api/admin/payments${qs}`);
    return res?.data?.payments || [];
  },

  async getPayment(id) {
    const res = await apiFetch(`/api/admin/payments/${id}`);
    return res?.data?.payment || null;
  },

  async approvePayment(id) {
    const res = await apiFetch(`/api/admin/payments/${id}/approve`, {
      method: "POST",
    });
    return res?.data || null;
  },

  async rejectPayment(id, rejectionReason) {
    const res = await apiFetch(`/api/admin/payments/${id}/reject`, {
      method: "POST",
      body: { rejectionReason },
    });
    return res?.data?.payment || null;
  },
};
