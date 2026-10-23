import { Router } from "express";
import {
    dashboard,
    listCourses,
    showCreateCourse,
    createCourse,
    showEditCourse,
    updateCourse,
    deleteCourse,
    toggleCoursePublication,
    listLessons,
    showCreateLesson,
    createLesson,
    showEditLesson,
    updateLesson,
    deleteLesson,
    toggleLessonPublication,
    listStudents,
    showCreateStudent,
    createStudent,
    showStudentDetail,
    listEnrollments,
    createEnrollment,
    updateEnrollmentStatus,
    listPayments,
    approvePayment,
    rejectPayment,
} from "../controllers/adminController.js";
import { requireAuth, requireAdmin } from "../middleware/requireAuth.js";

const router = Router();

// Every route in this file requires an authenticated admin.
router.use(requireAuth, requireAdmin);

router.get("/", dashboard);

// Courses
router.get("/courses", listCourses);
router.get("/courses/new", showCreateCourse);
router.post("/courses", createCourse);
router.get("/courses/:id/edit", showEditCourse);
router.post("/courses/:id", updateCourse);
router.post("/courses/:id/delete", deleteCourse);
router.post("/courses/:id/toggle-publication", toggleCoursePublication);

// Lessons
router.get("/courses/:courseId/lessons", listLessons);
router.get("/courses/:courseId/lessons/new", showCreateLesson);
router.post("/courses/:courseId/lessons", createLesson);
router.get("/courses/:courseId/lessons/:lessonId/edit", showEditLesson);
router.post("/courses/:courseId/lessons/:lessonId", updateLesson);
router.post("/courses/:courseId/lessons/:lessonId/delete", deleteLesson);
router.post("/courses/:courseId/lessons/:lessonId/toggle-publication", toggleLessonPublication);

// Students
router.get("/students", listStudents);
router.get("/students/new", showCreateStudent);
router.post("/students", createStudent);
router.get("/students/:id", showStudentDetail);

// Enrollments
router.get("/enrollments", listEnrollments);
router.post("/enrollments", createEnrollment);
router.post("/enrollments/:id/status", updateEnrollmentStatus);

// Payments Review
router.get("/payments", listPayments);
router.post("/payments/:id/approve", approvePayment);
router.post("/payments/:id/reject", rejectPayment);

export default router;