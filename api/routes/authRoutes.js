import { Router } from "express";
import {
    getCsrfToken,
    getMe,
    login,
    logout,
    changePassword,
} from "../controllers/authController.js";
import { requireApiAuth } from "../middleware/apiAuth.js";
import { loginRateLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// CSRF token generation
router.get("/csrf-token", getCsrfToken);

// Authentication & Session
router.get("/me", requireApiAuth, getMe);
router.post("/login", loginRateLimiter.middleware(), login);
router.post("/logout", requireApiAuth, logout);
router.post("/change-password", requireApiAuth, changePassword);

export default router;
