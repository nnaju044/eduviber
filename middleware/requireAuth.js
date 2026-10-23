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

export function requireAdmin(req, res, next) {
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

    if (req.session.user.role !== "admin") {
        return res.status(403).send("Administrator access required.");
    }

    next();
}