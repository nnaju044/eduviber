import "dotenv/config";
import mongoose from "mongoose";

/**
 * Extracts the database name from a MongoDB connection URI.
 * Handles both standard mongodb:// and SRV mongodb+srv:// formats.
 */
export function getDatabaseName(uri) {
    if (!uri || typeof uri !== "string") return null;
    try {
        const cleanUri = uri.trim();
        // Replace mongodb scheme with standard http for safe URL parsing
        const parsed = new URL(cleanUri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
        const dbName = parsed.pathname.replace(/^\//, "").split("?")[0];
        return dbName || null;
    } catch {
        const match = uri.match(/\/([^/?]+)(\?|$)/);
        return match ? match[1] : null;
    }
}

/**
 * Masks credentials in a MongoDB connection string for safe logging.
 */
export function maskUri(uri) {
    if (!uri || typeof uri !== "string") return "";
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

/**
 * Validates that a candidate URI points to a safe, approved, isolated test database.
 * Strictly throws if the URI is missing, matches production, or lacks a "test" identifier.
 */
export function validateTestDatabaseUri(testUri = process.env.TEST_MONGODB_URI, prodUri = process.env.MONGODB_URI) {
    if (!testUri || !testUri.trim()) {
        throw new Error(
            "\n" +
            "==============================================================================\n" +
            " [FATAL] TEST DATABASE ISOLATION ERROR: TEST_MONGODB_URI is not configured!\n" +
            "==============================================================================\n" +
            " Tests are strictly prohibited from connecting to or modifying the primary\n" +
            " database (paid-course-platform).\n\n" +
            " To run tests safely:\n" +
            " 1. Open your .env file.\n" +
            " 2. Define TEST_MONGODB_URI pointing to a dedicated test database.\n" +
            "    Example:\n" +
            "    TEST_MONGODB_URI=mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/eduviber-test-isolated?retryWrites=true&w=majority\n" +
            " 3. The test database name must explicitly contain 'test' and cannot match\n" +
            "    the primary database.\n" +
            "==============================================================================\n"
        );
    }

    const testDbName = getDatabaseName(testUri);
    const prodDbName = getDatabaseName(prodUri);

    if (!testDbName) {
        throw new Error(
            `[FATAL] Malformed TEST_MONGODB_URI: Unable to parse database name. Ensure your connection string includes a database path (e.g., /eduviber-test-isolated).`
        );
    }

    // Safety Check 1: Must never match primary / production database URI
    if (prodUri && testUri.trim().toLowerCase() === prodUri.trim().toLowerCase()) {
        throw new Error(
            `[FATAL] CRITICAL SAFETY INTERLOCK: TEST_MONGODB_URI is identical to primary MONGODB_URI. Tests must run against a distinct isolated database to prevent data loss or corruption.`
        );
    }

    // Safety Check 2: Must never match primary / production database name
    if (prodDbName && testDbName.toLowerCase() === prodDbName.toLowerCase()) {
        throw new Error(
            `[FATAL] CRITICAL SAFETY INTERLOCK: TEST_MONGODB_URI targets the primary database name '${prodDbName}'. Tests are strictly barred from operating on primary data.`
        );
    }

    // Safety Check 3: Prohibit known production names
    const forbiddenNames = ["paid-course-platform", "production", "prod", "main", "live"];
    if (forbiddenNames.includes(testDbName.toLowerCase())) {
        throw new Error(
            `[FATAL] Unapproved test database name '${testDbName}'. Test database cannot be named any of: ${forbiddenNames.join(", ")}.`
        );
    }

    // Safety Check 4: Must explicitly include 'test'
    if (!testDbName.toLowerCase().includes("test")) {
        throw new Error(
            `[FATAL] Unapproved test database name '${testDbName}'. The isolated test database name must explicitly include 'test' (e.g. 'eduviber-test-isolated').`
        );
    }

    return { testUri: testUri.trim(), testDbName, prodDbName };
}

/**
 * Returns the isolated test database URI after passing all safety checks.
 */
export function getTestDatabaseUri() {
    const { testUri } = validateTestDatabaseUri(process.env.TEST_MONGODB_URI);
    return testUri;
}

/**
 * Runtime assertion on an active Mongoose connection to verify it is connected
 * to the verified test database before any write or migration operations occur.
 */
export function assertTestDatabaseIsolation(mongooseInstance = mongoose) {
    const activeDbName = mongooseInstance.connection.name;
    const prodDbName = getDatabaseName(process.env.MONGODB_URI);

    if (!activeDbName) {
        throw new Error("[FATAL] No active database connection found for test isolation verification.");
    }

    if (prodDbName && activeDbName.toLowerCase() === prodDbName.toLowerCase()) {
        throw new Error(
            `[FATAL] CRITICAL RUNTIME INTERLOCK: Active connection is bound to primary database '${activeDbName}'! Refusing to proceed.`
        );
    }

    if (!activeDbName.toLowerCase().includes("test")) {
        throw new Error(
            `[FATAL] CRITICAL RUNTIME INTERLOCK: Active database '${activeDbName}' is not a designated test database (name must contain 'test').`
        );
    }

    return true;
}

/**
 * Connects Mongoose to the isolated test database with all isolation checks enforced.
 */
export async function connectTestDB(mongooseInstance = mongoose) {
    process.env.NODE_ENV = "test";
    const testUri = getTestDatabaseUri();

    if (mongooseInstance.connection.readyState === 1) {
        // If already connected, verify it is connected to the test database
        assertTestDatabaseIsolation(mongooseInstance);
        return mongooseInstance.connection;
    }

    await mongooseInstance.connect(testUri, {
        serverSelectionTimeoutMS: 10000,
    });

    assertTestDatabaseIsolation(mongooseInstance);
    return mongooseInstance.connection;
}
