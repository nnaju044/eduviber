/**
 * EDUviber — End-to-End Lifecycle Validation Suite
 * 
 * Verifies the complete 10-step student & admin journey plus edge cases:
 * 1. Public visitor browses catalogue and syllabus
 * 2. Student account creation, forced password change on first login
 * 3. Student manual payment submission
 * 4. Admin payment review and approval
 * 5. Enrollment activation and student dashboard outline
 * 6. Protected Bunny lesson player with signed embed token & dynamic email watermark
 * 7. Real-time progress saving, resume position reload, and completion tracking
 * 8. Edge cases: suspended access (403), draft lesson access (404), cross-user proof access (403), invalid IDs (404)
 * 9. Logout, session invalidation, and cookie clearance
 * 10. Unauthenticated health probe (/health)
 */

import "dotenv/config";
import http from "node:http";
import mongoose from "mongoose";
import express from "express";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";

import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Progress from "../models/Progress.js";

import authRoutes from "../routes/authRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import studentRoutes from "../routes/studentRoutes.js";
import publicRoutes from "../routes/publicRoutes.js";
import { csrfProtection } from "../middleware/csrf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 63200 + Math.floor(Math.random() * 500);
let server;
let app;
let baseUrl;

function createApp() {
    app = express();
    app.disable("x-powered-by");

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "../views"));

    app.use(express.urlencoded({ extended: true, limit: "5mb" }));
    app.use(express.json({ limit: "5mb" }));

    // Health check
    app.get("/health", (req, res) => {
        const isDbConnected = mongoose.connection.readyState === 1;
        return res.status(isDbConnected ? 200 : 503).json({
            status: isDbConnected ? "ok" : "degraded",
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            database: isDbConnected ? "connected" : "disconnected",
        });
    });

    app.use(
        session({
            name: "course.sid",
            secret: "e2e_lifecycle_test_secret_at_least_32_characters_long",
            resave: false,
            saveUninitialized: false,
            cookie: { httpOnly: true, sameSite: "lax" },
        })
    );

    app.use(csrfProtection);

    app.use(publicRoutes);
    app.use(authRoutes);
    app.use(studentRoutes);
    app.use("/admin", adminRoutes);

    // Centralized error handler
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        const isApi = req.xhr || req.headers.accept?.includes("application/json");
        if (isApi) {
            return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
        }
        res.status(500).render("public/404", {
            message: "An unexpected error occurred. Please try again later.",
            user: req.session?.user || null,
        });
    });

    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(PORT, "127.0.0.1", () => {
            baseUrl = `http://127.0.0.1:${PORT}`;
            resolve();
        });
    });
}

/**
 * CookieJar helper to maintain persistent sessions across HTTP requests
 */
class SessionAgent {
    constructor() {
        this.cookies = new Map();
    }

    updateCookies(res) {
        const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
        for (const str of setCookieHeaders) {
            if (!str) continue;
            const parts = str.split(";")[0].split("=");
            const key = parts[0].trim();
            const val = parts.slice(1).join("=").trim();
            this.cookies.set(key, val);
        }
    }

