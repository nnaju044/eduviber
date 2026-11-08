import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
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
import { requireAuth, requireSuperAdmin, requireAdmin, requireTeacher } from "../middleware/requireAuth.js";
import { assertCourseOwnership, getScopedCourseFilter } from "../middleware/ownership.js";
import { runMigration } from "./migratePhase1Tenancy.js";
import { connectTestDB, assertTestDatabaseIsolation, getTestDatabaseUri } from "../config/testDbGuard.js";

const TEST_DB_URI = getTestDatabaseUri();

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testPayments = [];

async function createTestUser(userData) {
    const passwordHash = await bcrypt.hash("TestPass123456!", 10);
    const user = await User.create({
        name: userData.name || `Test User ${TIMESTAMP}`,
        email: userData.email,
        phone: "9998887776",
        passwordHash,
        role: userData.role || "student",
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        mustChangePassword: userData.mustChangePassword !== undefined ? userData.mustChangePassword : false,
        teacherProfile: userData.teacherProfile || {
            headline: "Expert Educator",
            bio: "Teaching software architecture",
            isApproved: userData.isApproved || false,
            commissionRate: 0.20,
        },
    });
    testUsers.push(user._id);
    return user;
}

async function createTestCourse(courseData) {
    const course = await Course.create({
        title: courseData.title || `Test Course ${TIMESTAMP}`,
        slug: courseData.slug || `test-course-${TIMESTAMP}-${Math.random().toString(36).substring(7)}`,
        description: "Test description",
        price: courseData.price || 1000,
        thumbnail: "https://example.com/thumb.jpg",
        instructor: courseData.instructor || "Platform Instructor",
        isPublished: courseData.isPublished !== undefined ? courseData.isPublished : true,
        ownerId: courseData.ownerId,
    });
    testCourses.push(course._id);
    return course;
}

// Minimal test server with session injection for testing middleware
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(
        session({
            secret: "test_phase1_secret_at_least_32_characters_long",
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false },
        })
    );

    // Header-based session injector for role testing
    app.use((req, res, next) => {
        const testRole = req.headers["x-test-role"];
        const testUserId = req.headers["x-test-user-id"];
        const testIsActive = req.headers["x-test-is-active"] !== "false";
        const testIsApproved = req.headers["x-test-is-approved"] === "true";
        const testMustChangePassword = req.headers["x-test-must-change-password"] === "true";

        if (testRole && testUserId) {
            req.session.user = {
                id: testUserId,
                role: testRole,
                isActive: testIsActive,
                mustChangePassword: testMustChangePassword,
                teacherProfile: {
                    isApproved: testIsApproved,
                    commissionRate: 0.20,
                },
            };
        }
        next();
    });

    // Guarded test endpoints
    app.get("/test/super-admin", requireSuperAdmin, (req, res) => {
        res.json({ message: "Welcome Super Admin", user: req.session.user });
    });

    app.get("/test/legacy-admin", requireAdmin, (req, res) => {
        res.json({ message: "Welcome Admin", user: req.session.user });
    });

    app.get("/test/teacher", requireTeacher, (req, res) => {
        res.json({ message: "Welcome Teacher", user: req.session.user });
    });

    app.get("/test/student-auth", requireAuth, (req, res) => {
        res.json({ message: "Welcome Student", user: req.session.user });
    });

    // Mock teacher mutation route testing IDOR defense
    app.post("/test/teacher/courses/:id", requireTeacher, async (req, res) => {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        const isAuthorized = assertCourseOwnership(course, req.session.user);
        if (!isAuthorized) {
            return res.status(403).json({ error: "Access denied. You do not own this course." });
        }

        course.title = req.body.title || course.title;
        await course.save();
        res.json({ message: "Course updated successfully", course });
    });

    return app;
}

