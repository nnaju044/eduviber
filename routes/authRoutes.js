import { Router } from "express";
import {
    showLogin,
    login,
    logout,
    showChangePassword,
    changePassword,
    showForgotPassword,
    forgotPassword,
    showResetPassword,
    resetPassword,
} from "../controllers/authController.js";
import {
    requireAuth,
    requireAdmin,
} from "../middleware/requireAuth.js";
import {
    loginRateLimiter,
    forgotPasswordRateLimiter,
} from "../middleware/rateLimiter.js";

const router = Router();

router.get("/login", showLogin);
router.post("/login", loginRateLimiter.middleware(), login);
router.post("/logout", requireAuth, logout);

router.get("/forgot-password", showForgotPassword);
router.post("/forgot-password", forgotPasswordRateLimiter.middleware(), forgotPassword);

router.get("/reset-password", showResetPassword);
router.post("/reset-password", resetPassword);

router.get("/change-password", requireAuth, showChangePassword);
router.post("/change-password", requireAuth, changePassword);

export default router;