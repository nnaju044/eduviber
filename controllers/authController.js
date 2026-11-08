import crypto from "crypto";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail, sendPasswordResetSuccessEmail } from "../services/emailService.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";
import { invalidateAllUserSessions } from "../services/sessionSecurityService.js";
import { revokeAllStudentDevices } from "../services/deviceService.js";

export function showLogin(req, res) {
    if (req.session.user) {
        const isAdmin = req.session.user.role === "admin" || req.session.user.role === "super_admin";
        const isTeacher = req.session.user.role === "teacher";
        return res.redirect(
            isAdmin ? "/app/admin" : isTeacher ? "/app/teacher" : "/app/student"
        );
    }

    // Redirect legacy /login to canonical React /app/login, preserving query string
    const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(302, `/app/login${queryString}`);
}

export async function login(req, res, next) {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        const user = await User.findOne({ email }).select("+passwordHash");

        if (
            !user ||
            !user.isActive ||
            !(await bcrypt.compare(password, user.passwordHash))
        ) {
            return res.status(401).render("auth/login", {
                error: "Invalid email or password, or account unavailable.",
            });
        }

        // Reset rate limiter on successful credentials
        loginRateLimiter.reset(req);

        await new Promise((resolve, reject) => {
            req.session.regenerate((error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Ensure newly authenticated session immediately has a fresh CSRF token
        req.session.csrfToken = crypto.randomBytes(24).toString("hex");

        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role === "admin" ? "super_admin" : user.role,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
            teacherProfile: user.teacherProfile || null,
        };

        req.session.save((error) => {
            if (error) return next(error);

            if (user.mustChangePassword) {
                return res.redirect("/change-password");
            }

            const isAdmin = user.role === "admin" || user.role === "super_admin";
            return res.redirect(
                isAdmin ? "/admin" : "/dashboard"
            );
        });
    } catch (error) {
        next(error);
    }
}

export function logout(req, res, next) {
    req.session.destroy((error) => {
        if (error) return next(error);

        res.clearCookie("course.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        res.redirect("/login");
    });
}

export function showChangePassword(req, res) {
    res.render("auth/change-password", { error: null });
}

export async function changePassword(req, res, next) {
    try {
        const password = String(req.body.password || "");
        const confirmation = String(req.body.confirmPassword || "");

        if (password.length < 12) {
            return res.status(400).render("auth/change-password", {
                error: "Use a password with at least 12 characters.",
            });
        }

        if (password !== confirmation) {
            return res.status(400).render("auth/change-password", {
                error: "The passwords do not match.",
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            {
                passwordHash,
                mustChangePassword: false,
            },
            { returnDocument: "after" }
        );

        if (!user || !user.isActive) {
            req.session.destroy(() => { });
            return res.redirect("/login");
        }

        req.session.user.mustChangePassword = false;

        req.session.save((error) => {
            if (error) return next(error);

            const isAdmin = user.role === "admin" || user.role === "super_admin";
            res.redirect(isAdmin ? "/admin" : "/dashboard");
        });
    } catch (error) {
        next(error);
    }
}

export function showForgotPassword(req, res) {
    if (req.session?.user) {
        const isAdmin = req.session.user.role === "admin" || req.session.user.role === "super_admin";
        return res.redirect(
            isAdmin ? "/admin" : "/dashboard"
        );
    }
    res.render("auth/forgot-password", {
        error: null,
        submitted: false,
        email: "",
    });
}

export async function forgotPassword(req, res, next) {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();

        if (!email) {
            return res.status(400).render("auth/forgot-password", {
                error: "Please enter your registered email address.",
                submitted: false,
                email: "",
            });
        }

        const user = await User.findOne({ email });

        // Generic confirmation to prevent user enumeration
        if (!user || !user.isActive) {
            return res.render("auth/forgot-password", {
                error: null,
                submitted: true,
                email,
            });
        }

        // Generate cryptographically secure random token (32 bytes hex)
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

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        // Send email non-blockingly (errors logged in service without failing the HTTP response)
        sendPasswordResetEmail({ user, resetToken, baseUrl }).catch((err) => {
            console.error("[ForgotPassword] Error sending reset email:", err.message);
        });

        res.render("auth/forgot-password", {
            error: null,
            submitted: true,
            email,
        });
    } catch (error) {
        next(error);
    }
}

export async function showResetPassword(req, res, next) {
    try {
        const token = String(req.query.token || "").trim();

        if (!token) {
            return res.status(400).render("auth/reset-password", {
                invalidToken: true,
                error: "A password reset token is required.",
                token: "",
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpires: { $gt: new Date() },
        });

        if (!user || !user.isActive) {
            return res.status(400).render("auth/reset-password", {
                invalidToken: true,
                error: "This password reset link is invalid, has expired, or has already been used.",
                token: "",
            });
        }

        res.render("auth/reset-password", {
            invalidToken: false,
            error: null,
            token,
        });
    } catch (error) {
        next(error);
    }
}

export async function resetPassword(req, res, next) {
    try {
        const token = String(req.body.token || "").trim();
        const password = String(req.body.password || "");
        const confirmPassword = String(req.body.confirmPassword || "");

        if (!token) {
            return res.status(400).render("auth/reset-password", {
                invalidToken: true,
                error: "A reset token is required.",
                token: "",
            });
        }

        if (password.length < 12) {
            return res.status(400).render("auth/reset-password", {
                invalidToken: false,
                token,
                error: "Password must be at least 12 characters long.",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).render("auth/reset-password", {
                invalidToken: false,
                token,
                error: "The passwords do not match.",
            });
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
            return res.status(400).render("auth/reset-password", {
                invalidToken: true,
                error: "This password reset link is invalid, has expired, or has already been used.",
                token: "",
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        user.passwordHash = passwordHash;
        user.resetPasswordTokenHash = undefined;
        user.resetPasswordExpires = undefined;
        user.mustChangePassword = false;
        await user.save();

        // 1. Invalidate every active session belonging to this student across all browsers
        await invalidateAllUserSessions(user._id);

        // 2. Revoke all registered streaming devices
        await revokeAllStudentDevices(user._id, res);

        // 3. Clear session cookie & destroy current session
        if (req.session) {
            await new Promise((resolve) => req.session.destroy(() => resolve()));
        }
        res.clearCookie("course.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        // 4. Dispatch security confirmation email
        sendPasswordResetSuccessEmail({ user }).catch((err) => {
            console.error("[ResetPassword] Error dispatching security email:", err.message);
        });

        res.redirect("/app/login?reset=success");
    } catch (error) {
        next(error);
    }
}