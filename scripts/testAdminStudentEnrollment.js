import "dotenv/config";
import mongoose from "mongoose";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import adminRoutes from "../routes/adminRoutes.js";
import authRoutes from "../routes/authRoutes.js";
import studentRoutes from "../routes/studentRoutes.js";
import publicRoutes from "../routes/publicRoutes.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAdminStudentEnrollmentTests() {
    console.log("=== STARTING ADMIN STUDENT & ENROLLMENT TESTS ===");
    let server;
    let testAdmin;
    let testStudentUser;
    let testCoursePublished;
    let testCourseDraft;
    let createdStudentId;
    let createdEnrollmentId;

    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI missing in .env");
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✓ Connected to MongoDB Atlas");

        const app = express();
        app.set("view engine", "ejs");
        app.set("views", path.join(__dirname, "../views"));
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());

        // Test session setup with role injection header for automated API testing
        app.use(
            session({
                secret: "test-admin-secret-key-123456789",
                resave: false,
                saveUninitialized: false,
                cookie: { secure: false },
            })
        );

        // Header-based session injector for testing authorization roles
        app.use((req, res, next) => {
            const authHeader = req.headers["x-test-auth"];
            if (authHeader === "admin" && testAdmin) {
                req.session.user = {
                    id: testAdmin._id.toString(),
                    name: testAdmin.name,
                    email: testAdmin.email,
                    role: "admin",
                    isActive: true,
                    mustChangePassword: false,
                };
            } else if (authHeader === "student" && testStudentUser) {
                req.session.user = {
                    id: testStudentUser._id.toString(),
                    name: testStudentUser.name,
                    email: testStudentUser.email,
                    role: "student",
                    isActive: true,
                    mustChangePassword: false,
                };
            }
            next();
        });

        app.use(publicRoutes);
        app.use(authRoutes);
        app.use(studentRoutes);
        app.use("/admin", adminRoutes);

        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });

        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`✓ Test server running at ${baseUrl}`);

        const timestamp = Date.now();

        // 1. Create fixtures: an Admin, a Student, a Published Course, a Draft Course
        const passwordHash = await bcrypt.hash("Password123!", 10);
        testAdmin = await User.create({
            name: "Test Admin",
            email: `testadmin-${timestamp}@example.com`,
            phone: "9998887770",
            passwordHash,
            role: "admin",
            mustChangePassword: false,
            isActive: true,
        });

        testStudentUser = await User.create({
            name: "Existing Student",
            email: `teststudent-${timestamp}@example.com`,
            phone: "9998887771",
            passwordHash,
            role: "student",
            mustChangePassword: false,
            isActive: true,
        });

        testCoursePublished = await Course.create({
            title: `Admin Test Published Course ${timestamp}`,
            slug: `admin-test-pub-${timestamp}`,
            description: "Test description",
            price: 1499,
            isPublished: true,
        });

        testCourseDraft = await Course.create({
            title: `Admin Test Draft Course ${timestamp}`,
            slug: `admin-test-draft-${timestamp}`,
            description: "Test draft description",
            price: 2999,
            isPublished: false,
        });

        console.log("✓ Fixtures created");

        // TEST 1: Authorization checks
        {
            // Anonymous -> Redirect 302 to /login
            const anonRes = await fetch(`${baseUrl}/admin/students`, { redirect: "manual" });
            if (anonRes.status !== 302 || !anonRes.headers.get("location")?.includes("/login")) {
                throw new Error(`Expected 302 redirect for anonymous /admin/students, got ${anonRes.status}`);
            }

            const anonEnrollRes = await fetch(`${baseUrl}/admin/enrollments`, { redirect: "manual" });
            if (anonEnrollRes.status !== 302) {
                throw new Error(`Expected 302 redirect for anonymous /admin/enrollments, got ${anonEnrollRes.status}`);
            }

            // Student role -> HTTP 403 Forbidden
            const studentRes = await fetch(`${baseUrl}/admin/students`, {
                headers: { "x-test-auth": "student" },
            });
            if (studentRes.status !== 403) {
                throw new Error(`Expected 403 for student accessing /admin/students, got ${studentRes.status}`);
            }

            const studentPostRes = await fetch(`${baseUrl}/admin/enrollments`, {
                method: "POST",
                headers: { "x-test-auth": "student", "Content-Type": "application/x-www-form-urlencoded" },
                body: "userId=123&courseId=456",
            });
            if (studentPostRes.status !== 403) {
                throw new Error(`Expected 403 for student mutating /admin/enrollments, got ${studentPostRes.status}`);
            }

            console.log("✓ TEST 1 PASSED: Strict authorization enforced (anonymous redirected, student role denied with 403).");
        }

        // TEST 2: Admin Student Creation
        {
            const newStudentEmail = `created-student-${timestamp}@example.com`;
            const formBody = new URLSearchParams({
                name: "New Enrolled Student",
                email: newStudentEmail,
                phone: "9123456789",
                password: "InitialPassword123!",
                isActive: "true",
            });

            const res = await fetch(`${baseUrl}/admin/students`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formBody.toString(),
                redirect: "manual",
            });

            if (res.status !== 302) {
                throw new Error(`Expected 302 redirect after student creation, got ${res.status}`);
            }

            const studentInDb = await User.findOne({ email: newStudentEmail }).select("+passwordHash");
            if (!studentInDb) {
                throw new Error("Student was not saved in database");
            }
            if (studentInDb.role !== "student") {
                throw new Error(`Expected role student, got ${studentInDb.role}`);
            }
            if (!studentInDb.mustChangePassword) {
                throw new Error("Expected mustChangePassword to be true for newly created student");
            }
            if (!(await bcrypt.compare("InitialPassword123!", studentInDb.passwordHash))) {
                throw new Error("Password hash verification failed for created student");
            }

            createdStudentId = studentInDb._id.toString();
            console.log("✓ TEST 2 PASSED: Admin successfully created student with secure hashed password and forced reset flag.");
        }

        // TEST 3: Duplicate Email Prevention
        {
            const duplicateFormBody = new URLSearchParams({
                name: "Duplicate Person",
                email: `created-student-${timestamp}@example.com`,
                phone: "9123456780",
                password: "AnotherPassword123!",
            });

            const res = await fetch(`${baseUrl}/admin/students`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: duplicateFormBody.toString(),
            });

            if (res.status !== 409) {
                throw new Error(`Expected 409 Conflict for duplicate email, got ${res.status}`);
            }
            const text = await res.text();
            if (!text.includes("already exists")) {
                throw new Error("Expected error message about existing account");
            }
            console.log("✓ TEST 3 PASSED: Duplicate email correctly blocked with HTTP 409.");
        }

        // TEST 4: Student Detail Page & Search
        {
            // Search test
            const searchRes = await fetch(`${baseUrl}/admin/students?search=created-student-${timestamp}`, {
                headers: { "x-test-auth": "admin" },
            });
            if (searchRes.status !== 200) throw new Error(`Search returned ${searchRes.status}`);
            const searchHtml = await searchRes.text();
            if (!searchHtml.includes("New Enrolled Student")) {
                throw new Error("Search results do not include created student");
            }

            // Detail page test
            const detailRes = await fetch(`${baseUrl}/admin/students/${createdStudentId}`, {
                headers: { "x-test-auth": "admin" },
            });
            if (detailRes.status !== 200) throw new Error(`Detail page returned ${detailRes.status}`);
            const detailHtml = await detailRes.text();
            if (!detailHtml.includes("New Enrolled Student") || !detailHtml.includes("Course Enrollments")) {
                throw new Error("Detail page missing student information");
            }

            // Invalid student ID test
            const invalidIdRes = await fetch(`${baseUrl}/admin/students/123456789012345678901234`, {
                headers: { "x-test-auth": "admin" },
            });
            if (invalidIdRes.status !== 404) {
                throw new Error(`Expected 404 for non-existent student ID, got ${invalidIdRes.status}`);
            }

            console.log("✓ TEST 4 PASSED: Student directory search and detail page function correctly; invalid IDs return 404.");
        }

        // TEST 5: Manual Course Enrollment (Published vs Unpublished)
        {
            // Attempt to enroll into an UNPUBLISHED course -> HTTP 400
            const draftEnrollBody = new URLSearchParams({
                userId: createdStudentId,
                courseId: testCourseDraft._id.toString(),
                status: "active",
            });
            const draftRes = await fetch(`${baseUrl}/admin/enrollments`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: draftEnrollBody.toString(),
            });
            if (draftRes.status !== 400) {
                throw new Error(`Expected 400 when enrolling into unpublished course, got ${draftRes.status}`);
            }

            // Enroll into PUBLISHED course -> HTTP 302
            const pubEnrollBody = new URLSearchParams({
                userId: createdStudentId,
                courseId: testCoursePublished._id.toString(),
                status: "active",
            });
            const pubRes = await fetch(`${baseUrl}/admin/enrollments`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: pubEnrollBody.toString(),
                redirect: "manual",
            });
            if (pubRes.status !== 302) {
                throw new Error(`Expected 302 redirect after enrollment, got ${pubRes.status}`);
            }

            const enrollmentInDb = await Enrollment.findOne({
                userId: createdStudentId,
                courseId: testCoursePublished._id,
            });
            if (!enrollmentInDb || enrollmentInDb.status !== "active") {
                throw new Error("Enrollment not created or status is not active");
            }
            if (!enrollmentInDb.approvedAt) {
                throw new Error("approvedAt was not set for active enrollment");
            }

            createdEnrollmentId = enrollmentInDb._id.toString();
            console.log("✓ TEST 5 PASSED: Published course enrolled successfully; draft course enrollment safely rejected with 400.");
        }

        // TEST 6: Duplicate Enrollment Prevention
        {
            const duplicateEnrollBody = new URLSearchParams({
                userId: createdStudentId,
                courseId: testCoursePublished._id.toString(),
                status: "active",
            });
            const res = await fetch(`${baseUrl}/admin/enrollments`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: duplicateEnrollBody.toString(),
            });
            if (res.status !== 409) {
                throw new Error(`Expected 409 Conflict for duplicate enrollment, got ${res.status}`);
            }
            console.log("✓ TEST 6 PASSED: Duplicate enrollment blocked with HTTP 409 conflict.");
        }

        // TEST 7: Status Transitions & Progress Preservation
        {
            // Seed a progress record to verify it is NOT deleted when suspended
            const dummyLesson = await Lesson.create({
                courseId: testCoursePublished._id,
                title: "Dummy Lesson",
                order: 999,
                isPublished: true,
            });

            await Progress.create({
                userId: createdStudentId,
                lessonId: dummyLesson._id,
                lastPositionSeconds: 120,
                completed: false,
            });

            // Transition to 'suspended'
            const suspendBody = new URLSearchParams({ status: "suspended" });
            const suspendRes = await fetch(`${baseUrl}/admin/enrollments/${createdEnrollmentId}/status`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: suspendBody.toString(),
                redirect: "manual",
            });
            if (suspendRes.status !== 302) {
                throw new Error(`Expected 302 after status update, got ${suspendRes.status}`);
            }

            const suspendedInDb = await Enrollment.findById(createdEnrollmentId);
            if (suspendedInDb.status !== "suspended") {
                throw new Error(`Expected status suspended, got ${suspendedInDb.status}`);
            }

            // Verify progress record is still intact
            const progressRecord = await Progress.findOne({
                userId: createdStudentId,
                lessonId: dummyLesson._id,
            });
            if (!progressRecord || progressRecord.lastPositionSeconds !== 120) {
                throw new Error("Progress record was modified or deleted when enrollment was suspended!");
            }

            // Transition to invalid status -> HTTP 400
            const invalidStatusRes = await fetch(`${baseUrl}/admin/enrollments/${createdEnrollmentId}/status`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ status: "invalid_status_xyz" }).toString(),
            });
            if (invalidStatusRes.status !== 400) {
                throw new Error(`Expected 400 for invalid status transition, got ${invalidStatusRes.status}`);
            }

            // Transition to 'active' again
            await fetch(`${baseUrl}/admin/enrollments/${createdEnrollmentId}/status`, {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ status: "active" }).toString(),
            });
            const reactivatedInDb = await Enrollment.findById(createdEnrollmentId);
            if (reactivatedInDb.status !== "active") {
                throw new Error(`Expected reactivated status active, got ${reactivatedInDb.status}`);
            }

            // Clean up dummy lesson & progress
            await Progress.deleteMany({ userId: createdStudentId });
            await Lesson.findByIdAndDelete(dummyLesson._id);

            console.log("✓ TEST 7 PASSED: Status transitions (active -> suspended -> active) validated; progress preserved during suspension.");
        }

        console.log("==================================================");
        console.log("ALL ADMIN STUDENT & ENROLLMENT TESTS PASSED! ✓");
        console.log("==================================================");
    } catch (err) {
        console.error("TEST FAILED ✗:", err);
        process.exitCode = 1;
    } finally {
        try {
            if (createdEnrollmentId) await Enrollment.findByIdAndDelete(createdEnrollmentId);
            if (createdStudentId) {
                await Progress.deleteMany({ userId: createdStudentId });
                await User.findByIdAndDelete(createdStudentId);
            }
            if (testCourseDraft) await Course.findByIdAndDelete(testCourseDraft._id);
            if (testCoursePublished) await Course.findByIdAndDelete(testCoursePublished._id);
            if (testStudentUser) await User.findByIdAndDelete(testStudentUser._id);
            if (testAdmin) await User.findByIdAndDelete(testAdmin._id);
            console.log("✓ Test fixtures cleaned up from database");
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }

        if (server) server.close();
        await mongoose.disconnect().catch(() => {});
    }
}

runAdminStudentEnrollmentTests();
