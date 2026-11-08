export function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    if (!req.session.user.isActive) {
        return res.status(403).send("Your account is inactive.");
    }

    if (req.session.user.mustChangePassword) {
        if (req.path === "/change-password") {
            return next();
        }

        return res.redirect("/change-password");
    }

    next();
}

export function requireSuperAdmin(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    if (!req.session.user.isActive) {
        return res.status(403).send("Your account is inactive.");
    }

    if (req.session.user.mustChangePassword) {
        if (req.path === "/change-password") {
            return next();
        }
        return res.redirect("/change-password");
    }

    const role = req.session.user.role;
    if (role !== "super_admin" && role !== "admin") {
        return res.status(403).send("Super Administrator access required.");
    }

    next();
}

/**
 * Backward-compatible admin alias: delegates to requireSuperAdmin
 */
export function requireAdmin(req, res, next) {
    return requireSuperAdmin(req, res, next);
}

/**
 * Teacher authorization guard:
 * - Requires authenticated session
 * - Requires active account
 * - Requires forced password change to be completed
 * - Grants access to approved teachers (isApproved: true) and Super Admins (oversight)
 * - Rejects unapproved teachers with HTTP 403
 */
export function requireTeacher(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    if (!req.session.user.isActive) {
        return res.status(403).send("Your account is inactive.");
    }

    if (req.session.user.mustChangePassword) {
        if (req.path === "/change-password") {
            return next();
        }
        return res.redirect("/change-password");
    }

    const role = req.session.user.role;

    // Super Admin has global oversight
    if (role === "super_admin" || role === "admin") {
        return next();
    }

    if (role === "teacher") {
        if (!req.session.user.teacherProfile?.isApproved) {
            return res.status(403).send("Teacher account pending approval.");
        }
        return next();
    }

    return res.status(403).send("Teacher access required.");
}