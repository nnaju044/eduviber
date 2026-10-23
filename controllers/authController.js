import crypto from "crypto";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";

export function showLogin(req, res) {
    if (req.session.user) {
        return res.redirect(
            req.session.user.role === "admin" ? "/admin" : "/dashboard"
        );
    }

    const message =
        req.query.reset === "success"
            ? "Your password has been reset successfully. Please sign in with your new password."
            : null;

    res.render("auth/login", { error: null, message });
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

        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
        };

        req.session.save((error) => {
            if (error) return next(error);

            if (user.mustChangePassword) {
                return res.redirect("/change-password");
            }

            return res.redirect(
                user.role === "admin" ? "/admin" : "/dashboard"
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

            res.redirect(user.role === "admin" ? "/admin" : "/dashboard");
        });
    } catch (error) {
        next(error);
    }
}

export function showForgotPassword(req, res) {
    if (req.session?.user) {
        return res.redirect(
            req.session.user.role === "admin" ? "/admin" : "/dashboard"
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

        // Invalidate or renew existing session to prevent session fixation / stale state
        if (req.session) {
            await new Promise((resolve) => req.session.destroy(() => resolve()));
            res.clearCookie("course.sid", {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
            });
        }

        res.redirect("/login?reset=success");
    } catch (error) {
        next(error);
    }
}