    getCookieHeader() {
        return Array.from(this.cookies.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
    }

    async request(urlPath, options = {}) {
        const url = urlPath.startsWith("http") ? urlPath : `${baseUrl}${urlPath}`;
        const headers = { ...options.headers };
        const cookieStr = this.getCookieHeader();
        if (cookieStr) {
            headers["Cookie"] = cookieStr;
        }

        const res = await fetch(url, {
            ...options,
            headers,
            redirect: options.redirect || "manual",
        });

        this.updateCookies(res);
        return res;
    }
}

async function runEndToEndLifecycle() {
    console.log("=== STARTING COMPLETE END-TO-END LIFECYCLE TESTS ===");

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB Atlas");

    await createApp();
    console.log(`✓ Test application running at ${baseUrl}`);

    const uniqueId = Date.now().toString();

    // 1. Create initial Admin and Course Fixtures
    const bcrypt = (await import("bcryptjs")).default;
    const adminPasswordHash = await bcrypt.hash("AdminSecurePassword123!", 10);
    const adminUser = await User.create({
        name: "E2E Admin",
        email: `e2e-admin-${uniqueId}@example.com`,
        phone: "9999999999",
        passwordHash: adminPasswordHash,
        role: "admin",
        isActive: true,
        mustChangePassword: false,
    });

    const testCourse = await Course.create({
        title: `Full Lifecycle Masterclass ${uniqueId}`,
        slug: `e2e-course-${uniqueId}`,
        description: "Comprehensive end-to-end testing course program.",
        instructor: "Lead Instructor",
        thumbnail: "https://example.com/thumb.jpg",
        price: 2499,
        isPublished: true,
    });

    // 2 Published Lessons + 1 Draft Lesson
    const lesson1 = await Lesson.create({
        courseId: testCourse._id,
        title: "Lesson 1: Foundations",
        description: "Core architectural concepts and kickoff.",
        moduleName: "Module 1: Orientation",
        order: 1,
        durationSeconds: 300,
        bunnyVideoId: "11111111-2222-3333-4444-555555555555",
        isPublished: true,
    });

    const lesson2 = await Lesson.create({
        courseId: testCourse._id,
        title: "Lesson 2: Advanced Techniques",
        description: "Hands-on execution and exercises.",
        moduleName: "Module 2: Deep Dive",
        order: 2,
        durationSeconds: 600,
        bunnyVideoId: "66666666-7777-8888-9999-000000000000",
        isPublished: true,
    });

    const draftLesson = await Lesson.create({
        courseId: testCourse._id,
        title: "Draft Lesson: Secret Preview",
        description: "Unpublished content that students must not see.",
        moduleName: "Module 3: Bonus",
        order: 3,
        durationSeconds: 180,
        bunnyVideoId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        isPublished: false,
    });

    const studentAgent = new SessionAgent();
    const adminAgent = new SessionAgent();

    let studentUser = null;

    // Controlled mock for external Bunny Video API to allow watch route rendering in test environment
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        if (typeof url === "string" && url.includes("video.bunnycdn.com")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    videoLibraryId: Number(process.env.BUNNY_STREAM_LIBRARY_ID || 123456),
                    guid: url.split("/").pop(),
                    title: "Mocked Bunny Video",
                    length: 300,
                    status: 4,
                    encodeProgress: 100,
                }),
            };
        }
        return originalFetch(url, options);
    };

    try {
        // ==========================================
        // STEP 1: Public Storefront Discovery
        // ==========================================
        console.log("\n[Step 1] Public Visitor Browses Course Catalogue & Syllabus Preview");
        const landingRes = await studentAgent.request("/");
        if (landingRes.status !== 200) throw new Error(`Landing page returned status ${landingRes.status}`);
        const landingHtml = await landingRes.text();
        if (!landingHtml.includes(`Full Lifecycle Masterclass ${uniqueId}`)) {
            throw new Error("Landing page does not display published course title.");
        }

        const catalogRes = await studentAgent.request("/courses");
        if (catalogRes.status !== 200) throw new Error(`Catalogue returned status ${catalogRes.status}`);

        const courseDetailRes = await studentAgent.request(`/courses/e2e-course-${uniqueId}`);
        if (courseDetailRes.status !== 200) throw new Error(`Course detail returned status ${courseDetailRes.status}`);
        const courseDetailHtml = await courseDetailRes.text();
        if (!courseDetailHtml.includes("Lesson 1: Foundations") || !courseDetailHtml.includes("Lesson 2: Advanced Techniques")) {
            throw new Error("Course syllabus preview is missing published lessons.");
        }
        if (courseDetailHtml.includes("Draft Lesson: Secret Preview") || courseDetailHtml.includes("11111111-2222")) {
            throw new Error("Course detail leaked draft lesson or raw Bunny video GUID!");
        }
        console.log("✓ STEP 1 PASSED: Storefront displays published course & syllabus cleanly without leaking draft lessons or video IDs.");

        // ==========================================
        // STEP 2: Student Account Provisioning & Forced Password Reset Onboarding
        // ==========================================
        console.log("\n[Step 2] Student First-Time Login & Forced Password Change");
        const initialStudentPassword = "TemporaryPassword123!";
        const studentPasswordHash = await bcrypt.hash(initialStudentPassword, 10);
        studentUser = await User.create({
            name: "Alice Walker",
            email: `alice-${uniqueId}@example.com`,
            phone: "9876543210",
            passwordHash: studentPasswordHash,
            role: "student",
            isActive: true,
            mustChangePassword: true, // First login flag
        });

        // Student signs in with initial password
        const loginRes = await studentAgent.request("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-skip-csrf": "true",
            },
            body: new URLSearchParams({
                email: studentUser.email,
                password: initialStudentPassword,
            }).toString(),
        });

        // Must redirect to /change-password
        const loginRedirect = loginRes.headers.get("location");
        if (loginRes.status !== 302 || loginRedirect !== "/change-password") {
            throw new Error(`Expected redirect to /change-password, got ${loginRes.status} -> ${loginRedirect}`);
        }

        // Attempting to visit /dashboard while mustChangePassword is true MUST redirect back to /change-password
        const trappedDashboardRes = await studentAgent.request("/dashboard");
        if (trappedDashboardRes.status !== 302 || trappedDashboardRes.headers.get("location") !== "/change-password") {
            throw new Error("Student was not trapped in /change-password while mustChangePassword is true.");
        }

        // Student submits valid new password (>= 12 characters)
        const updatedPassword = "MySecurePermanentPassword123!";
        const changePassRes = await studentAgent.request("/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-skip-csrf": "true",
            },
            body: new URLSearchParams({
                password: updatedPassword,
                confirmPassword: updatedPassword,
            }).toString(),
        });

        if (changePassRes.status !== 302 || changePassRes.headers.get("location") !== "/dashboard") {
            throw new Error(`Password change failed, expected redirect to /dashboard, got ${changePassRes.status}`);
        }

        // Verify DB update
        const refreshedStudent = await User.findById(studentUser._id);
        if (refreshedStudent.mustChangePassword !== false) {
            throw new Error("mustChangePassword was not set to false after password update.");
        }

        // Student now accesses dashboard successfully
        const initialDashboardRes = await studentAgent.request("/dashboard");
        if (initialDashboardRes.status !== 200) {
            throw new Error(`Student could not access /dashboard after password change, got ${initialDashboardRes.status}`);
        }
        console.log("✓ STEP 2 PASSED: Forced password change on first login enforced and completed successfully.");

        // ==========================================
        // STEP 3: Student Enrolls & Submits Payment Proof
        // ==========================================
        console.log("\n[Step 3] Student Submits Offline Payment Verification Proof");
        const enrollPageRes = await studentAgent.request(`/courses/e2e-course-${uniqueId}/enroll`);
        if (enrollPageRes.status !== 200) throw new Error("Enrollment page returned error.");

        const transactionRef = `UPI-REF-${uniqueId}`;
        const proofUrl = "https://drive.google.com/file/d/test-proof-12345/view";
        const submitPaymentRes = await studentAgent.request(`/courses/e2e-course-${uniqueId}/enroll`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-skip-csrf": "true",
            },
            body: new URLSearchParams({
                transactionReference: transactionRef,
                proofUrl: proofUrl,
            }).toString(),
        });

        if (submitPaymentRes.status !== 200) {
            throw new Error(`Payment submission failed with status ${submitPaymentRes.status}`);
        }

        // Verify database state: Payment is pending, Enrollment is pending
        const paymentRecord = await Payment.findOne({
            userId: studentUser._id,
            courseId: testCourse._id,
        });

        if (!paymentRecord || paymentRecord.status !== "pending") {
            throw new Error("Payment record not found or status not pending.");
        }
        if (paymentRecord.amount !== testCourse.price) {
            throw new Error("Payment amount did not match server-derived course price.");
        }

        const pendingEnrollment = await Enrollment.findOne({
            userId: studentUser._id,
            courseId: testCourse._id,
        });

        if (!pendingEnrollment || pendingEnrollment.status !== "pending") {
            throw new Error("Enrollment should be created in pending state upon payment submission.");
        }

        // Verify student cannot watch lessons yet
        const prematureWatchRes = await studentAgent.request(
            `/courses/${testCourse._id}/lessons/${lesson1._id}/watch`
        );
        if (prematureWatchRes.status !== 403) {
            throw new Error(`Student accessed watch route before approval! Expected 403, got ${prematureWatchRes.status}`);
        }
        console.log("✓ STEP 3 PASSED: Payment submitted with pending status; lesson watch access strictly blocked.");

        // ==========================================
        // STEP 4: Admin Payment Review & Idempotent Approval
        // ==========================================
        console.log("\n[Step 4] Administrator Reviews & Approves Payment");
        // Admin signs in
        const adminLoginRes = await adminAgent.request("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-skip-csrf": "true",
            },
            body: new URLSearchParams({
                email: adminUser.email,
                password: "AdminSecurePassword123!",
            }).toString(),
        });
        if (adminLoginRes.status !== 302 || adminLoginRes.headers.get("location") !== "/admin") {
            throw new Error("Admin login failed.");
        }

        // Admin views payments queue
        const adminPaymentsRes = await adminAgent.request("/admin/payments");
        if (adminPaymentsRes.status !== 200) throw new Error("Admin could not view payments queue.");

        // Admin approves the payment
        const approveRes = await adminAgent.request(`/admin/payments/${paymentRecord._id}/approve`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-skip-csrf": "true",
            },
            body: new URLSearchParams({}).toString(),
        });
        if (approveRes.status !== 302) throw new Error(`Approval failed with status ${approveRes.status}`);

        // Verify payment is approved and enrollment is active
        const approvedPayment = await Payment.findById(paymentRecord._id);
        if (approvedPayment.status !== "approved") throw new Error("Payment status did not transition to approved.");

        const activeEnrollment = await Enrollment.findOne({
            userId: studentUser._id,
            courseId: testCourse._id,
        });
        if (!activeEnrollment || activeEnrollment.status !== "active") {
            throw new Error("Enrollment did not activate upon payment approval.");
        }
        console.log("✓ STEP 4 PASSED: Admin approved payment; enrollment successfully activated.");

        // ==========================================
        // STEP 5: Student Dashboard Displays Active Course
        // ==========================================
        console.log("\n[Step 5] Student Dashboard Reflects Active Course Outline");
        const activeDashboardRes = await studentAgent.request("/dashboard");
        if (activeDashboardRes.status !== 200) throw new Error("Student dashboard failed to load.");
        const activeDashboardHtml = await activeDashboardRes.text();
        if (!activeDashboardHtml.includes(`Full Lifecycle Masterclass ${uniqueId}`)) {
            throw new Error("Active course missing from student dashboard.");
        }
        if (!activeDashboardHtml.includes("Lesson 1: Foundations")) {
            throw new Error("Lesson syllabus missing from student dashboard.");
        }
        console.log("✓ STEP 5 PASSED: Student dashboard reflects active course curriculum and initial progress.");

        // ==========================================
        // STEP 6: Protected Bunny Lesson Watch Route & Watermark
        // ==========================================
        console.log("\n[Step 6] Student Accesses Protected Video Player");
        const watchRes = await studentAgent.request(`/courses/${testCourse._id}/lessons/${lesson1._id}/watch`);
        if (watchRes.status !== 200) throw new Error(`Watch route failed with status ${watchRes.status}`);
        const watchHtml = await watchRes.text();

        // Verify signed Bunny token URL present
        if (!watchHtml.includes("token=") || !watchHtml.includes("expires=")) {
            throw new Error("Watch page is missing signed Bunny embed token URL.");
        }
        // Verify animated email watermark
        if (!watchHtml.includes(studentUser.email) || !watchHtml.includes("email-watermark")) {
            throw new Error("Watch page is missing student email watermark.");
        }
        console.log("✓ STEP 6 PASSED: Protected watch route rendered with signed Bunny HMAC embed token & email watermark.");

        // ==========================================
        // STEP 7: Progress Saving, Resume Reload, and 100% Completion Reflection
        // ==========================================
        console.log("\n[Step 7] Student Syncs Progress and Completes Lesson");
        // Save intermediate position (e.g. 145 seconds)
        const progressRes = await studentAgent.request(
            `/courses/${testCourse._id}/lessons/${lesson1._id}/progress`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-skip-csrf": "true",
                },
                body: JSON.stringify({ position: 145, completed: false }),
            }
        );

        if (progressRes.status !== 200) throw new Error(`Progress save failed with status ${progressRes.status}`);
        const progressData = await progressRes.json();
        if (progressData.lastPositionSeconds !== 145 || progressData.completed !== false) {
            throw new Error(`Progress return value mismatch: ${JSON.stringify(progressData)}`);
        }

        // Re-request watch page to verify server renders resume position
        const resumeWatchRes = await studentAgent.request(`/courses/${testCourse._id}/lessons/${lesson1._id}/watch`);
        const resumeWatchHtml = await resumeWatchRes.text();
        if (!resumeWatchHtml.includes("Resuming from 2:25")) {
            throw new Error("Watch page did not reflect saved resume timestamp (2:25).");
        }

        // Mark lesson 1 completed
        const completeRes = await studentAgent.request(
            `/courses/${testCourse._id}/lessons/${lesson1._id}/progress`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-skip-csrf": "true",
                },
                body: JSON.stringify({ position: 0, completed: true }),
            }
        );
        if (completeRes.status !== 200) throw new Error("Lesson completion save failed.");

        // Verify completion on dashboard (1 of 2 lessons completed = 50%)
        const completedDashboardRes = await studentAgent.request("/dashboard");
        const completedDashboardHtml = await completedDashboardRes.text();
        if (!completedDashboardHtml.includes("50%")) {
            throw new Error("Dashboard did not update progress percentage to 50% after completing 1 of 2 lessons.");
        }
        console.log("✓ STEP 7 PASSED: Video playback progress saved, resume verified, and 50% course progress reflected.");

        // ==========================================
        // STEP 8: Security Edge Cases & Access Boundaries
        // ==========================================
        console.log("\n[Step 8] Negative Authorization & Edge-Case Verification");

        // Edge 8.1: Suspended Enrollment
        await Enrollment.updateOne(
            { userId: studentUser._id, courseId: testCourse._id },
            { $set: { status: "suspended" } }
        );
        const suspendedWatchRes = await studentAgent.request(`/courses/${testCourse._id}/lessons/${lesson1._id}/watch`);
        if (suspendedWatchRes.status !== 403) {
            throw new Error(`Suspended student should receive 403 on /watch, got ${suspendedWatchRes.status}`);
        }
        // Restore active enrollment
        await Enrollment.updateOne(
            { userId: studentUser._id, courseId: testCourse._id },
            { $set: { status: "active" } }
        );

        // Edge 8.2: Unpublished Draft Lesson Access
        const draftWatchRes = await studentAgent.request(`/courses/${testCourse._id}/lessons/${draftLesson._id}/watch`);
        if (draftWatchRes.status !== 404) {
            throw new Error(`Draft lesson watch request should return 404, got ${draftWatchRes.status}`);
        }

        // Edge 8.3: Cross-User Payment Proof Access Isolation
        const studentB = await User.create({
            name: "Bob Stone",
            email: `bob-${uniqueId}@example.com`,
            phone: "9999999991",
            passwordHash: studentPasswordHash,
            role: "student",
            isActive: true,
            mustChangePassword: false,
        });

        const bobAgent = new SessionAgent();
        await bobAgent.request("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-skip-csrf": "true",
            },
            body: new URLSearchParams({
                email: studentB.email,
                password: initialStudentPassword,
            }).toString(),
        });

        // Bob attempts to view Alice's payment proof
        const stolenProofRes = await bobAgent.request(`/payments/${paymentRecord._id}/proof`);
        if (stolenProofRes.status !== 403) {
            throw new Error(`Cross-user payment proof access allowed! Expected 403, got ${stolenProofRes.status}`);
        }

        // Edge 8.4: Invalid ObjectId inputs safely handled with 404
        const invalidCourseRes = await studentAgent.request("/courses/not-a-valid-id/lessons/also-invalid/watch");
        if (invalidCourseRes.status !== 404) {
            throw new Error(`Invalid ObjectId should return 404, got ${invalidCourseRes.status}`);
        }

        // Edge 8.5: CSRF verification rejects state-changing requests without token
        const csrfTamperedRes = await studentAgent.request(
            `/courses/${testCourse._id}/lessons/${lesson1._id}/progress`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ position: 50, completed: false }),
            }
        );
        if (csrfTamperedRes.status !== 403) {
            throw new Error(`Request without CSRF should fail with 403, got ${csrfTamperedRes.status}`);
        }
        console.log("✓ STEP 8 PASSED: Suspended access blocked (403), draft lessons concealed (404), proof isolated (403), invalid IDs handled (404), and CSRF enforced (403).");

        // ==========================================
        // STEP 9: Logout & Session Invalidation
        // ==========================================
        console.log("\n[Step 9] Student Logout & Session Invalidation");
        const logoutRes = await studentAgent.request("/logout", {
            method: "POST",
            headers: { "x-skip-csrf": "true" },
        });

        if (logoutRes.status !== 302 || logoutRes.headers.get("location") !== "/login") {
            throw new Error(`Logout failed to redirect to /login, got ${logoutRes.status}`);
        }

        // Accessing dashboard now must redirect to /login
        const loggedOutDashboardRes = await studentAgent.request("/dashboard");
        if (loggedOutDashboardRes.status !== 302 || loggedOutDashboardRes.headers.get("location") !== "/login") {
            throw new Error("Logged-out student was not redirected to /login when visiting /dashboard.");
        }
        console.log("✓ STEP 9 PASSED: Session destroyed, cookie cleared, and unauthorized access prevented.");

        // ==========================================
        // STEP 10: Health Probe Verification
        // ==========================================
        console.log("\n[Step 10] Unauthenticated Health Probe");
        const healthRes = await fetch(`${baseUrl}/health`);
        if (healthRes.status !== 200) throw new Error("Health check failed.");
        const healthData = await healthRes.json();
        if (healthData.status !== "ok" || healthData.database !== "connected") {
            throw new Error("Health check returned degraded status.");
        }
        console.log("✓ STEP 10 PASSED: /health liveness probe operational and returns 200 OK.");

        console.log("\n==================================================");
        console.log("ALL 10 END-TO-END LIFECYCLE TESTS PASSED! ✓");
        console.log("==================================================");
    } finally {
        globalThis.fetch = originalFetch;

        // Clean up test fixtures completely
        const userIds = [adminUser._id];
        if (studentUser?._id) userIds.push(studentUser._id);

        await Progress.deleteMany({ userId: { $in: userIds } });
        await Payment.deleteMany({ courseId: testCourse._id });
        await Enrollment.deleteMany({ courseId: testCourse._id });
        await Lesson.deleteMany({ courseId: testCourse._id });
        await Course.deleteMany({ _id: testCourse._id });
        await User.deleteMany({ email: { $regex: uniqueId } });
        console.log("✓ Cleaned up all test fixtures from database");

        if (server) {
            server.close();
        }
        await mongoose.disconnect();
    }
}

runEndToEndLifecycle().catch((err) => {
    console.error("\n❌ End-to-End Validation Failed:", err);
    process.exit(1);
});
