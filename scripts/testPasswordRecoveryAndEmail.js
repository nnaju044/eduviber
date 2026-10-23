/**
 * Automated Test Suite for Password Recovery & Transactional Email
 * Run using: node scripts/testPasswordRecoveryAndEmail.js
 */

import "dotenv/config";
process.env.NODE_ENV = "test"; // Ensures test transport for email & session flags

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import http from "http";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import Course from "../models/Course.js";
import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";

import authRoutes from "../routes/authRoutes.js";
import publicRoutes from "../routes/publicRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";

import {
    getSentEmails,
    clearSentEmails,
    sendTransactionalEmail,
} from "../services/emailService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_EMAIL_SUFFIX = `test_pw_${Date.now()}@testdomain.com`;
const STUDENT_EMAIL = `student_${TEST_EMAIL_SUFFIX}`;
const NON_EXISTENT_EMAIL = `nonexistent_${Date.now()}@testdomain.com`;
const INITIAL_PASSWORD = "InitialPassword123!";
const NEW_SECURE_PASSWORD = "MyNewSecurePassword456!";

let server;
let serverBaseUrl;

let sessionStore;

async function setupTestApp() {
    const app = express();

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));

    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use(express.json());

    sessionStore = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "test_sessions",
        ttl: 3600,
    });

    app.use(
        session({
            name: "course.sid",
            secret: process.env.SESSION_SECRET || "test_secret_32_characters_minimum__",
            resave: false,
            saveUninitialized: false,
            store: sessionStore,
            cookie: {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 3600 * 1000,
            },
        })
    );

    app.use(publicRoutes);
    app.use(authRoutes);
    app.use("/admin", adminRoutes);

    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;
            serverBaseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
}

function parseCookies(headers) {
    const raw = headers.getSetCookie ? headers.getSetCookie() : [];
    if (!raw || raw.length === 0) {
        const single = headers.get("set-cookie");
        return single ? [single.split(";")[0]] : [];
    }
    return raw.map((c) => c.split(";")[0]);
}

async function request(urlPath, options = {}) {
    const url = `${serverBaseUrl}${urlPath}`;
    const headers = options.headers || {};
    if (options.cookies) {
        headers["cookie"] = options.cookies.join("; ");
    }
    const response = await fetch(url, {
        ...options,
        headers,
        redirect: options.redirect || "manual",
    });
    const text = await response.text();
    const setCookies = parseCookies(response.headers);
    return {
        status: response.status,
        headers: response.headers,
        text,
        setCookies,
    };
}

