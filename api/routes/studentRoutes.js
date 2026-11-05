import { Router } from "express";
import {
    getProfile,
    updateProfile,
    getDashboard,
    getEnrolledCourse,
    getLessonPlayback,
    saveProgress,
    submitPaymentProof,
    listDevices,
    revokeDevice,
} from "../controllers/studentController.js";
import { requireApiAuth, requireApiStudent } from "../middleware/apiAuth.js";

const router = Router();

// All routes require authenticated session
router.use(requireApiAuth, requireApiStudent);

// Student Profile & Dashboard
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.get("/dashboard", getDashboard);

// Enrolled Courses & Lesson Playback
router.get("/courses/:courseId", getEnrolledCourse);
router.get("/courses/:courseId/lessons/:lessonId/playback", getLessonPlayback);
router.post("/courses/:courseId/lessons/:lessonId/progress", saveProgress);
router.post("/progress", saveProgress);

// Enrollment & Payment Proof Submission
router.post("/courses/:slug/enroll", submitPaymentProof);

// Device Management
router.get("/devices", listDevices);
router.delete("/devices/:deviceId", revokeDevice);

export default router;
