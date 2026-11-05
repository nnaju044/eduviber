import { Router } from "express";
import {
    getTeacherStats,
    getProfile,
    updateProfile,
    listCourses,
    createCourse,
    getCourse,
    updateCourse,
    deleteCourse,
    toggleCoursePublication,
    listLessons,
    createLesson,
    updateLesson,
    deleteLesson,
    uploadLessonVideo,
    getVideoStatus,
    listStudents,
    getStudentCourseProgress,
} from "../controllers/teacherController.js";
import { requireApiTeacher, requireApiTeacherBase } from "../middleware/apiAuth.js";

const router = Router();

// Routes accessible to all authenticated teachers (including pending approval)
router.get("/stats", requireApiTeacherBase, getTeacherStats);
router.get("/profile", requireApiTeacherBase, getProfile);
router.patch("/profile", requireApiTeacherBase, updateProfile);

// Routes strictly requiring an APPROVED Teacher (or Super Admin)
router.get("/courses", requireApiTeacher, listCourses);
router.post("/courses", requireApiTeacher, createCourse);
router.get("/courses/:id", requireApiTeacher, getCourse);
router.patch("/courses/:id", requireApiTeacher, updateCourse);
router.delete("/courses/:id", requireApiTeacher, deleteCourse);
router.post("/courses/:id/toggle-publication", requireApiTeacher, toggleCoursePublication);

// Lessons (strictly scoped by courseId ownership)
router.get("/courses/:courseId/lessons", requireApiTeacher, listLessons);
router.post("/courses/:courseId/lessons", requireApiTeacher, createLesson);
router.patch("/courses/:courseId/lessons/:lessonId", requireApiTeacher, updateLesson);
router.put("/courses/:courseId/lessons/:lessonId", requireApiTeacher, updateLesson);
router.delete("/courses/:courseId/lessons/:lessonId", requireApiTeacher, deleteLesson);

// Video Upload & Bunny Stream Integration
router.post("/courses/:courseId/upload-video", requireApiTeacher, uploadLessonVideo);
router.get("/videos/:videoId/status", requireApiTeacher, getVideoStatus);

// Students & Course Progress Monitoring
router.get("/students", requireApiTeacher, listStudents);
router.get("/courses/:courseId/students/:studentId/progress", requireApiTeacher, getStudentCourseProgress);

export default router;