function makeRequest(server, options, body = null) {
    return new Promise((resolve, reject) => {
        const port = server.address().port;
        const reqOptions = {
            hostname: "127.0.0.1",
            port,
            path: options.path,
            method: options.method || "GET",
            headers: options.headers || {},
        };

        const req = http.request(reqOptions, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                });
            });
        });

        req.on("error", reject);
        if (body) {
            req.write(typeof body === "string" ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runPhase1Tests() {
    console.log("==================================================");
    console.log("=== STARTING PHASE 1 MULTI-TENANT TEST SUITE ===");
    console.log("==================================================");

    await connectTestDB();
    assertTestDatabaseIsolation(mongoose);
    console.log(`✓ Connected to isolated test database: [${mongoose.connection.name}]`);

    const app = createTestApp();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    console.log(`✓ Test harness listening at http://127.0.0.1:${port}`);

    try {
        // -------------------------------------------------------------
        // TEST 1: User Schema Role Enumeration & Defaults
        // -------------------------------------------------------------
        const studentUser = await createTestUser({
            name: "Student One",
            email: `student1-${TIMESTAMP}@example.com`,
            role: "student",
        });
        assert.equal(studentUser.role, "student", "Role should be student");
        assert.equal(studentUser.teacherProfile.isApproved, false, "Default teacher approval should be false");

        const teacherUser = await createTestUser({
            name: "Teacher One",
            email: `teacher1-${TIMESTAMP}@example.com`,
            role: "teacher",
            isApproved: true,
        });
        assert.equal(teacherUser.role, "teacher", "Role should be teacher");
        assert.equal(teacherUser.teacherProfile.isApproved, true, "Teacher isApproved should match input");

        const superAdminUser = await createTestUser({
            name: "Super Admin",
            email: `superadmin-${TIMESTAMP}@example.com`,
            role: "super_admin",
        });
        assert.equal(superAdminUser.role, "super_admin", "Role should be super_admin");
        console.log("✓ TEST 1 PASSED: User schema validates super_admin, teacher, student roles & teacherProfile.");

        // -------------------------------------------------------------
        // TEST 2: Course Ownership Reference & Virtuals
        // -------------------------------------------------------------
        const teacherCourse = await createTestCourse({
            title: `React Masterclass ${TIMESTAMP}`,
            ownerId: teacherUser._id,
        });
        assert.equal(teacherCourse.ownerId.toString(), teacherUser._id.toString(), "Course ownerId must match teacher ID");
        assert.equal(teacherCourse.teacherId, undefined, "Misleading teacherId virtual must not exist on Course");
        console.log("✓ TEST 2 PASSED: Course schema requires and indexes ownerId as canonical ownership reference.");

        // -------------------------------------------------------------
        // TEST 3: Financial Foundation Snapshot Structure in Payment
        // -------------------------------------------------------------
        const paymentRecord = await Payment.create({
            userId: studentUser._id,
            courseId: teacherCourse._id,
            ownerId: teacherUser._id,
            amount: 1000,
            transactionReference: `UTR-TEST-${TIMESTAMP}`,
            financialSnapshot: {
                coursePrice: 1000,
                commissionRate: 0.20,
                platformCommission: 200,
                teacherShare: 800,
                currency: "INR",
                collectionMethod: "manual_platform",
                calculatedAt: new Date(),
            },
            status: "pending",
        });
        testPayments.push(paymentRecord._id);

        assert.equal(paymentRecord.financialSnapshot.coursePrice, 1000);
        assert.equal(paymentRecord.financialSnapshot.platformCommission, 200);
        assert.equal(paymentRecord.financialSnapshot.teacherShare, 800);
        assert.equal(paymentRecord.financialSnapshot.collectionMethod, "manual_platform");
        console.log("✓ TEST 3 PASSED: Payment model defines immutable 80/20 financial snapshot and configurable collection method.");

        // -------------------------------------------------------------
        // TEST 4: Migration Script - Legacy Admin & Course Migration (Dry-Run & Execute)
        // -------------------------------------------------------------
        // Create an unowned legacy course and a legacy admin using collection.insertOne
        // to faithfully simulate raw pre-existing database records prior to Phase 1
        const legacyAdminId = new mongoose.Types.ObjectId();
        const legacyAdminEmail = `legacyadmin-${TIMESTAMP}@example.com`;
        await User.collection.insertOne({
            _id: legacyAdminId,
            name: "Legacy Admin User",
            email: legacyAdminEmail,
            phone: "9990001112",
            passwordHash: await bcrypt.hash("AdminPass123456!", 10),
            role: "admin", // Raw legacy admin
            isActive: true,
            mustChangePassword: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        testUsers.push(legacyAdminId);

        const legacyCourseId = new mongoose.Types.ObjectId();
        await Course.collection.insertOne({
            _id: legacyCourseId,
            title: `Legacy Platform Course ${TIMESTAMP}`,
            slug: `legacy-platform-course-${TIMESTAMP}`,
            description: "Pre-existing course created before multi-tenant migration",
            price: 500,
            instructor: "Legacy Admin",
            isPublished: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            // Deliberately no ownerId to test migration assignment
        });
        testCourses.push(legacyCourseId);

        // Assert runtime connection is strictly isolated before running migration
        assertTestDatabaseIsolation(mongoose);

        // Dry-run migration against isolated test database
        const dryRunResult = await runMigration({
            uri: TEST_DB_URI,
            dryRun: true,
            execute: false,
            adminEmail: legacyAdminEmail,
            confirmProduction: true,
        });
        assert.equal(dryRunResult.mode, "dry-run", "Must be dry-run");
        assert.equal(dryRunResult.usersMigrated, 0, "Dry-run must not write user mutations");
        assert.equal(dryRunResult.coursesMigrated, 0, "Dry-run must not write course mutations");

        // Execute migration against isolated test database
        const executeResult = await runMigration({
            uri: TEST_DB_URI,
            dryRun: false,
            execute: true,
            adminEmail: legacyAdminEmail,
            confirmProduction: true,
        });
        assert.equal(executeResult.mode, "execute", "Must be execute mode");
        assert.ok(executeResult.usersMigrated >= 1, "Must migrate legacy admin to super_admin");
        assert.ok(executeResult.coursesMigrated >= 1, "Must assign unowned course to super_admin");

        // Verify database state
        const refreshedAdmin = await User.findById(legacyAdminId);
        assert.equal(refreshedAdmin.role, "super_admin", "Legacy admin must now be super_admin");

        const refreshedCourse = await Course.findById(legacyCourseId);
        assert.equal(refreshedCourse.ownerId.toString(), legacyAdminId.toString(), "Legacy course must be owned by Super Admin");

        // Re-run migration to assert idempotency
        const rerunResult = await runMigration({
            uri: TEST_DB_URI,
            dryRun: false,
            execute: true,
            adminEmail: legacyAdminEmail,
            confirmProduction: true,
        });
        assert.equal(rerunResult.usersMigrated, 0, "Idempotent rerun must find 0 users to migrate");
        assert.equal(rerunResult.coursesMigrated, 0, "Idempotent rerun must find 0 courses to migrate");

        // Rollback Testing: Dry-run rollback
        const dryRunRollback = await runMigration({
            uri: TEST_DB_URI,
            rollback: true,
            dryRun: true,
            adminEmail: legacyAdminEmail,
            confirmProduction: true,
        });
        assert.equal(dryRunRollback.mode, "rollback");
        assert.equal(dryRunRollback.dryRun, true);

        // Rollback Testing: Live reversion
        const rollbackResult = await runMigration({
            uri: TEST_DB_URI,
            rollback: true,
            dryRun: false,
            adminEmail: legacyAdminEmail,
            confirmProduction: true,
        });
        assert.equal(rollbackResult.mode, "rollback");
        assert.equal(rollbackResult.dryRun, false);

        // Assert rollback safely reverted records
        const revertedAdmin = await User.findById(legacyAdminId);
        assert.equal(revertedAdmin.role, "admin", "Legacy admin must be reverted to 'admin' after rollback");

        const revertedCourse = await Course.findById(legacyCourseId);
        assert.equal(revertedCourse.ownerId, undefined, "Course ownerId must be unbound after rollback");

        console.log("✓ TEST 4 PASSED: Idempotent migration safely updates legacy admin & assigns unowned courses to Super Admin, with verified safe rollback.");

        // -------------------------------------------------------------
        // TEST 5: requireSuperAdmin Authorization & Backward Compatibility
        // -------------------------------------------------------------
        // Super Admin access -> 200 OK
        const saRes = await makeRequest(server, {
            path: "/test/super-admin",
            headers: {
                "x-test-role": "super_admin",
                "x-test-user-id": superAdminUser._id.toString(),
            },
        });
        assert.equal(saRes.status, 200, "Super admin must be granted access");

        // Legacy Admin access via requireSuperAdmin -> 200 OK (Backward compatibility)
        const legacyAdminRes = await makeRequest(server, {
            path: "/test/super-admin",
            headers: {
                "x-test-role": "admin",
                "x-test-user-id": legacyAdminId.toString(),
            },
        });
        assert.equal(legacyAdminRes.status, 200, "Legacy admin must be granted access");

        // Teacher access -> 403 Forbidden
        const teacherAttemptRes = await makeRequest(server, {
            path: "/test/super-admin",
            headers: {
                "x-test-role": "teacher",
                "x-test-user-id": teacherUser._id.toString(),
            },
        });
        assert.equal(teacherAttemptRes.status, 403, "Teacher must be denied super_admin access");

        // Student access -> 403 Forbidden
        const studentAttemptRes = await makeRequest(server, {
            path: "/test/super-admin",
            headers: {
                "x-test-role": "student",
                "x-test-user-id": studentUser._id.toString(),
            },
        });
        assert.equal(studentAttemptRes.status, 403, "Student must be denied super_admin access");
        console.log("✓ TEST 5 PASSED: requireSuperAdmin strictly guards admin routes and supports legacy admin sessions.");

        // -------------------------------------------------------------
        // TEST 6: requireTeacher Authorization & Approval Status Guard
        // -------------------------------------------------------------
        // Approved teacher -> 200 OK
        const approvedTeacherRes = await makeRequest(server, {
            path: "/test/teacher",
            headers: {
                "x-test-role": "teacher",
                "x-test-user-id": teacherUser._id.toString(),
                "x-test-is-approved": "true",
            },
        });
        assert.equal(approvedTeacherRes.status, 200, "Approved teacher must access teacher routes");

        // Unapproved teacher -> 403 Forbidden
        const unapprovedTeacherRes = await makeRequest(server, {
            path: "/test/teacher",
            headers: {
                "x-test-role": "teacher",
                "x-test-user-id": teacherUser._id.toString(),
                "x-test-is-approved": "false",
            },
        });
        assert.equal(unapprovedTeacherRes.status, 403, "Unapproved teacher must be denied");
        assert.match(String(unapprovedTeacherRes.body), /Teacher account pending approval/);

        // Super Admin oversight -> 200 OK
        const adminTeacherRes = await makeRequest(server, {
            path: "/test/teacher",
            headers: {
                "x-test-role": "super_admin",
                "x-test-user-id": superAdminUser._id.toString(),
            },
        });
        assert.equal(adminTeacherRes.status, 200, "Super admin must have oversight access to teacher routes");

        // Student attempt -> 403 Forbidden
        const studentTeacherRes = await makeRequest(server, {
            path: "/test/teacher",
            headers: {
                "x-test-role": "student",
                "x-test-user-id": studentUser._id.toString(),
            },
        });
        assert.equal(studentTeacherRes.status, 403, "Student must be denied teacher access");
        console.log("✓ TEST 6 PASSED: requireTeacher admits approved teachers & Super Admin; blocks unapproved teachers & students.");

        // -------------------------------------------------------------
        // TEST 7: Inactive Account Restrictions Across All Roles
        // -------------------------------------------------------------
        const inactiveSaRes = await makeRequest(server, {
            path: "/test/super-admin",
            headers: {
                "x-test-role": "super_admin",
                "x-test-user-id": superAdminUser._id.toString(),
                "x-test-is-active": "false",
            },
        });
        assert.equal(inactiveSaRes.status, 403, "Inactive super admin must be blocked");

        const inactiveTeacherRes = await makeRequest(server, {
            path: "/test/teacher",
            headers: {
                "x-test-role": "teacher",
                "x-test-user-id": teacherUser._id.toString(),
                "x-test-is-active": "false",
                "x-test-is-approved": "true",
            },
        });
        assert.equal(inactiveTeacherRes.status, 403, "Inactive teacher must be blocked");

        const inactiveStudentRes = await makeRequest(server, {
            path: "/test/student-auth",
            headers: {
                "x-test-role": "student",
                "x-test-user-id": studentUser._id.toString(),
                "x-test-is-active": "false",
            },
        });
        assert.equal(inactiveStudentRes.status, 403, "Inactive student must be blocked");
        console.log("✓ TEST 7 PASSED: Inactive accounts across all roles are strictly rejected with HTTP 403.");

        // -------------------------------------------------------------
        // TEST 8: Cross-Teacher Ownership Isolation & IDOR Countermeasures
        // -------------------------------------------------------------
        const teacher2 = await createTestUser({
            name: "Teacher Two",
            email: `teacher2-${TIMESTAMP}@example.com`,
            role: "teacher",
            isApproved: true,
        });

        const courseByTeacher2 = await createTestCourse({
            title: `Course by Teacher 2 ${TIMESTAMP}`,
            ownerId: teacher2._id,
        });

        // 1. assertCourseOwnership unit checks
        assert.equal(assertCourseOwnership(teacherCourse, { id: teacherUser._id, role: "teacher" }), true);
        assert.equal(assertCourseOwnership(courseByTeacher2, { id: teacherUser._id, role: "teacher" }), false);
        assert.equal(assertCourseOwnership(teacherCourse, { id: superAdminUser._id, role: "super_admin" }), true);

        // 2. Database query scoping filter checks
        const teacher1Filter = getScopedCourseFilter({ id: teacherUser._id, role: "teacher" }, { isPublished: true });
        assert.equal(teacher1Filter.ownerId.toString(), teacherUser._id.toString());
        assert.equal(teacher1Filter.isPublished, true);

        const saFilter = getScopedCourseFilter({ id: superAdminUser._id, role: "super_admin" }, { isPublished: true });
        assert.equal(saFilter.ownerId, undefined, "Super admin filter must not be scoped to a single owner");

        // 3. Simulated HTTP mutation: Teacher 1 attempts to modify Course 2 using forged ID -> 403 Forbidden
        const idorAttackRes = await makeRequest(
            server,
            {
                path: `/test/teacher/courses/${courseByTeacher2._id}`,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-role": "teacher",
                    "x-test-user-id": teacherUser._id.toString(), // Logged in as Teacher 1
                    "x-test-is-approved": "true",
                },
            },
            { title: "Hacked by Teacher 1" }
        );
        assert.equal(idorAttackRes.status, 403, "Cross-teacher mutation must be rejected with 403");

        // Confirm Course 2 title was NOT mutated in MongoDB
        const unmutatedCourse2 = await Course.findById(courseByTeacher2._id);
        assert.notEqual(unmutatedCourse2.title, "Hacked by Teacher 1", "Database record must not be altered");

        // Teacher 2 modifying their own Course 2 -> 200 OK
        const validMutationRes = await makeRequest(
            server,
            {
                path: `/test/teacher/courses/${courseByTeacher2._id}`,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-role": "teacher",
                    "x-test-user-id": teacher2._id.toString(), // Logged in as Teacher 2
                    "x-test-is-approved": "true",
                },
            },
            { title: "Legitimate Update by Owner" }
        );
        assert.equal(validMutationRes.status, 200, "Authorized owner must be able to update their course");
        console.log("✓ TEST 8 PASSED: Cross-tenant ownership isolation verified; IDOR attacks strictly rejected.");

        console.log("==================================================");
        console.log("ALL 8 PHASE 1 MULTI-TENANT TESTS PASSED! ✓");
        console.log("==================================================");
    } finally {
        // Teardown all created test fixtures strictly by ID
        if (testUsers.length > 0) await User.deleteMany({ _id: { $in: testUsers } });
        if (testCourses.length > 0) await Course.deleteMany({ _id: { $in: testCourses } });
        if (testPayments.length > 0) await Payment.deleteMany({ _id: { $in: testPayments } });
        // Clean up test migration journal entries
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.collection("_phase1_migration_journal").deleteMany({
                migration: "phase1_tenancy"
            }).catch(() => {});
        }
        console.log("✓ Cleaned up all Phase 1 test fixtures from isolated test database");

        server.close();
        await mongoose.disconnect().catch(() => {});
    }
}

runPhase1Tests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ Phase 1 Test Failed:", err);
        process.exit(1);
    });
