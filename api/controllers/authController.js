import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { sendApiError, sendApiSuccess } from "../middleware/apiAuth.js";
import { loginRateLimiter } from "../../middleware/rateLimiter.js";

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
            req.session.destroy(() => {});
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
 * Changes password for authenticated user
 */
export async function changePassword(req, res, next) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 12) {
            return sendApiError(res, 400, "New password must be at least 12 characters long.", "PASSWORD_TOO_SHORT");
        }

        const user = await User.findById(req.session.user.id).select("+passwordHash");
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        // If user was not forced to change password, verify current password
        if (!user.mustChangePassword && currentPassword) {
            const matches = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!matches) {
                return sendApiError(res, 400, "Current password does not match.", "INVALID_CURRENT_PASSWORD");
            }
        }

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        user.mustChangePassword = false;
        await user.save();

        req.session.user.mustChangePassword = false;
        req.session.save((saveErr) => {
            if (saveErr) return next(saveErr);
            return sendApiSuccess(res, 200, null, "Password updated successfully");
        });
    } catch (error) {
        next(error);
    }
}
