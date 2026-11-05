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
};

export default studentApi;

