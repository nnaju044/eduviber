import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { sendApiError, sendApiSuccess } from "../middleware/apiAuth.js";
import { loginRateLimiter } from "../../middleware/rateLimiter.js";
import { invalidateAllUserSessions } from "../../services/sessionSecurityService.js";
import { revokeAllStudentDevices } from "../../services/deviceService.js";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "../../services/emailService.js";

/**
 * Endpoint to obtain the session-backed CSRF token for API requests
 */
export function getCsrfToken(req, res) {
    if (!req.session) {
        return sendApiError(res, 500, "Session store unavailable", "SESSION_ERROR");
    }

    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }

    return sendApiSuccess(res, 200, {
        csrfToken: req.session.csrfToken,
    }, "CSRF token generated successfully");
}

/**
 * Returns current authenticated session profile
 */
export async function getMe(req, res, next) {
    try {
        if (!req.session?.user) {
            return sendApiError(res, 401, "Not authenticated", "UNAUTHORIZED");
        }

        const user = await User.findById(req.session.user.id).select("-passwordHash");
        if (!user || !user.isActive) {
            req.session.destroy(() => { });
            return sendApiError(res, 403, "Account is unavailable or inactive.", "ACCOUNT_INACTIVE");
        }

        return sendApiSuccess(res, 200, {
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone || "",
                role: user.role === "admin" ? "super_admin" : user.role,
                isActive: user.isActive,
                mustChangePassword: user.mustChangePassword,
                teacherProfile: user.teacherProfile || null,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Authenticates user via JSON API
 */
export async function login(req, res, next) {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!email || !password) {
            return sendApiError(res, 400, "Email and password are required.", "INVALID_INPUT");
        }

        const user = await User.findOne({ email }).select("+passwordHash");

        if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
            return sendApiError(res, 401, "Invalid email or password, or account unavailable.", "INVALID_CREDENTIALS");
        }

        // Reset rate limiter on successful auth
        loginRateLimiter.reset(req);

        // Regenerate session to prevent fixation
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Seed fresh CSRF token for the new session
        req.session.csrfToken = crypto.randomBytes(24).toString("hex");

        const normalizedRole = user.role === "admin" ? "super_admin" : user.role;

        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: normalizedRole,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
            teacherProfile: user.teacherProfile || null,
        };

        req.session.save((saveErr) => {
            if (saveErr) return next(saveErr);

            return sendApiSuccess(res, 200, {
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: normalizedRole,
                    isActive: user.isActive,
                    mustChangePassword: user.mustChangePassword,
                    teacherProfile: user.teacherProfile || null,
                },
                csrfToken: req.session.csrfToken,
            }, "Authentication successful");
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Logs out and destroys the session
 */
export function logout(req, res, next) {
    if (!req.session) {
        return sendApiSuccess(res, 200, null, "Already logged out");
    }

    req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("course.sid");
        return sendApiSuccess(res, 200, null, "Logged out successfully");
    });
}

/**
 * Changes password for authenticated user (F02)
 * Enforces:
 * - Current password verification (unless mustChangePassword is true)
 * - Minimum 12 character length
 * - Confirmation match check (if confirmPassword provided)
 * - Password reuse rejection (new password cannot equal current)
 * - Global session invalidation across all devices/browsers
 * - Revocation of all registered E12 streaming devices
 * - Dispatch of security notification email
 * - Destruction of current session and clearing of session cookie
 */
export async function changePassword(req, res, next) {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!newPassword || newPassword.length < 12) {
            return sendApiError(res, 400, "New password must be at least 12 characters long.", "PASSWORD_TOO_SHORT");
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return sendApiError(res, 400, "New password and confirmation do not match.", "PASSWORDS_DO_NOT_MATCH");
        }

        const userId = req.session.user.id;
        const user = await User.findById(userId).select("+passwordHash");
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        // Verify current password
        if (!user.mustChangePassword) {
            if (!currentPassword) {
                return sendApiError(res, 400, "Current password is required.", "CURRENT_PASSWORD_REQUIRED");
            }
            const matches = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!matches) {
                return sendApiError(res, 400, "Current password does not match.", "INVALID_CURRENT_PASSWORD");
            }
        }

        // Prevent password reuse
        if (currentPassword && currentPassword === newPassword) {
            return sendApiError(res, 400, "New password cannot be the same as your current password.", "PASSWORD_REUSED");
        }
        const matchesExisting = await bcrypt.compare(newPassword, user.passwordHash);
        if (matchesExisting) {
            return sendApiError(res, 400, "New password cannot be the same as your current password.", "PASSWORD_REUSED");
        }

        user.passwordHash = await bcrypt.hash(newPassword, 12);
        user.mustChangePassword = false;
        await user.save();

        // 1. Invalidate all active sessions for this user across all devices/browsers
        await invalidateAllUserSessions(userId);

        // 2. Revoke all registered device tokens
        await revokeAllStudentDevices(userId, res);

        // 3. Clear session cookie & destroy current session
        res.clearCookie("course.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });

        if (req.session) {
            await new Promise((resolve) => req.session.destroy(() => resolve()));
        }

        // 4. Dispatch security alert email to student
        sendPasswordChangedEmail({ user }).catch((err) => {
            console.error("[ChangePassword] Error sending security email:", err.message);
        });

        return sendApiSuccess(res, 200, {
            requiresRelogin: true,
        }, "Password updated successfully. All active sessions have been signed out. Please log in again.");
    } catch (error) {
        next(error);
    }
}

