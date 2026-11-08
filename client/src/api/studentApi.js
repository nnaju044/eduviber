import { apiFetch } from "./client.js";

/**
 * EduVibe Student API Service
 * - Connects to existing student endpoints in api/routes/studentRoutes.js
 * - Preserves session cookies ('credentials: include')
 * - Automatic CSRF injection for POST requests
 */
export const studentApi = {
  /**
   * Get student dashboard metrics, enrolled courses with progress, and pending enrollments
   */
  async getDashboard() {
    const res = await apiFetch("/api/student/dashboard");
    return res?.data || { enrolledCourses: [], pendingCourses: [] };
  },

  /**
   * Get enrolled course details and syllabus with personal progress
   */
  async getEnrolledCourse(courseId) {
    const res = await apiFetch(`/api/student/courses/${courseId}`);
    return res?.data || null;
  },

  /**
   * Get playback data, signed Bunny embed URL, watermark, and navigation for a lesson
   */
  async getLessonPlayback(courseId, lessonId) {
    const res = await apiFetch(`/api/student/courses/${courseId}/lessons/${lessonId}/playback`);
    return res?.data || null;
  },

  /**
   * Save student playback progress and completion state
   */
  async saveProgress(courseId, lessonId, progressData) {
    const res = await apiFetch(`/api/student/courses/${courseId}/lessons/${lessonId}/progress`, {
      method: "POST",
      body: progressData,
    });
    return res?.data?.progress || null;
  },

  /**
   * List registered devices for student account
   */
  async listDevices() {
    const res = await apiFetch("/api/student/devices");
    return res?.data || { devices: [], maxDevices: 2 };
  },

  /**
   * Revoke a registered device
   */
  async revokeDevice(deviceId) {
    const res = await apiFetch(`/api/student/devices/${deviceId}`, {
      method: "DELETE",
    });
    return res?.data || null;
  },

  /**
   * Get student profile details (name, email, phone, avatar, pendingEmail)
   */
  async getProfile() {
    const res = await apiFetch("/api/student/profile");
    return res?.data?.profile || null;
  },

  /**
   * Update permitted student profile fields (name, phone)
   */
  async updateProfile(profileData) {
    const res = await apiFetch("/api/student/profile", {
      method: "PATCH",
      body: profileData,
    });
    return res?.data?.profile || null;
  },

  /**
   * Upload or replace profile avatar
   */
  async uploadAvatar(formDataOrBase64) {
    let body;
    let headers = {};

    if (formDataOrBase64 instanceof FormData) {
      body = formDataOrBase64;
    } else {
      body = { image: formDataOrBase64 };
    }

    const res = await apiFetch("/api/student/profile/avatar", {
      method: "POST",
      body,
      headers,
    });
    return res?.data || null;
  },

  /**
   * Delete student avatar
   */
  async deleteAvatar() {
    const res = await apiFetch("/api/student/profile/avatar", {
      method: "DELETE",
    });
    return res?.data || null;
  },

  /**
   * Request email change (sends verification link to new email)
   */
  async requestEmailChange(newEmail) {
    const res = await apiFetch("/api/student/profile/email-change", {
      method: "POST",
      body: { newEmail },
    });
    return res?.data || null;
  },

  /**
   * Verify and finalize email change using verification token
   */
  async verifyEmailChange(token) {
    const res = await apiFetch("/api/student/profile/email-verify", {
      method: "POST",
      body: { token },
    });
    return res?.data || null;
  },

  /**
   * Change password (with global session invalidation & re-login requirement)
   */
  async changePassword(passwordData) {
    const res = await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: passwordData,
    });
    return res?.data || null;
  },

  // Homework & Assignments (Student)
  async listCourseAssignments(courseId) {
    const res = await apiFetch(`/api/student/courses/${courseId}/assignments`);
    return res?.data || { assignments: [] };
  },

  async getStudentAssignment(assignmentId) {
    const res = await apiFetch(`/api/student/assignments/${assignmentId}`);
    return res?.data || null;
  },

  async submitAssignment(assignmentId, payload) {
    const res = await apiFetch(`/api/student/assignments/${assignmentId}/submissions`, {
      method: "POST",
      body: payload,
    });
    return res?.data || null;
  },

  // In-App Notifications
  async getNotifications() {
    const res = await apiFetch("/api/student/notifications");
    return res?.data || { notifications: [], unreadCount: 0 };
  },

  async markNotificationAsRead(notificationId) {
    const res = await apiFetch(`/api/student/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
    return res?.data || null;
  },
};

export default studentApi;

