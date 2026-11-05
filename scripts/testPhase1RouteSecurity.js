import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Progress from "../models/Progress.js";

import { csrfProtection } from "../middleware/csrf.js";
import authRoutes from "../routes/authRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import publicRoutes from "../routes/publicRoutes.js";
import studentRoutes from "../routes/studentRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { connectTestDB, assertTestDatabaseIsolation, getTestDatabaseUri } from "../config/testDbGuard.js";

const TEST_DB_URI = getTestDatabaseUri();

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testPayments = [];
const testEnrollments = [];

function createRealApp() {
    const app = express();
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "../views"));

    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    app.use(
        session({
            name: "course.sid",
            secret: "route_security_test_secret_32_characters_minimum",
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
            },
        })
    );

    app.use(csrfProtection);

    // Mount real application routes
    app.use(publicRoutes);
    app.use(authRoutes);
    app.use(studentRoutes);
    app.use("/admin", adminRoutes);

    // Global error handlers matching server.js
    app.use((req, res) => {
        res.status(404).render("public/404", {
            message: "Page Not Found",
            user: req.session?.user || null,
        });
    });

    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        res.status(500).render("public/404", {
            message: "An unexpected error occurred.",
            user: req.session?.user || null,
        });
    });

    return app;
}

function requestWithSession(server, options, body = null, cookie = null) {
    return new Promise((resolve, reject) => {
        const port = server.address().port;
        const headers = { ...(options.headers || {}) };
        if (cookie) {
            headers["Cookie"] = cookie;
        }

        let payload = null;
        if (body) {
            if (typeof body === "string") {
                payload = body;
            } else if (headers["Content-Type"] === "application/json") {
                payload = JSON.stringify(body);
            } else {
                // Form urlencoded default
                headers["Content-Type"] = "application/x-www-form-urlencoded";
                payload = new URLSearchParams(body).toString();
            }
            headers["Content-Length"] = Buffer.byteLength(payload);
        }

        const req = http.request(
            {
                hostname: "127.0.0.1",
                port,
                path: options.path,
                method: options.method || "GET",
                headers,
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    const rawCookie = res.headers["set-cookie"];
                    const sessionCookie = rawCookie ? rawCookie[0].split(";")[0] : cookie;
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data,
                        cookie: sessionCookie,
                    });
                });
            }
        );

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function extractCsrfToken(html) {
    const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
    return match ? match[1] : null;
}

