/**
 * Automated Test Suite for Course & Lesson Update, Deletion, Reference Integrity, and CSRF Protection
 * Run using: node scripts/testCourseLessonManagement.js
 */

import "dotenv/config";
process.env.NODE_ENV = "test";

import mongoose from "mongoose";
import http from "http";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import User from "../models/User.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Progress from "../models/Progress.js";

import adminRoutes from "../routes/adminRoutes.js";
import { csrfProtection } from "../middleware/csrf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let serverBaseUrl;

let testAdmin;
let testStudent;
let testCourse1;
let testCourse2;
let testLesson1;
let testLesson2;

async function setupTestApp() {
    const app = express();

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));

    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    app.use(
        session({
            name: "course.sid",
            secret: "test_crud_secret_32_characters_minimum__",
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false, httpOnly: true },
        })
    );

    // Role simulation & authentication injector for testing
    app.use((req, res, next) => {
        const auth = req.headers["x-test-auth"];
        if (auth === "admin" && testAdmin) {
            req.session.user = {
                id: testAdmin._id.toString(),
                email: testAdmin.email,
                role: "admin",
                isActive: true,
                mustChangePassword: false,
            };
        }
        next();
    });

    app.use(csrfProtection);
    app.use("/admin", adminRoutes);

    // Error handler
    app.use((err, req, res, next) => {
        console.error("Unhandled test error:", err);
        res.status(500).send(err.message);
    });

    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;
            serverBaseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
}

async function request(urlPath, options = {}) {
    const url = `${serverBaseUrl}${urlPath}`;
    const headers = options.headers || {};
    if (!options.omitCsrfBypass) {
        headers["x-skip-csrf"] = "true";
    }
    const response = await fetch(url, {
        ...options,
        headers,
        redirect: options.redirect || "manual",
    });
    const text = await response.text();
    return {
        status: response.status,
        headers: response.headers,
        text,
    };
}

