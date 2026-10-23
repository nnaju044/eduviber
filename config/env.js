/**
 * Validates required environment variables at application startup.
 * Throws explicit errors if mandatory secrets are missing or malformed,
 * without echoing or logging sensitive values.
 */
export function validateEnvironment() {
    const required = [
        "MONGODB_URI",
        "SESSION_SECRET",
        "BUNNY_STREAM_LIBRARY_ID",
        "BUNNY_STREAM_API_KEY",
        "BUNNY_STREAM_EMBED_TOKEN_KEY",
    ];

    const missing = required.filter((key) => !process.env[key] || !process.env[key].trim());

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}. Please configure them in your environment or hosting dashboard.`
        );
    }

    if (!/^\d+$/.test(process.env.BUNNY_STREAM_LIBRARY_ID)) {
        throw new Error("BUNNY_STREAM_LIBRARY_ID must be a numeric string.");
    }

    if (process.env.NODE_ENV === "production") {
        if (process.env.SESSION_SECRET.length < 32) {
            throw new Error(
                "SESSION_SECRET must be at least 32 characters in production for cryptographic safety."
            );
        }
    }
}
