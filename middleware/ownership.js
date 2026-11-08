/**
 * Reusable server-side ownership assertions and tenant-scoping query filters.
 * Prevents Insecure Direct Object References (IDOR) and cross-tenant leakage.
 */

/**
 * Asserts whether the authenticated user owns or has authority to access/mutate a course.
 * - super_admin (and legacy admin) has global oversight.
 * - teacher only has access if course.ownerId matches user.id.
 *
 * @param {Object} course - Mongoose Course document or plain JavaScript object.
 * @param {Object} user - The authenticated session user (req.session.user).
 * @returns {Boolean} True if authorized, false otherwise.
 */
export function assertCourseOwnership(course, user) {
    if (!course || !user) {
        return false;
    }

    const role = user.role;
    if (role === "super_admin" || role === "admin") {
        return true;
    }

    if (role === "teacher") {
        const ownerIdStr = course.ownerId?._id
            ? course.ownerId._id.toString()
            : course.ownerId
            ? course.ownerId.toString()
            : null;

        return Boolean(ownerIdStr && ownerIdStr === user.id.toString());
    }

    return false;
}

/**
 * Returns a MongoDB query filter scoped to the authenticated user's permissions.
 * - super_admin (and legacy admin) returns baseFilter unmodified.
 * - teacher returns baseFilter scoped strictly with { ownerId: user.id }.
 * - any other or unauthenticated user returns an empty result filter ({ _id: null }).
 *
 * @param {Object} user - The authenticated session user (req.session.user).
 * @param {Object} baseFilter - Base MongoDB query object.
 * @returns {Object} Scoped filter for MongoDB queries.
 */
export function getScopedCourseFilter(user, baseFilter = {}) {
    if (!user) {
        return { ...baseFilter, _id: null };
    }

    const role = user.role;
    if (role === "super_admin" || role === "admin") {
        return { ...baseFilter };
    }

    if (role === "teacher") {
        return { ...baseFilter, ownerId: user.id };
    }

    return { ...baseFilter, _id: null };
}