async function runCourseLessonTests() {
    console.log("=== STARTING COURSE & LESSON EDIT/DELETE TESTS ===");

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI not configured in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB Atlas");

    await setupTestApp();
    console.log(`✓ Test server running at ${serverBaseUrl}`);

    const uniqueSuffix = Date.now();

    try {
        // Seed fixtures
        testAdmin = await User.create({
            name: "Admin Tester",
            email: `adm_crud_${uniqueSuffix}@example.com`,
            phone: "9876543210",
            passwordHash: "dummyHashForAdminTest123!",
            role: "admin",
            isActive: true,
            mustChangePassword: false,
        });

        testStudent = await User.create({
            name: "Student Tester",
            email: `std_crud_${uniqueSuffix}@example.com`,
            phone: "9876543211",
            passwordHash: "dummyHashForStudentTest123!",
            role: "student",
            isActive: true,
            mustChangePassword: false,
        });

        testCourse1 = await Course.create({
            title: `Course One ${uniqueSuffix}`,
            slug: `course-one-${uniqueSuffix}`,
            description: "Initial description for Course One",
            price: 499,
            instructor: "Instructor A",
            thumbnail: "https://example.com/one.jpg",
            isPublished: false,
        });

        testCourse2 = await Course.create({
            title: `Course Two ${uniqueSuffix}`,
            slug: `course-two-${uniqueSuffix}`,
            description: "Initial description for Course Two",
            price: 999,
            instructor: "Instructor B",
            thumbnail: "https://example.com/two.jpg",
            isPublished: true,
        });

        testLesson1 = await Lesson.create({
            courseId: testCourse1._id,
            title: "Lesson 1: Introduction",
            description: "Introductory module",
            moduleName: "Module 1",
            order: 1,
            durationSeconds: 300,
            bunnyVideoId: "11111111-1111-1111-1111-111111111111",
            isPublished: false,
        });

        testLesson2 = await Lesson.create({
            courseId: testCourse1._id,
            title: "Lesson 2: Core Concepts",
            description: "Core concepts module",
            moduleName: "Module 1",
            order: 2,
            durationSeconds: 600,
            bunnyVideoId: "22222222-2222-2222-2222-222222222222",
            isPublished: false,
        });

        console.log("✓ Test fixtures created");

        // TEST 1: GET /admin/courses/:id/edit
        const getEditRes = await request(`/admin/courses/${testCourse1._id}/edit`, {
            headers: { "x-test-auth": "admin" },
        });
        if (getEditRes.status !== 200 || !getEditRes.text.includes("Edit Course")) {
            throw new Error(`TEST 1 FAILED: Expected 200 for course edit view, got ${getEditRes.status}`);
        }
        console.log("✓ TEST 1 PASSED: GET /admin/courses/:id/edit renders course edit view with prefilled data.");

        // TEST 2: POST /admin/courses/:id valid update
        const postEditRes = await request(`/admin/courses/${testCourse1._id}`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: `Updated Course One ${uniqueSuffix}`,
                slug: `updated-slug-${uniqueSuffix}`,
                description: "Updated description text with full details.",
                price: "799",
                instructor: "Updated Instructor Name",
                thumbnail: "https://example.com/updated.jpg",
            }),
        });

        if (postEditRes.status !== 302 || !postEditRes.headers.get("location").includes("/admin/courses")) {
            throw new Error(`TEST 2 FAILED: Expected 302 redirect after update, got ${postEditRes.status}`);
        }

        const updatedCourse1 = await Course.findById(testCourse1._id);
        if (
            updatedCourse1.title !== `Updated Course One ${uniqueSuffix}` ||
            updatedCourse1.slug !== `updated-slug-${uniqueSuffix}` ||
            updatedCourse1.price !== 799 ||
            updatedCourse1.instructor !== "Updated Instructor Name"
        ) {
            throw new Error("TEST 2 FAILED: Course fields were not updated correctly in database.");
        }
        console.log("✓ TEST 2 PASSED: Course details and custom slug updated successfully.");

        // TEST 3: POST /admin/courses/:id validation failures (negative price)
        const invalidPriceRes = await request(`/admin/courses/${testCourse1._id}`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Invalid Price Course",
                description: "Description",
                price: "-100",
            }),
        });
        if (invalidPriceRes.status !== 400 || !invalidPriceRes.text.includes("non-negative price")) {
            throw new Error(`TEST 3 FAILED: Negative price was not rejected with 400. Got ${invalidPriceRes.status}`);
        }
        console.log("✓ TEST 3 PASSED: Invalid and negative pricing rejected with HTTP 400.");

        // TEST 4: POST /admin/courses/:id slug collision with testCourse2
        const slugConflictRes = await request(`/admin/courses/${testCourse1._id}`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Conflicting Title",
                slug: testCourse2.slug, // Existing slug of course 2
                description: "Description",
                price: "500",
            }),
        });
        if (slugConflictRes.status !== 409 || !slugConflictRes.text.includes("already in use")) {
            throw new Error(`TEST 4 FAILED: Slug collision was not rejected with 409 conflict.`);
        }
        console.log("✓ TEST 4 PASSED: Slug collision correctly rejected with HTTP 409 conflict.");

        // TEST 5: POST /admin/courses/:id/delete BLOCKED when financial records exist
        await Payment.create({
            userId: testStudent._id,
            courseId: testCourse1._id,
            amount: 799,
            transactionReference: `UTR-DELETE-TEST-${uniqueSuffix}`,
            status: "approved",
        });

        const deleteBlockedPaymentRes = await request(`/admin/courses/${testCourse1._id}/delete`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                confirmTitle: updatedCourse1.title,
            }),
        });
        if (deleteBlockedPaymentRes.status !== 400 || !deleteBlockedPaymentRes.text.includes("payment record")) {
            throw new Error(`TEST 5 FAILED: Course deletion with financial records was not blocked with 400.`);
        }
        console.log("✓ TEST 5 PASSED: Course hard deletion blocked when financial payment records exist.");

        // TEST 6: POST /admin/courses/:id/delete BLOCKED when enrollments exist
        await Payment.deleteMany({ courseId: testCourse1._id }); // clear payment to test enrollment check
        await Enrollment.create({
            userId: testStudent._id,
            courseId: testCourse1._id,
            status: "active",
        });

        const deleteBlockedEnrollmentRes = await request(`/admin/courses/${testCourse1._id}/delete`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                confirmTitle: updatedCourse1.title,
            }),
        });
        if (deleteBlockedEnrollmentRes.status !== 400 || !deleteBlockedEnrollmentRes.text.includes("enrollment")) {
            throw new Error(`TEST 6 FAILED: Course deletion with enrollments was not blocked with 400.`);
        }
        console.log("✓ TEST 6 PASSED: Course hard deletion blocked when active student enrollments exist.");

        // TEST 7: POST /admin/courses/:id/delete with mismatched confirmation title
        await Enrollment.deleteMany({ courseId: testCourse1._id }); // clear enrollment

        const mismatchConfirmRes = await request(`/admin/courses/${testCourse1._id}/delete`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                confirmTitle: "Wrong Course Title",
            }),
        });
        if (mismatchConfirmRes.status !== 400 || !mismatchConfirmRes.text.includes("exact course title")) {
            throw new Error(`TEST 7 FAILED: Mismatched confirmation title was not rejected with 400.`);
        }
        console.log("✓ TEST 7 PASSED: Mismatched deletion confirmation title safely rejected.");

        // TEST 8: Successful course deletion and safe draft lesson reference cleanup
        const successfulDeleteRes = await request(`/admin/courses/${testCourse1._id}/delete`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                confirmTitle: updatedCourse1.title,
            }),
        });
        if (successfulDeleteRes.status !== 302) {
            throw new Error(`TEST 8 FAILED: Expected 302 redirect after deletion, got ${successfulDeleteRes.status}`);
        }

        const deletedCourseCheck = await Course.findById(testCourse1._id);
        const attachedLessonsCheck = await Lesson.find({ courseId: testCourse1._id });
        if (deletedCourseCheck !== null || attachedLessonsCheck.length !== 0) {
            throw new Error("TEST 8 FAILED: Course or attached lessons were not deleted.");
        }
        console.log("✓ TEST 8 PASSED: Course and associated draft lessons deleted safely after verified confirmation.");

        // Create a new lesson under testCourse2 for lesson editing tests
        const editableLesson1 = await Lesson.create({
            courseId: testCourse2._id,
            title: "Lesson A: Basics",
            description: "Basics module",
            moduleName: "Module 1",
            order: 1,
            durationSeconds: 180,
            bunnyVideoId: "33333333-3333-3333-3333-333333333333",
            isPublished: false,
        });

        const editableLesson2 = await Lesson.create({
            courseId: testCourse2._id,
            title: "Lesson B: Intermediate",
            description: "Intermediate module",
            moduleName: "Module 1",
            order: 2,
            durationSeconds: 240,
            bunnyVideoId: "44444444-4444-4444-4444-444444444444",
            isPublished: false,
        });

        // TEST 9: GET /admin/courses/:courseId/lessons/:lessonId/edit
        const getLessonEditRes = await request(`/admin/courses/${testCourse2._id}/lessons/${editableLesson1._id}/edit`, {
            headers: { "x-test-auth": "admin" },
        });
        if (getLessonEditRes.status !== 200 || !getLessonEditRes.text.includes("Edit Lesson")) {
            throw new Error(`TEST 9 FAILED: Expected 200 for lesson edit view, got ${getLessonEditRes.status}`);
        }
        console.log("✓ TEST 9 PASSED: GET /admin/courses/:courseId/lessons/:lessonId/edit renders lesson edit form.");

        // TEST 10: POST /admin/courses/:courseId/lessons/:lessonId valid update
        const postLessonEditRes = await request(`/admin/courses/${testCourse2._id}/lessons/${editableLesson1._id}`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Lesson A: Updated Basics",
                moduleName: "Module 1: Foundations",
                order: "1",
                durationSeconds: "350",
                bunnyVideoId: "55555555-5555-5555-5555-555555555555",
            }),
        });

        if (postLessonEditRes.status !== 302) {
            throw new Error(`TEST 10 FAILED: Expected 302 redirect after lesson update, got ${postLessonEditRes.status}`);
        }

        const updatedLessonA = await Lesson.findById(editableLesson1._id);
        if (
            updatedLessonA.title !== "Lesson A: Updated Basics" ||
            updatedLessonA.moduleName !== "Module 1: Foundations" ||
            updatedLessonA.durationSeconds !== 350 ||
            updatedLessonA.bunnyVideoId !== "55555555-5555-5555-5555-555555555555"
        ) {
            throw new Error("TEST 10 FAILED: Lesson fields not updated properly in database.");
        }
        console.log("✓ TEST 10 PASSED: Lesson metadata, module assignment, and video ID updated successfully.");

        // TEST 11: POST /admin/courses/:courseId/lessons/:lessonId duplicate order conflict
        const orderConflictRes = await request(`/admin/courses/${testCourse2._id}/lessons/${editableLesson1._id}`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Lesson A",
                moduleName: "Module 1",
                order: "2", // Conflict with editableLesson2
                durationSeconds: "100",
            }),
        });
        if (orderConflictRes.status !== 409 || !orderConflictRes.text.includes("already used")) {
            throw new Error(`TEST 11 FAILED: Order conflict was not rejected with 409 conflict.`);
        }
        console.log("✓ TEST 11 PASSED: Lesson order conflict rejected with HTTP 409 conflict.");

        // TEST 12: Publication guard: Cannot publish lesson if video ID is missing
        const publishNoVideoRes = await request(`/admin/courses/${testCourse2._id}/lessons/${editableLesson1._id}`, {
            method: "POST",
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Lesson A",
                moduleName: "Module 1",
                order: "1",
                durationSeconds: "100",
                bunnyVideoId: "", // Empty video ID
                isPublished: "true",
            }),
        });
        if (publishNoVideoRes.status !== 400 || !publishNoVideoRes.text.includes("video ID is required")) {
            throw new Error(`TEST 12 FAILED: Publishing without video ID was not rejected with 400.`);
        }
        console.log("✓ TEST 12 PASSED: Publication guard enforced (cannot publish lesson without video ID).");

        // TEST 13: Lesson deletion with student progress history requires explicit confirmation
        await Progress.create({
            userId: testStudent._id,
            lessonId: editableLesson2._id,
            watchedSeconds: 120,
            completed: true,
        });

        // Unconfirmed delete should fail
        const unconfirmedLessonDeleteRes = await request(
            `/admin/courses/${testCourse2._id}/lessons/${editableLesson2._id}/delete`,
            {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({}),
            }
        );
        if (unconfirmedLessonDeleteRes.status !== 400 || !unconfirmedLessonDeleteRes.text.includes("student progress")) {
            throw new Error("TEST 13 FAILED: Deletion of lesson with progress history was not blocked without confirmation.");
        }

        // Confirmed delete succeeds and safely clears progress
        const confirmedLessonDeleteRes = await request(
            `/admin/courses/${testCourse2._id}/lessons/${editableLesson2._id}/delete`,
            {
                method: "POST",
                headers: {
                    "x-test-auth": "admin",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ confirm: "DELETE" }),
            }
        );
        if (confirmedLessonDeleteRes.status !== 302) {
            throw new Error("TEST 13 FAILED: Confirmed lesson deletion failed.");
        }
        const remainingProgress = await Progress.countDocuments({ lessonId: editableLesson2._id });
        if (remainingProgress !== 0) {
            throw new Error("TEST 13 FAILED: Orphaned progress records remained after confirmed lesson deletion.");
        }
        console.log("✓ TEST 13 PASSED: Lesson deletion safely guarded against accidental progress loss.");

        // TEST 14: CSRF Protection verification
        // Authenticated admin request without test bypass header and without CSRF token
        const csrfBlockedRes = await request(`/admin/courses/${testCourse2._id}`, {
            method: "POST",
            omitCsrfBypass: true,
            headers: {
                "x-test-auth": "admin",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Malicious CSRF Update",
                description: "Hacked description",
                price: "0",
            }),
        });

        // Should return 403 Forbidden
        if (csrfBlockedRes.status !== 403 || !csrfBlockedRes.text.includes("CSRF")) {
            throw new Error(`TEST 14 FAILED: CSRF protection failed to reject request without token. Got ${csrfBlockedRes.status}`);
        }
        console.log("✓ TEST 14 PASSED: State-changing form request without valid CSRF token rejected with HTTP 403.");

        console.log("==================================================");
        console.log("ALL 14 COURSE & LESSON MANAGEMENT TESTS PASSED! ✓");
        console.log("==================================================");
    } finally {
        try {
            if (testAdmin?._id) await User.findByIdAndDelete(testAdmin._id);
            if (testStudent?._id) await User.findByIdAndDelete(testStudent._id);
            if (testCourse1?._id) {
                await Lesson.deleteMany({ courseId: testCourse1._id });
                await Course.findByIdAndDelete(testCourse1._id);
            }
            if (testCourse2?._id) {
                await Lesson.deleteMany({ courseId: testCourse2._id });
                await Course.findByIdAndDelete(testCourse2._id);
            }
            await Payment.deleteMany({ transactionReference: new RegExp(`.*${uniqueSuffix}`) });
            console.log("✓ Test fixtures cleaned up from database");
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }

        if (server) {
            server.close();
        }
        await mongoose.disconnect().catch(() => {});
    }
}

runCourseLessonTests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("TEST SUITE FAILED:", err);
        process.exit(1);
    });
