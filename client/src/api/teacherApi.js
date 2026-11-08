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

  async listCourseStudents(courseId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/students`);
    return res?.data || { students: [] };
  },

  async enrollExistingStudent(courseId, email) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/students/enroll`, {
      method: "POST",
      body: { email },
    });
    return res?.data || null;
  },

  async createAndEnrollStudent(courseId, payload) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/students/create`, {
      method: "POST",
      body: payload,
    });
    return res?.data || null;
  },

  async updateStudentEnrollmentStatus(courseId, studentId, status) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/students/${studentId}/status`, {
      method: "PATCH",
      body: { status },
    });
    return res?.data || null;
  },

  async removeStudentFromCourse(courseId, studentId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/students/${studentId}`, {
      method: "DELETE",
    });
    return res?.data || null;
  },

  async getStudentProgress(courseId, studentId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/students/${studentId}/progress`);
    return res?.data || null;
  },

  // Content Access Management (Module & Lesson Unlocking)
  async getCourseContentAccess(courseId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/content-access`);
    return res?.data || null;
  },

  async getStudentContentAccess(courseId, studentId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/content-access/students/${studentId}`);
    return res?.data || null;
  },

  async updateModuleAccess(courseId, { moduleName, unlocked, studentId = null }) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/content-access/modules`, {
      method: "PATCH",
      body: { moduleName, unlocked, studentId },
    });
    return res?.data || null;
  },

  async updateLessonAccess(courseId, lessonId, { unlocked, studentId = null }) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/content-access/lessons/${lessonId}`, {
      method: "PATCH",
      body: { unlocked, studentId },
    });
    return res?.data || null;
  },

  async bulkUnlockAll(courseId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/content-access/unlock-all`, {
      method: "POST",
    });
    return res?.data || null;
  },

  async bulkLockAll(courseId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/content-access/lock-all`, {
      method: "POST",
    });
    return res?.data || null;
  },

  // Homework & Assignment Management
  async listAssignments(courseId) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/assignments`);
    return res?.data?.assignments || [];
  },

  async createAssignment(courseId, payload) {
    const res = await apiFetch(`/api/teacher/courses/${courseId}/assignments`, {
      method: "POST",
      body: payload,
    });
    return res?.data?.assignment || null;
  },

  async getAssignment(assignmentId) {
    const res = await apiFetch(`/api/teacher/assignments/${assignmentId}`);
    return res?.data?.assignment || null;
  },

  async updateAssignment(assignmentId, payload) {
    const res = await apiFetch(`/api/teacher/assignments/${assignmentId}`, {
      method: "PATCH",
      body: payload,
    });
    return res?.data?.assignment || null;
  },

  async toggleAssignmentStatus(assignmentId, isEnabled) {
    const res = await apiFetch(`/api/teacher/assignments/${assignmentId}/status`, {
      method: "PATCH",
      body: { isEnabled },
    });
    return res?.data || null;
  },

  async listAssignmentSubmissions(assignmentId) {
    const res = await apiFetch(`/api/teacher/assignments/${assignmentId}/submissions`);
    return res?.data || null;
  },

  async getStudentSubmissionHistory(assignmentId, studentId) {
    const res = await apiFetch(`/api/teacher/assignments/${assignmentId}/submissions/${studentId}`);
    return res?.data || null;
  },

  async reviewSubmission(assignmentId, submissionId) {
    const res = await apiFetch(`/api/teacher/assignments/${assignmentId}/submissions/${submissionId}/review`, {
      method: "PATCH",
    });
    return res?.data || null;
  },

  // Notifications
  async getNotifications() {
    const res = await apiFetch("/api/teacher/notifications");
    return res?.data || { notifications: [], unreadCount: 0 };
  },

  async markNotificationAsRead(notificationId) {
    const res = await apiFetch(`/api/teacher/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
    return res?.data || null;
  },
};

export default teacherApi;