async function runRouteSecurityTests() {
    console.log("==========================================================");
    console.log("=== RUNNING PHASE 1 ROUTE-LEVEL SECURITY TEST SUITE ===");
    console.log("==========================================================");

    await connectTestDB();
    assertTestDatabaseIsolation(mongoose);
    console.log(`✓ Connected to isolated test database: [${mongoose.connection.name}]`);

    const app = createRealApp();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    console.log(`✓ Real application test server listening on port ${port}`);

    try {
        const passwordPlain = "SuperSecretPassword123!";
        const passwordHash = await bcrypt.hash(passwordPlain, 10);

        // Seed test accounts
        const superAdminUser = await User.create({
            name: "Sec Super Admin",
            email: `sec-superadmin-${TIMESTAMP}@example.com`,
            phone: "9112223334",
            passwordHash,
            role: "super_admin",
            isActive: true,
            mustChangePassword: false,
        });
        testUsers.push(superAdminUser._id);

        const teacherUser = await User.create({
            name: "Sec Teacher User",
            email: `sec-teacher-${TIMESTAMP}@example.com`,
            phone: "9112223335",
            passwordHash,
            role: "teacher",
            isActive: true,
            mustChangePassword: false,
            teacherProfile: {
                headline: "Full-Stack Security Expert",
                bio: "Teaching cloud security architecture",
                commissionRate: 0.25,
                isApproved: true,
            },
        });
        testUsers.push(teacherUser._id);

        const studentUser = await User.create({
            name: "Sec Student User",
            email: `sec-student-${TIMESTAMP}@example.com`,
            phone: "9112223336",
            passwordHash,
            role: "student",
            isActive: true,
            mustChangePassword: false,
        });
        testUsers.push(studentUser._id);

        // Seed test course owned by teacher
        const testCourse = await Course.create({
            title: `Enterprise Cloud Security ${TIMESTAMP}`,
            slug: `enterprise-cloud-sec-${TIMESTAMP}`,
            description: "Advanced architecture course",
            price: 2000,
            thumbnail: "https://example.com/sec-thumb.jpg",
            instructor: "Teacher User",
            isPublished: true,
            ownerId: teacherUser._id,
        });
        testCourses.push(testCourse._id);

        // ----------------------------------------------------------------------
        // TEST 1: GET /login works without pre-existing CSRF token & renders form with _csrf
        // ----------------------------------------------------------------------
        const getLoginRes = await requestWithSession(server, { path: "/login", method: "GET" });
        assert.equal(getLoginRes.status, 200, "GET /login must return HTTP 200");
        assert.ok(getLoginRes.cookie, "GET /login must set session cookie");
        const csrfToken = extractCsrfToken(getLoginRes.body);
        assert.ok(csrfToken && csrfToken.length > 20, "GET /login must render hidden _csrf input with valid token");
        assert.ok(!getLoginRes.body.includes("Invalid or missing CSRF token"), "GET /login must not show CSRF error");
        console.log("✓ TEST 1 PASSED: GET /login returns HTTP 200, sets session cookie, and renders valid hidden CSRF token.");

        // ----------------------------------------------------------------------
        // TEST 2: POST /login without CSRF token is rejected with HTTP 403 (renders 403, not 404)
        // ----------------------------------------------------------------------
        const postLoginNoCsrf = await requestWithSession(
            server,
            { path: "/login", method: "POST" },
            { email: studentUser.email, password: passwordPlain },
            getLoginRes.cookie
        );
        assert.equal(postLoginNoCsrf.status, 403, "POST /login without CSRF token must return HTTP 403");
        assert.ok(postLoginNoCsrf.body.includes("403"), "CSRF failure page must show 403");
        assert.ok(!postLoginNoCsrf.body.includes(">404<"), "CSRF failure page must NOT show 404");
        assert.ok(postLoginNoCsrf.body.includes("Invalid or missing CSRF token"), "Page must state CSRF verification error");
        console.log("✓ TEST 2 PASSED: POST /login without CSRF token is rejected with HTTP 403 and renders 403 template (not 404).");

        // ----------------------------------------------------------------------
        // TEST 3: POST /login with valid CSRF token authenticates successfully
        // ----------------------------------------------------------------------
        const postLoginValid = await requestWithSession(
            server,
            { path: "/login", method: "POST" },
            { email: studentUser.email, password: passwordPlain, _csrf: csrfToken },
            getLoginRes.cookie
        );
        assert.equal(postLoginValid.status, 302, "Valid POST /login must redirect upon successful credentials");
        assert.equal(postLoginValid.headers.location, "/dashboard", "Student must redirect to /dashboard");
        const studentCookie = postLoginValid.cookie;
        console.log("✓ TEST 3 PASSED: POST /login with valid CSRF token authenticates student and redirects.");

        // Authenticate Teacher session
        const getTeacherLoginRes = await requestWithSession(server, { path: "/login", method: "GET" });
        const teacherCsrf = extractCsrfToken(getTeacherLoginRes.body);
        const postTeacherLogin = await requestWithSession(
            server,
            { path: "/login", method: "POST" },
            { email: teacherUser.email, password: passwordPlain, _csrf: teacherCsrf },
            getTeacherLoginRes.cookie
        );
        const teacherCookie = postTeacherLogin.cookie;

        // Authenticate Super Admin session
        const getAdminLoginRes = await requestWithSession(server, { path: "/login", method: "GET" });
        const adminCsrf = extractCsrfToken(getAdminLoginRes.body);
        const postAdminLogin = await requestWithSession(
            server,
            { path: "/login", method: "POST" },
            { email: superAdminUser.email, password: passwordPlain, _csrf: adminCsrf },
            getAdminLoginRes.cookie
        );
        assert.equal(postAdminLogin.status, 302);
        assert.equal(postAdminLogin.headers.location, "/admin");
        const adminCookie = postAdminLogin.cookie;

        // ----------------------------------------------------------------------
        // TEST 4: Teacher session receives HTTP 403 on all /admin routes
        // ----------------------------------------------------------------------
        const teacherCoursesRes = await requestWithSession(server, { path: "/admin/courses" }, null, teacherCookie);
        assert.equal(teacherCoursesRes.status, 403, "Teacher must receive 403 on /admin/courses");

        const teacherPaymentsRes = await requestWithSession(server, { path: "/admin/payments" }, null, teacherCookie);
        assert.equal(teacherPaymentsRes.status, 403, "Teacher must receive 403 on /admin/payments");

        const teacherStudentsRes = await requestWithSession(server, { path: "/admin/students" }, null, teacherCookie);
        assert.equal(teacherStudentsRes.status, 403, "Teacher must receive 403 on /admin/students");
        console.log("✓ TEST 4 PASSED: Teacher session strictly rejected with HTTP 403 on /admin/courses, /admin/payments, and /admin/students.");

        // ----------------------------------------------------------------------
        // TEST 5: Super Admin session receives HTTP 200 on all /admin routes
        // ----------------------------------------------------------------------
        const adminCoursesRes = await requestWithSession(server, { path: "/admin/courses" }, null, adminCookie);
        assert.equal(adminCoursesRes.status, 200, "Super Admin must receive 200 on /admin/courses");

        const adminPaymentsRes = await requestWithSession(server, { path: "/admin/payments" }, null, adminCookie);
        assert.equal(adminPaymentsRes.status, 200, "Super Admin must receive 200 on /admin/payments");

        const adminStudentsRes = await requestWithSession(server, { path: "/admin/students" }, null, adminCookie);
        assert.equal(adminStudentsRes.status, 200, "Super Admin must receive 200 on /admin/students");
        console.log("✓ TEST 5 PASSED: Super Admin session receives HTTP 200 on /admin/courses, /admin/payments, and /admin/students.");

        // ----------------------------------------------------------------------
        // TEST 6: Student session receives HTTP 403 on all administrative routes
        // ----------------------------------------------------------------------
        const studentAdminRes = await requestWithSession(server, { path: "/admin/courses" }, null, studentCookie);
        assert.equal(studentAdminRes.status, 403, "Student must receive 403 on /admin/courses");
        console.log("✓ TEST 6 PASSED: Student session rejected with HTTP 403 on administrative routes.");

        // ----------------------------------------------------------------------
        // TEST 7: Checkout payment creation binds ownerId strictly from course.ownerId & ignores spoofed inputs
        // ----------------------------------------------------------------------
        const getEnrollRes = await requestWithSession(
            server,
            { path: `/courses/${testCourse.slug}/enroll` },
            null,
            studentCookie
        );
        assert.equal(getEnrollRes.status, 200);
        const enrollCsrf = extractCsrfToken(getEnrollRes.body);
        assert.ok(enrollCsrf, "Enroll page must provide valid CSRF token");

        const spoofedOwnerId = new mongoose.Types.ObjectId();
        const postEnrollRes = await requestWithSession(
            server,
            { path: `/courses/${testCourse.slug}/enroll`, method: "POST" },
            {
                _csrf: enrollCsrf,
                transactionReference: `UTR-SEC-ROUTE-${TIMESTAMP}`,
                proofUrl: "https://drive.google.com/file/d/test1234/view",
                ownerId: spoofedOwnerId.toString(), // Attacker attempt to override owner
                teacherId: spoofedOwnerId.toString(),
                amount: 10, // Attacker attempt to pay 10 instead of 2000
                commissionRate: 0.01,
            },
            studentCookie
        );
        assert.equal(postEnrollRes.status, 200, "Enrollment form submission must render success page");
        assert.ok(postEnrollRes.body.includes("Payment Reference Submitted!"), "Success page must state submission confirmed");

        const submittedPayment = await Payment.findOne({
            userId: studentUser._id,
            courseId: testCourse._id,
            status: "pending",
        });
        assert.ok(submittedPayment, "Payment record must exist");
        testPayments.push(submittedPayment._id);

        assert.equal(
            submittedPayment.ownerId.toString(),
            teacherUser._id.toString(),
            "Payment ownerId must strictly derive from course.ownerId"
        );
        assert.notEqual(
            submittedPayment.ownerId.toString(),
            spoofedOwnerId.toString(),
            "Browser-submitted ownerId must NEVER override server course ownerId"
        );
        assert.equal(
            submittedPayment.amount,
            2000,
            "Payment amount must strictly equal course.price (2000), not browser spoofed amount (10)"
        );

        const submittedEnrollment = await Enrollment.findOne({
            userId: studentUser._id,
            courseId: testCourse._id,
        });
        assert.ok(submittedEnrollment, "Enrollment record must exist");
        testEnrollments.push(submittedEnrollment._id);
        assert.equal(
            submittedEnrollment.status,
            "pending",
            "Payment proof submission must NEVER activate enrollment (must remain pending)"
        );
        console.log("✓ TEST 7 PASSED: Payment submission derives ownerId and price from server course, rejects browser overrides, and preserves manual verification workflow.");

        // ----------------------------------------------------------------------
        // TEST 8: Super Admin Payment Approval Calculates Financial Snapshot Exactly Once
        // ----------------------------------------------------------------------
        const getAdminPaymentsRes = await requestWithSession(server, { path: "/admin/payments" }, null, adminCookie);
        const adminActionCsrf = extractCsrfToken(getAdminPaymentsRes.body);
        assert.ok(adminActionCsrf, "Admin payments page must contain CSRF token");

        const approveRes = await requestWithSession(
            server,
            { path: `/admin/payments/${submittedPayment._id}/approve`, method: "POST" },
            { _csrf: adminActionCsrf },
            adminCookie
        );
        assert.equal(approveRes.status, 302, "Payment approval must redirect");

        const approvedPayment = await Payment.findById(submittedPayment._id);
        assert.equal(approvedPayment.status, "approved", "Payment must be marked approved");
        assert.ok(approvedPayment.financialSnapshot, "financialSnapshot must be populated");
        assert.equal(approvedPayment.financialSnapshot.coursePrice, 2000, "coursePrice must be 2000");
        assert.equal(approvedPayment.financialSnapshot.commissionRate, 0.25, "commissionRate must match teacher's 25%");
        assert.equal(approvedPayment.financialSnapshot.platformCommission, 500, "platformCommission must be 500 (2000 * 0.25)");
        assert.equal(approvedPayment.financialSnapshot.teacherShare, 1500, "teacherShare must be 1500 (2000 - 500)");
        assert.equal(approvedPayment.financialSnapshot.currency, "INR", "currency must be INR");
        assert.equal(approvedPayment.financialSnapshot.collectionMethod, "manual_platform");
        assert.ok(approvedPayment.financialSnapshot.calculatedAt instanceof Date, "calculatedAt must be recorded Date");

        const activatedEnrollment = await Enrollment.findOne({
            userId: studentUser._id,
            courseId: testCourse._id,
        });
        assert.equal(activatedEnrollment.status, "active", "Enrollment must be active upon payment approval");
        console.log("✓ TEST 8 PASSED: Super Admin approval calculates server financial snapshot accurately and activates student enrollment.");

        // ----------------------------------------------------------------------
        // TEST 9: Attempts to Mutate an Existing Financial Snapshot are Rejected (Immutability)
        // ----------------------------------------------------------------------
        let saveErrorThrown = false;
        try {
            approvedPayment.financialSnapshot.teacherShare = 99999;
            await approvedPayment.save();
        } catch (err) {
            saveErrorThrown = true;
            assert.ok(err.message.includes("immutable"), "Error message must state immutability");
        }
        assert.ok(saveErrorThrown, "Attempting to modify snapshot via document.save() must throw");

        let updateErrorThrown = false;
        try {
            await Payment.updateOne(
                { _id: approvedPayment._id },
                { $set: { "financialSnapshot.teacherShare": 99999 } }
            );
        } catch (err) {
            updateErrorThrown = true;
            assert.ok(err.message.includes("immutable"), "Error message must state immutability");
        }
        assert.ok(updateErrorThrown, "Attempting to modify snapshot via updateOne() must throw");
        console.log("✓ TEST 9 PASSED: Payment.financialSnapshot immutability hooks strictly reject document and query-level mutations.");

        // ----------------------------------------------------------------------
        // TEST 10: Retrying Approval is Idempotent and Does Not Recalculate or Duplicate Snapshot
        // ----------------------------------------------------------------------
        const firstCalculatedAt = approvedPayment.financialSnapshot.calculatedAt.getTime();
        const retryApproveRes = await requestWithSession(
            server,
            { path: `/admin/payments/${submittedPayment._id}/approve`, method: "POST" },
            { _csrf: adminActionCsrf },
            adminCookie
        );
        assert.equal(retryApproveRes.status, 302, "Retry approval must cleanly redirect");

        const paymentAfterRetry = await Payment.findById(submittedPayment._id);
        assert.equal(
            paymentAfterRetry.financialSnapshot.calculatedAt.getTime(),
            firstCalculatedAt,
            "Idempotent approval must preserve original snapshot without modifying calculatedAt"
        );
        console.log("✓ TEST 10 PASSED: Approval retry is idempotent and preserves the immutable financial snapshot.");

        // ----------------------------------------------------------------------
        // TEST 11: Teacher Cannot Approve Payment
        // ----------------------------------------------------------------------
        const teacherApproveRes = await requestWithSession(
            server,
            { path: `/admin/payments/${submittedPayment._id}/approve`, method: "POST" },
            { _csrf: teacherCsrf },
            teacherCookie
        );
        assert.equal(teacherApproveRes.status, 403, "Teacher attempting to approve payment must receive HTTP 403");
        console.log("✓ TEST 11 PASSED: Teachers cannot approve payments or alter financial status.");

        console.log("\n==========================================================");
        console.log("=== ALL 11 PHASE 1 ROUTE SECURITY TESTS PASSED ===");
        console.log("==========================================================");
    } finally {
        server.close();
        if (testUsers.length > 0) await User.deleteMany({ _id: { $in: testUsers } });
        if (testCourses.length > 0) await Course.deleteMany({ _id: { $in: testCourses } });
        if (testPayments.length > 0) await Payment.deleteMany({ _id: { $in: testPayments } });
        if (testEnrollments.length > 0) await Enrollment.deleteMany({ _id: { $in: testEnrollments } });
        await mongoose.disconnect();
    }
}

runRouteSecurityTests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n❌ Route Security Test Suite Failed:", err);
        process.exit(1);
    });
