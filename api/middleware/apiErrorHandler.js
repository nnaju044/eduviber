/**
 * Centralized JSON API error handler.
 * Prevents stack trace leakage, masks internal errors, and formats standard JSON responses.
 */
export function apiErrorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    console.error("[API Error]", req.method, req.originalUrl, "-", err.message);

    const statusCode = err.statusCode || (err.name === "ValidationError" ? 400 : 500);
    const code = err.code || (err.name === "ValidationError" ? "VALIDATION_ERROR" : "INTERNAL_SERVER_ERROR");
    
    // Mask sensitive details on 500 errors
    const message = statusCode >= 500
        ? "An internal server error occurred. Please try again later."
        : err.message;

    return res.status(statusCode).json({
        success: false,
        message,
        code,
    });
}
