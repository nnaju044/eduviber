import { Router } from "express";
import { saveLessonProgress } from "../controllers/studentController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Redirect legacy student endpoints to canonical React SPA routes
router.get("/dashboard", requireAuth, (req, res) => res.redirect(302, "/app/student"));
router.get("/courses/:courseId/lessons/:lessonId/watch", requireAuth, (req, res) => {
    res.redirect(302, `/app/student/courses/${encodeURIComponent(req.params.courseId)}`);
});

// Legacy POST progress endpoint
router.post(
    "/courses/:courseId/lessons/:lessonId/progress",
    requireAuth,
    saveLessonProgress
);

export default router;
