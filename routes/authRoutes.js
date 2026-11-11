import { Router } from "express";
import {
    login,
    logout,
    changePassword,
    forgotPassword,
    resetPassword,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { loginRateLimiter, forgotPasswordRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Compatibility redirects for legacy GET endpoints to canonical React SPA routes
router.get("/login", (req, res) => res.redirect(302, "/app/login"));
router.get("/forgot-password", (req, res) => res.redirect(302, "/app/forgot-password"));
router.get("/reset-password", (req, res) => {
    const token = req.query.token ? `?token=${encodeURIComponent(req.query.token)}` : "";
    res.redirect(302, `/app/reset-password${token}`);
});
router.get("/change-password", (req, res) => res.redirect(302, "/app/student/settings"));

// Legacy Form POST Handlers (preserved for backward compatibility, alongside /api/auth/*)
router.post("/login", loginRateLimiter.middleware(), login);
router.post("/logout", requireAuth, logout);
router.post("/forgot-password", forgotPasswordRateLimiter.middleware(), forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", requireAuth, changePassword);

export default router;