/**
 * Initiates password reset by issuing a cryptographically secure token
 * and dispatching a reset email.
 * Always returns a generic confirmation message to prevent user enumeration.
 */
export async function forgotPassword(req, res, next) {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();

        if (!email) {
            return sendApiError(res, 400, "Please enter your registered email address.", "INVALID_INPUT");
        }

        const user = await User.findOne({ email });

        // Generic response if account doesn't exist or is inactive to prevent account enumeration
        if (!user || !user.isActive) {
            return sendApiSuccess(
                res,
                200,
                null,
                "If an active account exists with that email address, password reset instructions have been sent."
            );
        }

        // Generate cryptographically secure random token (32 bytes hex = 64 characters)
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Hash token with SHA-256 for database storage
        const tokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        // Token valid for 1 hour
        user.resetPasswordTokenHash = tokenHash;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();

        const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

        // Send email non-blockingly
        sendPasswordResetEmail({ user, resetToken, baseUrl }).catch((err) => {
            console.error("[ApiForgotPassword] Error sending reset email:", err.message);
        });

        return sendApiSuccess(
            res,
            200,
            null,
            "If an active account exists with that email address, password reset instructions have been sent."
        );
    } catch (error) {
        next(error);
    }
}

/**
 * Resets user password using a verified token.
 * Enforces:
 * - Minimum 12 character length
 * - Confirmation match check (if confirmPassword provided)
 * - Token verification & single-use guarantee (clears token on success)
 * - Password reuse rejection (new password cannot equal current)
 * - Global session invalidation across all devices/browsers
 * - Revocation of all registered E12 streaming devices
 * - Dispatch of security notification email
 */
export async function resetPassword(req, res, next) {
    try {
        const token = String(req.body.token || "").trim();
        const password = String(req.body.password || "");
        const confirmPassword = req.body.confirmPassword !== undefined ? String(req.body.confirmPassword) : undefined;

        if (!token) {
            return sendApiError(res, 400, "A reset token is required.", "INVALID_TOKEN");
        }

        if (password.length < 12) {
            return sendApiError(res, 400, "Password must be at least 12 characters long.", "PASSWORD_TOO_SHORT");
        }

        if (confirmPassword !== undefined && password !== confirmPassword) {
            return sendApiError(res, 400, "The passwords do not match.", "PASSWORDS_DO_NOT_MATCH");
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpires: { $gt: new Date() },
        }).select("+passwordHash");

        if (!user || !user.isActive) {
            return sendApiError(
                res,
                400,
                "This password reset link is invalid, has expired, or has already been used.",
                "INVALID_OR_EXPIRED_TOKEN"
            );
        }

        // Prevent password reuse
        if (user.passwordHash) {
            const matchesExisting = await bcrypt.compare(password, user.passwordHash);
            if (matchesExisting) {
                return sendApiError(res, 400, "New password cannot be the same as your previous password.", "PASSWORD_REUSED");
            }
        }

        const passwordHash = await bcrypt.hash(password, 12);
        user.passwordHash = passwordHash;
        user.resetPasswordTokenHash = undefined;
        user.resetPasswordExpires = undefined;
        user.mustChangePassword = false;
        await user.save();

        // 1. Invalidate all active sessions across all devices/browsers
        await invalidateAllUserSessions(user._id);

        // 2. Revoke all registered streaming devices
        await revokeAllStudentDevices(user._id, res);

        // 3. Clear session cookie & destroy current session if one exists
        res.clearCookie("course.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });

        if (req.session) {
            await new Promise((resolve) => req.session.destroy(() => resolve()));
        }

        // 4. Send confirmation alert email
        sendPasswordChangedEmail({ user }).catch((err) => {
            console.error("[ApiResetPassword] Error sending security email:", err.message);
        });

        return sendApiSuccess(
            res,
            200,
            { requiresRelogin: true },
            "Password has been successfully reset. Please log in with your new password."
        );
    } catch (error) {
        next(error);
    }
}