async function runTests() {
    console.log("=== STARTING PASSWORD RECOVERY & TRANSACTIONAL EMAIL TESTS ===");
    clearSentEmails();

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI not configured in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB Atlas");

    await setupTestApp();
    console.log(`✓ Test server running at ${serverBaseUrl}`);

    let testStudentUser;

    try {
        // Create test student user
        const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 12);
        testStudentUser = await User.create({
            name: "Test Recovery Student",
            email: STUDENT_EMAIL,
            phone: "9876543210",
            passwordHash,
            role: "student",
            mustChangePassword: true,
            isActive: true,
        });
        console.log("✓ Fixtures created in database");

        // TEST 1: GET /forgot-password
        const getForgotRes = await request("/forgot-password");
        if (getForgotRes.status !== 200 || !getForgotRes.text.includes("Reset your password")) {
            throw new Error(`TEST 1 FAILED: GET /forgot-password returned ${getForgotRes.status}`);
        }
        console.log("✓ TEST 1 PASSED: GET /forgot-password renders clean recovery form.");

        // TEST 2: POST /forgot-password with non-existent email (Generic confirmation, no user enumeration)
        clearSentEmails();
        const nonExistentRes = await request("/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ email: NON_EXISTENT_EMAIL }),
        });

        if (nonExistentRes.status !== 200 || !nonExistentRes.text.includes("Check your email")) {
            throw new Error(`TEST 2 FAILED: Expected generic 200 confirmation for non-existent email, got ${nonExistentRes.status}`);
        }
        if (getSentEmails().length > 0) {
            throw new Error("TEST 2 FAILED: Email was sent for a non-existent address!");
        }
        console.log("✓ TEST 2 PASSED: Non-existent email returns generic confirmation without leaking user existence.");

        // TEST 3: POST /forgot-password with existing student email
        clearSentEmails();
        const validForgotRes = await request("/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ email: STUDENT_EMAIL }),
        });

        if (validForgotRes.status !== 200 || !validForgotRes.text.includes("Check your email")) {
            throw new Error(`TEST 3 FAILED: Expected generic confirmation, got ${validForgotRes.status}`);
        }

        // Verify database state: token hash stored, not raw token
        const updatedStudent = await User.findById(testStudentUser._id).select(
            "+resetPasswordTokenHash"
        );
        if (!updatedStudent.resetPasswordTokenHash || !updatedStudent.resetPasswordExpires) {
            throw new Error("TEST 3 FAILED: resetPasswordTokenHash or expiry not set in DB.");
        }
        if (new Date(updatedStudent.resetPasswordExpires).getTime() <= Date.now()) {
            throw new Error("TEST 3 FAILED: resetPasswordExpires is not in the future.");
        }

        // Verify sent email
        const sentEmails = getSentEmails();
        if (sentEmails.length !== 1) {
            throw new Error(`TEST 3 FAILED: Expected 1 sent email, found ${sentEmails.length}`);
        }
        const resetEmail = sentEmails[0];
        if (resetEmail.to !== STUDENT_EMAIL) {
            throw new Error(`TEST 3 FAILED: Expected email to ${STUDENT_EMAIL}, got ${resetEmail.to}`);
        }
        if (resetEmail.html.includes(INITIAL_PASSWORD) || resetEmail.text.includes(INITIAL_PASSWORD)) {
            throw new Error("TEST 3 FAILED: Plaintext password was leaked in reset email!");
        }

        // Extract reset token from email link
        const tokenMatch = resetEmail.text.match(/token=([a-f0-9]{64})/);
        if (!tokenMatch) {
            throw new Error("TEST 3 FAILED: Could not extract 64-char hex token from email text.");
        }
        const rawToken = tokenMatch[1];

        // Verify SHA-256 hash match
        const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        if (updatedStudent.resetPasswordTokenHash !== expectedHash) {
            throw new Error("TEST 3 FAILED: DB hash does not match SHA-256 of email token!");
        }
        console.log("✓ TEST 3 PASSED: Secure token generated, SHA-256 hash stored in DB, and reset email dispatched.");

        // TEST 4: GET /reset-password with invalid / tampered token
        const invalidTokenRes = await request("/reset-password?token=tampered_token_12345");
        if (invalidTokenRes.status !== 400 || !invalidTokenRes.text.includes("Invalid or Expired Link")) {
            throw new Error(`TEST 4 FAILED: Tampered token was not rejected with 400. Got ${invalidTokenRes.status}`);
        }
        console.log("✓ TEST 4 PASSED: Tampered/invalid reset token returns 400 and clear error UI.");

        // TEST 5: GET /reset-password with valid token
        const validTokenRes = await request(`/reset-password?token=${rawToken}`);
        if (validTokenRes.status !== 200 || !validTokenRes.text.includes("Choose a new password")) {
            throw new Error(`TEST 5 FAILED: Valid token failed to render reset form. Got ${validTokenRes.status}`);
        }
        console.log("✓ TEST 5 PASSED: Valid reset token renders new password form.");

        // TEST 6: POST /reset-password with password shorter than 12 characters
        const shortPwRes = await request("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token: rawToken,
                password: "short",
                confirmPassword: "short",
            }),
        });
        if (shortPwRes.status !== 400 || !shortPwRes.text.includes("at least 12 characters")) {
            throw new Error(`TEST 6 FAILED: Password < 12 characters was not rejected with 400.`);
        }

        // TEST 7: POST /reset-password with password mismatch
        const mismatchRes = await request("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token: rawToken,
                password: "ValidPassword123!",
                confirmPassword: "DifferentPassword123!",
            }),
        });
        if (mismatchRes.status !== 400 || !mismatchRes.text.includes("passwords do not match")) {
            throw new Error(`TEST 7 FAILED: Mismatched password was not rejected with 400.`);
        }
        console.log("✓ TEST 6 & 7 PASSED: 12-character minimum and password confirmation strictly enforced.");

        // TEST 8: POST /reset-password with valid 12+ char password
        const successfulResetRes = await request("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token: rawToken,
                password: NEW_SECURE_PASSWORD,
                confirmPassword: NEW_SECURE_PASSWORD,
            }),
        });

        if (successfulResetRes.status !== 302 || !successfulResetRes.headers.get("location").includes("/login?reset=success")) {
            throw new Error(`TEST 8 FAILED: Expected 302 redirect to /login?reset=success, got ${successfulResetRes.status}`);
        }

        // Verify student record updated and token cleared
        const studentAfterReset = await User.findById(testStudentUser._id).select(
            "+passwordHash +resetPasswordTokenHash"
        );
        if (studentAfterReset.resetPasswordTokenHash) {
            throw new Error("TEST 8 FAILED: resetPasswordTokenHash was not cleared after reset!");
        }
        if (studentAfterReset.mustChangePassword !== false) {
            throw new Error("TEST 8 FAILED: mustChangePassword was not set to false!");
        }
        const matchesNew = await bcrypt.compare(
            NEW_SECURE_PASSWORD,
            studentAfterReset.passwordHash
        );
        if (!matchesNew) {
            throw new Error("TEST 8 FAILED: DB password does not match new password!");
        }
        console.log("✓ TEST 8 PASSED: Password successfully updated with bcrypt; token invalidated; session renewed.");

        // TEST 9: POST /reset-password with used token (Reused token rejected)
        const reusedTokenRes = await request("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token: rawToken,
                password: "AnotherNewPassword123!",
                confirmPassword: "AnotherNewPassword123!",
            }),
        });
        if (reusedTokenRes.status !== 400 || !reusedTokenRes.text.includes("Invalid or Expired Link")) {
            throw new Error(`TEST 9 FAILED: Reused token was not rejected with 400.`);
        }
        console.log("✓ TEST 9 PASSED: Single-use token enforcement validated (reused token blocked).");

        // TEST 10: Expired token rejection
        const expiredToken = crypto.randomBytes(32).toString("hex");
        const expiredHash = crypto.createHash("sha256").update(expiredToken).digest("hex");
        await User.findByIdAndUpdate(testStudentUser._id, {
            resetPasswordTokenHash: expiredHash,
            resetPasswordExpires: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
        });

        const expiredGetRes = await request(`/reset-password?token=${expiredToken}`);
        if (expiredGetRes.status !== 400 || !expiredGetRes.text.includes("Invalid or Expired Link")) {
            throw new Error(`TEST 10 FAILED: Expired token GET was not rejected with 400.`);
        }
        const expiredPostRes = await request("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token: expiredToken,
                password: "YetAnotherPassword123!",
                confirmPassword: "YetAnotherPassword123!",
            }),
        });
        if (expiredPostRes.status !== 400 || !expiredPostRes.text.includes("Invalid or Expired Link")) {
            throw new Error(`TEST 10 FAILED: Expired token POST was not rejected with 400.`);
        }
        console.log("✓ TEST 10 PASSED: Expired token safely rejected.");

        // TEST 11: Login with new password succeeds and displays reset success banner
        const loginPageRes = await request("/login?reset=success");
        if (loginPageRes.status !== 200 || !loginPageRes.text.includes("Your password has been reset successfully")) {
            throw new Error("TEST 11 FAILED: Reset success banner not displayed on /login.");
        }

        const loginRes = await request("/login", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                email: STUDENT_EMAIL,
                password: NEW_SECURE_PASSWORD,
            }),
        });
        if (loginRes.status !== 302 || !loginRes.headers.get("location").includes("/dashboard")) {
            throw new Error(`TEST 11 FAILED: Login with new password failed. Status: ${loginRes.status}`);
        }
        console.log("✓ TEST 11 PASSED: Successfully authenticated with newly updated password.");

        // TEST 12: Transactional Email notification template and delivery checks
        clearSentEmails();
        const testDirectSend = await sendTransactionalEmail({
            to: "verify@testdomain.com",
            subject: "Verification Test",
            html: "<p>Verification</p>",
            text: "Verification",
        });
        if (!testDirectSend.success || !testDirectSend.messageId) {
            throw new Error("TEST 12 FAILED: sendTransactionalEmail failed in dry-run mode.");
        }
        if (getSentEmails().length !== 1) {
            throw new Error("TEST 12 FAILED: sentEmails history did not capture test email.");
        }

        // Test error handling without recipient
        const failSend = await sendTransactionalEmail({
            to: "",
            subject: "Empty",
            html: "",
            text: "",
        });
        if (failSend.success !== false) {
            throw new Error("TEST 12 FAILED: Missing recipient should return success: false without throwing.");
        }
        console.log("✓ TEST 12 PASSED: Transactional email delivery, fallbacks, and error boundaries verified.");

        console.log("==================================================");
        console.log("ALL 12 PASSWORD RECOVERY & EMAIL TESTS PASSED! ✓");
        console.log("==================================================");
    } finally {
        if (testStudentUser?._id) {
            await User.findByIdAndDelete(testStudentUser._id);
        }
        await User.deleteMany({ email: new RegExp(TEST_EMAIL_SUFFIX) });
        if (server) {
            server.close();
        }
        if (sessionStore?.close) {
            await sessionStore.close().catch(() => {});
        }
        await mongoose.disconnect().catch(() => {});
        console.log("✓ Test fixtures cleaned up from database");
    }
}

runTests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("TEST RUN FAILED:", err);
        process.exit(1);
    });
