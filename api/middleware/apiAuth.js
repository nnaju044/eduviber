import User from "../../models/User.js";

/**
 * Standard API error responder
 */
export function sendApiError(res, statusCode, message, code = "ERROR", details = null) {
    const payload = {
        success: false,
        message,
        code,
    };
    if (details) {
        payload.details = details;
    }
    return res.status(statusCode).json(payload);
}

/**
 * Standard API success responder
 */
export function sendApiSuccess(res, statusCode = 200, data = {}, message = "Operation completed successfully") {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
}

/**
 * Guard requiring an active authenticated user session
 */
export async function requireApiAuth(req, res, next) {
    if (!req.session?.user) {
        return sendApiError(res, 401, "Authentication required. Please sign in.", "UNAUTHORIZED");
    }

    if (!req.session.user.isActive) {
        return sendApiError(res, 403, "Account is deactivated or suspended.", "ACCOUNT_INACTIVE");
    }

    next();
}

/**
 * Guard requiring Super Administrator privileges
 */
export async function requireApiSuperAdmin(req, res, next) {
    if (!req.session?.user) {
        return sendApiError(res, 401, "Authentication required. Please sign in.", "UNAUTHORIZED");
    }

    if (!req.session.user.isActive) {
        return sendApiError(res, 403, "Account is deactivated or suspended.", "ACCOUNT_INACTIVE");
    }

    const role = req.session.user.role;
    if (role !== "super_admin" && role !== "admin") {
        return sendApiError(res, 403, "Super Administrator access required.", "FORBIDDEN");
    }

    next();
}

/**
 * Guard requiring a Teacher (even if unapproved) or Super Admin
 */
export async function requireApiTeacherBase(req, res, next) {
    if (!req.session?.user) {
        return sendApiError(res, 401, "Authentication required. Please sign in.", "UNAUTHORIZED");
    }

    if (!req.session.user.isActive) {
        return sendApiError(res, 403, "Account is deactivated or suspended.", "ACCOUNT_INACTIVE");
    }

    const role = req.session.user.role;

    // Super Admin has oversight
    if (role === "super_admin" || role === "admin") {
        return next();
    }

    if (role !== "teacher") {
        return sendApiError(res, 403, "Teacher access required.", "FORBIDDEN");
    }

    // Refresh teacher profile status from DB
    const teacherUser = await User.findById(req.session.user.id).select("teacherProfile isActive role");
    if (!teacherUser || !teacherUser.isActive) {
        return sendApiError(res, 403, "Teacher account is unavailable or inactive.", "ACCOUNT_INACTIVE");
    }

    // Sync fresh status in session
    req.session.user.teacherProfile = teacherUser.teacherProfile;

    req.teacherUser = teacherUser;
    next();
}

/**
 * Guard requiring an approved Teacher or Super Admin
 */
export async function requireApiTeacher(req, res, next) {
    return requireApiTeacherBase(req, res, () => {
        const role = req.session.user.role;
        if (role === "super_admin" || role === "admin") {
            return next();
        }

        const teacherUser = req.teacherUser;
        if (!teacherUser?.teacherProfile?.isApproved) {
            return sendApiError(
                res,
                403,
                "Your teacher account is pending administrator review and approval.",
                "TEACHER_NOT_APPROVED"
            );
        }

        next();
    });
}

/**
 * Guard requiring a Student role or Super Admin
 */
export async function requireApiStudent(req, res, next) {
    if (!req.session?.user) {
        return sendApiError(res, 401, "Authentication required. Please sign in.", "UNAUTHORIZED");
    }

    if (!req.session.user.isActive) {
        return sendApiError(res, 403, "Account is deactivated or suspended.", "ACCOUNT_INACTIVE");
    }

    // Allow student, teacher, or admin to consume student APIs (e.g. view courses they bought)
    next();
}
