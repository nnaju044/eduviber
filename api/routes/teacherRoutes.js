import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
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
    listCourseStudents,
    enrollExistingStudent,
    createAndEnrollStudent,
    updateStudentEnrollmentStatus,
    removeStudentFromCourse,
    getStudentCourseProgress,
    getCourseContentAccess,
    getStudentContentAccess,
    updateModuleAccess,
    updateLessonAccess,
    bulkUnlockAll,
    bulkLockAll,
    listAssignments,
    createAssignment,
    getAssignment,
    updateAssignment,
    toggleAssignmentStatus,
    listAssignmentSubmissions,
    getStudentSubmissionHistory,
    reviewSubmission,
} from "../controllers/teacherController.js";
import { requireApiAuth, requireApiTeacher, requireApiTeacherBase, sendApiError } from "../middleware/apiAuth.js";
import { getNotifications, markNotificationAsRead } from "../controllers/studentController.js";

const router = Router();

// Configure disk storage in temp directory for streaming large video files without memory bloat
const videoDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname || "").toLowerCase() || ".mp4";
        cb(null, `eduvibe-video-${uniqueSuffix}${ext}`);
    },
});

const videoUpload = multer({
    storage: videoDiskStorage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-matroska",
        ];
        const ext = path.extname(file.originalname || "").toLowerCase();
        const allowedExts = [".mp4", ".webm", ".mov", ".avi", ".mkv"];

        if (allowedMimes.includes(file.mimetype.toLowerCase()) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("INVALID_VIDEO_FORMAT: Only MP4, WebM, MOV, AVI, and MKV video files are allowed."));
        }
    },
});

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

// Video Upload & Bunny Stream Integration (Multipart streaming with error handling)
router.post(
    "/courses/:courseId/upload-video",
    requireApiTeacher,
    (req, res, next) => {
        videoUpload.single("video")(req, res, (err) => {
            if (err) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return sendApiError(res, 400, "Video size exceeds maximum 500 MB limit.", "FILE_TOO_LARGE");
                }
                if (err.message && err.message.startsWith("INVALID_VIDEO_FORMAT")) {
                    return sendApiError(res, 400, err.message.replace("INVALID_VIDEO_FORMAT: ", ""), "INVALID_FILE_TYPE");
                }
                return sendApiError(res, 400, err.message || "Video upload failed.", "UPLOAD_ERROR");
            }
            next();
        });
    },
    uploadLessonVideo
);
router.get("/videos/:videoId/status", requireApiTeacher, getVideoStatus);

// Students & Course Progress Monitoring
router.get("/students", requireApiTeacher, listStudents);
router.get("/courses/:courseId/students", requireApiTeacher, listCourseStudents);
router.post("/courses/:courseId/students/enroll", requireApiTeacher, enrollExistingStudent);
router.post("/courses/:courseId/students/create", requireApiTeacher, createAndEnrollStudent);
router.patch("/courses/:courseId/students/:studentId/status", requireApiTeacher, updateStudentEnrollmentStatus);
router.delete("/courses/:courseId/students/:studentId", requireApiTeacher, removeStudentFromCourse);
router.get("/courses/:courseId/students/:studentId/progress", requireApiTeacher, getStudentCourseProgress);

// Teacher-Controlled Content Access (Module & Lesson Unlocking System)
router.get("/courses/:courseId/content-access", requireApiTeacher, getCourseContentAccess);
router.get("/courses/:courseId/content-access/students/:studentId", requireApiTeacher, getStudentContentAccess);
router.patch("/courses/:courseId/content-access/modules", requireApiTeacher, updateModuleAccess);
router.patch("/courses/:courseId/content-access/lessons/:lessonId", requireApiTeacher, updateLessonAccess);
router.post("/courses/:courseId/content-access/unlock-all", requireApiTeacher, bulkUnlockAll);
router.post("/courses/:courseId/content-access/lock-all", requireApiTeacher, bulkLockAll);

// Homework & Assignment Management (Teacher)
router.get("/courses/:courseId/assignments", requireApiTeacher, listAssignments);
router.post("/courses/:courseId/assignments", requireApiTeacher, createAssignment);
router.get("/assignments/:assignmentId", requireApiTeacher, getAssignment);
router.patch("/assignments/:assignmentId", requireApiTeacher, updateAssignment);
router.patch("/assignments/:assignmentId/status", requireApiTeacher, toggleAssignmentStatus);
router.get("/assignments/:assignmentId/submissions", requireApiTeacher, listAssignmentSubmissions);
router.get("/assignments/:assignmentId/submissions/:studentId", requireApiTeacher, getStudentSubmissionHistory);
router.patch("/assignments/:assignmentId/submissions/:submissionId/review", requireApiTeacher, reviewSubmission);

// In-App Notifications (Teacher)
router.get("/notifications", requireApiTeacherBase, getNotifications);
router.patch("/notifications/:notificationId/read", requireApiTeacherBase, markNotificationAsRead);

export default router;

