import { apiFetch } from "./client.js";

export const teacherApi = {
  // Overview & Stats
  async getStats() {
    const res = await apiFetch("/api/teacher/stats");
    return res?.data?.stats || null;
  },

  // Profile
  async getProfile() {
    const res = await apiFetch("/api/teacher/profile");
    return res?.data?.profile || null;
  },

  async updateProfile(payload) {
    const res = await apiFetch("/api/teacher/profile", {
      method: "PATCH",
      body: payload,
    });
    return res?.data?.profile || null;
  },

  // Courses
  async listCourses() {
    const res = await apiFetch("/api/teacher/courses");
    return res?.data?.courses || [];
  },

  async getCourse(id) {
    const res = await apiFetch(`/api/teacher/courses/${id}`);
    return res?.data || null; // returns { course, lessons }
  },

  async createCourse(payload) {
    const res = await apiFetch("/api/teacher/courses", {
      method: "POST",
      body: payload,
    });
    return res?.data?.course || null;
  },

  async updateCourse(id, payload) {
    const res = await apiFetch(`/api/teacher/courses/${id}`, {
      method: "PATCH",
      body: payload,
    });
    return res?.data?.course || null;
  },

  async deleteCourse(id) {
    return apiFetch(`/api/teacher/courses/${id}`, {
      method: "DELETE",
    });
  },

  async toggleCoursePublication(id) {
    const res = await apiFetch(`/api/teacher/courses/${id}/toggle-publication`, {
      method: "POST",
    });
    return res?.data?.course || null;
  },

  // Lessons
  async listLessons(courseId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/lessons`);
    return res?.data?.lessons || [];
  },

  async createLesson(courseId, payload) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/lessons`, {
      method: "POST",
      body: payload,
    });
    return res?.data?.lesson || null;
  },

  async updateLesson(courseId, lessonId, payload) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/lessons/${lessonId}`, {
      method: "PATCH",
      body: payload,
    });
    return res?.data?.lesson || null;
  },

  async deleteLesson(courseId, lessonId) {
    return apiFetch(`/api/teacher/courses/${courseId}/lessons/${lessonId}`, {
      method: "DELETE",
    });
  },

  // Bunny Stream Video Integration
  async uploadLessonVideo(courseId, payload) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/upload-video`, {
      method: "POST",
      body: payload,
    });
    return res?.data?.video || null;
  },

  async getVideoStatus(videoId) {
    const res = await apiFetch(`/api/teacher/videos/${videoId}/status`);
    return res?.data?.status || null;
  },

  // Student Directory & Progress
  async listStudents() {
    const res = await apiFetch("/api/teacher/students");
    return res?.data?.students || [];
  },

  async getStudentProgress(courseId, studentId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/students/${studentId}/progress`);
    return res?.data || null;
  },
};

export default teacherApi;
