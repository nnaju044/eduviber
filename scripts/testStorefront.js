import "dotenv/config";
import mongoose from "mongoose";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import publicRoutes from "../routes/publicRoutes.js";
import authRoutes from "../routes/authRoutes.js";
import studentRoutes from "../routes/studentRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runStorefrontTests() {
    console.log("=== STARTING STOREFRONT TESTS ===");
    let server;
    let testCoursePublished;
    let testCourseDraft;
    let testLessonPublished;
    let testLessonDraft;

    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI missing in .env");
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✓ Connected to MongoDB Atlas");

        // Set up test express app mirroring server.js
        const app = express();
        app.set("view engine", "ejs");
        app.set("views", path.join(__dirname, "../views"));
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());

        // In-memory session for test suite
        app.use(
            session({
                secret: "test-secret-key-1234567890",
                resave: false,
                saveUninitialized: false,
                cookie: { secure: false },
            })
        );

        app.use(publicRoutes);
        app.use(authRoutes);
        app.use(studentRoutes);
        app.use("/admin", adminRoutes);

        app.use((req, res) => {
            res.status(404).render("public/404", {
                message: "Page Not Found",
                user: req.session?.user || null,
            });
        });

        // Start test server on ephemeral port
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });

        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`✓ Test server running at ${baseUrl}`);

        // Create temporary test fixtures in DB
        const timestamp = Date.now();
        testCoursePublished = await Course.create({
            title: `Automated Test Published Course ${timestamp}`,
            slug: `test-published-${timestamp}`,
            description: "A published course for automated validation",
            instructor: "Test Instructor",
            price: 999,
            isPublished: true,
        });

        testCourseDraft = await Course.create({
            title: `Automated Test Draft Course ${timestamp}`,
            slug: `test-draft-${timestamp}`,
            description: "A draft course that must never appear publicly",
            instructor: "Secret Instructor",
            price: 1999,
            isPublished: false,
        });

        testLessonPublished = await Lesson.create({
            courseId: testCoursePublished._id,
            title: "Published Lesson 101",
            description: "Visible lesson description",
            moduleName: "Module 1",
            order: 1,
            durationSeconds: 300,
            bunnyVideoId: "11111111-2222-3333-4444-555555555555",
            isPublished: true,
        });

        testLessonDraft = await Lesson.create({
            courseId: testCoursePublished._id,
            title: "Secret Draft Lesson 102",
            description: "Draft lesson that should not appear",
            moduleName: "Module 1",
            order: 2,
            durationSeconds: 600,
            bunnyVideoId: "99999999-8888-7777-6666-555555555555",
            isPublished: false,
        });

        console.log("✓ Test fixtures created in database");

        // TEST 1: Anonymous visitor can view landing page
        {
            const res = await fetch(`${baseUrl}/`);
            if (res.status !== 200) throw new Error(`Landing page returned ${res.status}`);
            const html = await res.text();
            if (!html.includes(testCoursePublished.title)) {
                throw new Error("Landing page does not display published course");
            }
            if (html.includes(testCourseDraft.title)) {
                throw new Error("SECURITY VIOLATION: Landing page displays draft course!");
            }
            console.log("✓ TEST 1 PASSED: Landing page shows published courses and conceals draft courses.");
        }

        // TEST 2: Anonymous visitor can view catalog
        {
            const res = await fetch(`${baseUrl}/courses`);
            if (res.status !== 200) throw new Error(`Catalogue returned ${res.status}`);
            const html = await res.text();
            if (!html.includes(testCoursePublished.title)) {
                throw new Error("Catalogue does not display published course");
            }
            if (html.includes(testCourseDraft.title)) {
                throw new Error("SECURITY VIOLATION: Catalogue displays draft course!");
            }
            console.log("✓ TEST 2 PASSED: Course catalogue displays only published courses.");
        }

        // TEST 3: Course detail shows published lessons, hides draft lessons, hides bunnyVideoId
        {
            const res = await fetch(`${baseUrl}/courses/${testCoursePublished.slug}`);
            if (res.status !== 200) throw new Error(`Course detail returned ${res.status}`);
            const html = await res.text();
            if (!html.includes("Published Lesson 101")) {
                throw new Error("Course detail does not show published lesson");
            }
            if (html.includes("Secret Draft Lesson 102")) {
                throw new Error("SECURITY VIOLATION: Course detail shows draft lesson!");
            }
            if (html.includes(testLessonPublished.bunnyVideoId)) {
                throw new Error("SECURITY VIOLATION: Raw video ID leaked in public HTML!");
            }
            if (!html.includes(`/courses/${testCoursePublished.slug}/enroll`)) {
                throw new Error("Enrollment CTA link missing from course detail page");
            }
            console.log("✓ TEST 3 PASSED: Course detail renders syllabus safely and hides draft lessons/video IDs.");
        }

        // TEST 4: Draft course slug returns 404
        {
            const res = await fetch(`${baseUrl}/courses/${testCourseDraft.slug}`);
            if (res.status !== 404) {
                throw new Error(`Expected 404 for draft course, got ${res.status}`);
            }
            console.log("✓ TEST 4 PASSED: Draft course slug correctly returns 404.");
        }

        // TEST 5: Invalid slug returns 404
        {
            const res = await fetch(`${baseUrl}/courses/non-existent-course-slug-xyz`);
            if (res.status !== 404) {
                throw new Error(`Expected 404 for invalid slug, got ${res.status}`);
            }
            console.log("✓ TEST 5 PASSED: Non-existent slug correctly returns 404.");
        }

        // TEST 6: Purchase CTA routes to planned manual workflow (/courses/:slug/enroll)
        {
            const res = await fetch(`${baseUrl}/courses/${testCoursePublished.slug}/enroll`);
            if (res.status !== 200) {
                throw new Error(`Expected 200 for enrollment page, got ${res.status}`);
            }
            const html = await res.text();
            if (!html.includes("Account Required") && !html.includes("Enrollment & Payment")) {
                throw new Error("Enrollment page content mismatch");
            }
            console.log("✓ TEST 6 PASSED: Purchase CTA links to real manual enrollment workflow.");
        }

        // TEST 7: Login and Admin routes still work
        {
            const loginRes = await fetch(`${baseUrl}/login`);
            if (loginRes.status !== 200) {
                throw new Error(`Expected 200 for /login, got ${loginRes.status}`);
            }

            const adminRes = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
            // Should redirect unauthenticated visitor to /login
            if (adminRes.status !== 302 || !adminRes.headers.get("location")?.includes("/login")) {
                throw new Error(`Expected 302 redirect to /login for /admin, got ${adminRes.status}`);
            }
            console.log("✓ TEST 7 PASSED: Existing /login and /admin route protections preserved.");
        }

        console.log("==================================================");
        console.log("ALL 7 TESTS PASSED SUCCESSFULLY! ✓");
        console.log("==================================================");
    } catch (err) {
        console.error("TEST FAILED ✗:", err);
        process.exitCode = 1;
    } finally {
        // Clean up fixtures
        try {
            if (testLessonDraft) await Lesson.findByIdAndDelete(testLessonDraft._id);
            if (testLessonPublished) await Lesson.findByIdAndDelete(testLessonPublished._id);
            if (testCourseDraft) await Course.findByIdAndDelete(testCourseDraft._id);
            if (testCoursePublished) await Course.findByIdAndDelete(testCoursePublished._id);
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

runStorefrontTests();
