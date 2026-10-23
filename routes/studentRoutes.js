import { Router } from "express";
import {
    watchLesson,
    saveLessonProgress,
    studentDashboard,
} from "../controllers/studentController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/dashboard", requireAuth, studentDashboard);

router.get(
    "/courses/:courseId/lessons/:lessonId/watch",
    requireAuth,
    watchLesson
);

router.post(
    "/courses/:courseId/lessons/:lessonId/progress",
    requireAuth,
    saveLessonProgress
);

export default router;