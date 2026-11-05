import { Router } from "express";
import {
    listTeachers,
    getTeacher,
    createTeacher,
    approveTeacher,
    toggleTeacherStatus,
    listCourses,
    createCourse,
    toggleCoursePublication,
    deleteCourse,
    listStudents,
    getStudent,
    updateEnrollmentStatus,
    listPayments,
    getPayment,
    approvePayment,
    rejectPayment,
    getOverviewStats,
} from "../controllers/adminController.js";
import { requireApiSuperAdmin } from "../middleware/apiAuth.js";

const router = Router();

// Every route in this module requires Super Administrator privileges
router.use(requireApiSuperAdmin);

// Platform Overview Stats
router.get("/stats", getOverviewStats);

// Teacher Management
router.get("/teachers", listTeachers);
router.get("/teachers/:id", getTeacher);
router.post("/teachers", createTeacher);
router.post("/teachers/:id/approve", approveTeacher);
router.post("/teachers/:id/toggle-status", toggleTeacherStatus);

// Course Management (Platform-wide)
router.get("/courses", listCourses);
router.post("/courses", createCourse);
router.post("/courses/:id/toggle-publication", toggleCoursePublication);
router.delete("/courses/:id", deleteCourse);

// Student & Enrollment Management
router.get("/students", listStudents);
router.get("/students/:id", getStudent);
router.patch("/enrollments/:id/status", updateEnrollmentStatus);

// Payment Review & Financial Snapshots
router.get("/payments", listPayments);
router.get("/payments/:id", getPayment);
router.post("/payments/:id/approve", approvePayment);
router.post("/payments/:id/reject", rejectPayment);

export default router;
