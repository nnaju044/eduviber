import { Router } from "express";
import {
    getCsrfToken,
    getMe,
    login,
    logout,
    changePassword,
    forgotPassword,
    resetPassword,
} from "../controllers/authController.js";
import { requireApiAuth } from "../middleware/apiAuth.js";
import { loginRateLimiter, forgotPasswordRateLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// CSRF token generation
router.get("/csrf-token", getCsrfToken);

// Authentication & Session
router.get("/me", requireApiAuth, getMe);
router.post("/login", loginRateLimiter.middleware(), login);
router.post("/logout", requireApiAuth, logout);
router.post("/change-password", requireApiAuth, changePassword);

// Password Recovery API Parity
router.post("/forgot-password", forgotPasswordRateLimiter.middleware(), forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
