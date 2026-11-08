import { Router } from "express";
import multer from "multer";
import path from "path";
import {
    getProfile,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    requestEmailChange,
    verifyEmailChange,
    getDashboard,
    getEnrolledCourse,
    getLessonPlayback,
    saveProgress,
    submitPaymentProof,
    listDevices,
    revokeDevice,
    listCourseAssignments,
    getStudentAssignment,
    submitAssignment,
    getNotifications,
    markNotificationAsRead,
} from "../controllers/studentController.js";
import { requireApiAuth, requireApiStudent, sendApiError } from "../middleware/apiAuth.js";

const router = Router();

// Multer memory storage configured strictly below Vercel's 4.5 MB request-body limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        const ext = path.extname(file.originalname || "").toLowerCase();
        const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];

        if (allowedMimes.includes(file.mimetype.toLowerCase()) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("INVALID_IMAGE_TYPE: Only JPEG, PNG, and WebP images are allowed."));
        }
    },
});

// All routes require authenticated session
router.use(requireApiAuth, requireApiStudent);

// Student Profile & Account (F01)
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.post(
    "/profile/avatar",
    (req, res, next) => {
        upload.single("avatar")(req, res, (err) => {
            if (err) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return sendApiError(res, 400, "Image size exceeds 4 MB limit.", "FILE_TOO_LARGE");
                }
                return sendApiError(res, 400, err.message || "File upload error", "UPLOAD_ERROR");
            }
            next();
        });
    },
    uploadAvatar
);
router.delete("/profile/avatar", deleteAvatar);
router.post("/profile/email-change", requestEmailChange);
router.post("/profile/email-verify", verifyEmailChange);

// Dashboard
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

// Homework & Assignment Management (Student)
router.get("/courses/:courseId/assignments", listCourseAssignments);
router.get("/assignments/:assignmentId", getStudentAssignment);
router.post("/assignments/:assignmentId/submissions", submitAssignment);

// In-App Notifications
router.get("/notifications", getNotifications);
router.patch("/notifications/:notificationId/read", markNotificationAsRead);

export default router;
