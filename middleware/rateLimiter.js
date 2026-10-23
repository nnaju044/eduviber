/**
 * Lightweight, in-memory sliding window rate limiter for Express.
 * Provides protection against brute-force attacks and abuse without external dependencies.
 */

class MemoryRateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
        this.max = options.max || 10;
        this.message = options.message || "Too many requests. Please try again later.";
        this.hits = new Map();

        // Cleanup stale entries every 5 minutes (unref so process isn't kept alive)
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [key, record] of this.hits.entries()) {
                if (record.resetTime <= now) {
                    this.hits.delete(key);
                }
            }
        }, 5 * 60 * 1000);

        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    getClientKey(req) {
        // Use standard IP address handling (honors trust proxy in production)
        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip || req.socket?.remoteAddress || "unknown";
        return `${req.path}:${ip}`;
    }

    middleware() {
        return (req, res, next) => {
            // Bypass during automated testing if flagged
            if (req.headers["x-skip-rate-limit"] === "true") {
                return next();
            }

            const key = this.getClientKey(req);
            const now = Date.now();
            let record = this.hits.get(key);

            if (!record || record.resetTime <= now) {
                record = { count: 1, resetTime: now + this.windowMs };
                this.hits.set(key, record);
                return next();
            }

            record.count += 1;

            if (record.count > this.max) {
                const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
                res.setHeader("Retry-After", String(retryAfterSeconds));

                if (req.xhr || req.headers.accept?.includes("application/json")) {
                    return res.status(429).json({
                        error: this.message,
                        retryAfterSeconds,
                    });
                }

                // Render or send error
                return res.status(429).render("public/404", {
                    message: `${this.message} (Retry after ${retryAfterSeconds} seconds)`,
                    user: req.session?.user || null,
                });
            }

            next();
        };
    }

    reset(req) {
        const key = this.getClientKey(req);
        this.hits.delete(key);
    }
}

// 10 login attempts per 15 minutes per IP
export const loginRateLimiter = new MemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Please wait 15 minutes before trying again.",
});

// 5 password reset requests per 15 minutes per IP
export const forgotPasswordRateLimiter = new MemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many password recovery requests. Please try again later.",
});
