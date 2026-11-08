import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import express from "express";
import session from "express-session";

import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import User from "../models/User.js";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";
import ContentAccess from "../models/ContentAccess.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

import apiRoutes from "../server-api/routes/index.js";
import studentRoutes from "../routes/studentRoutes.js";

function makeRequest(server, options, body = null, cookie = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const port = server.address().port;
        const reqHeaders = {
            "Content-Type": "application/json",
            ...extraHeaders,
        };
        if (cookie) reqHeaders["Cookie"] = cookie;

        const req = http.request(
            {
                hostname: "127.0.0.1",
                port,
                path: options.path,
                method: options.method || "GET",
                headers: reqHeaders,
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    let json = null;
                    try {
                        json = JSON.parse(data);
                    } catch { }
                    const setCookie = res.headers["set-cookie"];
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: json,
                        text: data,
                        cookie: setCookie ? setCookie[0].split(";")[0] : null,
                    });
                });
            }
        );

        req.on("error", reject);
        if (body) {
            req.write(typeof body === "string" ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function run() {
    console.log("==============================================================================");
    console.log(" [M02-T01] RUNNING LESSON & PROGRESS SCHEMA PERSISTENCE TEST SUITE");
    console.log("==============================================================================");

    process.env.NODE_ENV = "test";
    await connectTestDB(mongoose);
    assertTestDatabaseIsolation(mongoose);
    console.log("✓ Connected to isolated test database:", mongoose.connection.name);

    // Setup Express Test App
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(
        session({
            secret: "m02-test-secret-key-1234567890",
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false },
        })
    );

    // Test session simulator middleware
    app.use((req, res, next) => {
        const testUserHeader = req.headers["x-test-user-id"];
        const testRoleHeader = req.headers["x-test-role"];
        const testEmailHeader = req.headers["x-test-email"];
        if (testUserHeader) {
            req.session.user = {
                id: testUserHeader,
                role: testRoleHeader || "student",
                email: testEmailHeader || "student@test.com",
                name: "Test User",
                isActive: true,
            };
        }
        next();
    });

    app.use("/api", apiRoutes);
    app.use("/", studentRoutes);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    console.log(`✓ Test server running on http://127.0.0.1:${port}`);

    // Track test IDs for cleanup
    const testUserIds = [];
    const testCourseIds = [];
    const testLessonIds = [];
    const testProgressIds = [];
    const testEnrollmentIds = [];

    try {
        // Create test fixtures
        const teacher = await User.create({
            name: "Persistence Teacher",
            email: `teacher_m02_${Date.now()}@test.com`,
            phone: "+919876543210",
            passwordHash: "hash123",
            role: "teacher",
            teacherProfile: { isApproved: true, headline: "Persistence Expert" },
        });
        testUserIds.push(teacher._id);

        const student = await User.create({
            name: "Persistence Student",
            email: `student_m02_${Date.now()}@test.com`,
            phone: "+919876543211",
            passwordHash: "hash123",
            role: "student",
        });
        testUserIds.push(student._id);

        const unenrolledStudent = await User.create({
            name: "Unenrolled Student",
            email: `unenrolled_m02_${Date.now()}@test.com`,
            phone: "+919876543212",
            passwordHash: "hash123",
            role: "student",
        });
        testUserIds.push(unenrolledStudent._id);

        const course = await Course.create({
            title: "Persistence Course",
            slug: `persistence-course-${Date.now()}`,
            description: "Testing schema persistence",
            price: 499,
            ownerId: teacher._id,
            instructor: "Persistence Teacher",
            isPublished: true,
        });
        testCourseIds.push(course._id);

        // Active enrollment for `student`
        const enrollment = await Enrollment.create({
            userId: student._id,
            courseId: course._id,
            status: "active",
        });
        testEnrollmentIds.push(enrollment._id);

        // ======================================================================
        // TEST 1: DIRECT MONGOOSE LESSON SCHEMA PERSISTENCE
        // ======================================================================
        console.log("\n--- TEST 1: DIRECT MONGOOSE LESSON SCHEMA PERSISTENCE ---");
        const directLesson1 = await Lesson.create({
            courseId: course._id,
            title: "Lesson 1: Duration in Minutes & Free Preview",
            description: "Direct save test",
            moduleName: "Module A",
            order: 1,
            durationMinutes: 15,
            isFreePreview: true,
            bunnyVideoId: "11111111-1111-1111-1111-111111111111",
            isPublished: true,
        });
        testLessonIds.push(directLesson1._id);

        // Reload directly from MongoDB via lean query
        const reloadedLesson1 = await Lesson.findById(directLesson1._id).lean();
        assert.ok(reloadedLesson1, "Lesson 1 must exist in DB");
        assert.equal(reloadedLesson1.durationMinutes, 15, "durationMinutes must persist as 15");
        assert.equal(reloadedLesson1.durationSeconds, 900, "durationSeconds must auto-sync to 900 (15 * 60)");
        assert.equal(reloadedLesson1.isFreePreview, true, "isFreePreview must persist as true");
        console.log("✓ TEST 1.1 PASSED: Lesson with durationMinutes=15 and isFreePreview=true persisted accurately to MongoDB.");

        // Direct save with durationSeconds only -> auto-syncs durationMinutes
        const directLesson2 = await Lesson.create({
            courseId: course._id,
            title: "Lesson 2: Duration in Seconds",
            moduleName: "Module A",
            order: 2,
            durationSeconds: 150, // 2.5 mins -> 3 mins rounded
            isFreePreview: false,
            bunnyVideoId: "22222222-2222-2222-2222-222222222222",
            isPublished: true,
        });
        testLessonIds.push(directLesson2._id);

        const reloadedLesson2 = await Lesson.findById(directLesson2._id).lean();
        assert.equal(reloadedLesson2.durationSeconds, 150, "durationSeconds must persist as 150");
        assert.equal(reloadedLesson2.durationMinutes, 3, "durationMinutes must auto-sync to Math.round(150/60) = 3");
        assert.equal(reloadedLesson2.isFreePreview, false, "isFreePreview must persist as false");
        console.log("✓ TEST 1.2 PASSED: Lesson with durationSeconds=150 persisted and synchronized durationMinutes.");

        // ======================================================================
        // TEST 2: DIRECT MONGOOSE PROGRESS SCHEMA PERSISTENCE
        // ======================================================================
        console.log("\n--- TEST 2: DIRECT MONGOOSE PROGRESS SCHEMA PERSISTENCE ---");
        const directProgress = await Progress.create({
            userId: student._id,
            lessonId: directLesson1._id,
            courseId: course._id,
            lastPositionSeconds: 240,
            watchedSeconds: 300,
            progressPercentage: 50,
            completed: false,
            lastWatchedAt: new Date(),
        });
        testProgressIds.push(directProgress._id);

        // Reload directly from MongoDB via lean query
        const reloadedProg = await Progress.findById(directProgress._id).lean();
        assert.ok(reloadedProg, "Progress must exist in DB");
        assert.equal(reloadedProg.lastPositionSeconds, 240, "lastPositionSeconds must persist as 240");
        assert.equal(reloadedProg.progressSeconds, 240, "progressSeconds must auto-sync to 240");
        assert.equal(reloadedProg.watchedSeconds, 300, "watchedSeconds must persist as 300");
        assert.equal(reloadedProg.progressPercentage, 50, "progressPercentage must persist as 50");
        assert.equal(reloadedProg.completed, false, "completed must persist as false");
        assert.equal(reloadedProg.courseId.toString(), course._id.toString(), "courseId must persist");
        console.log("✓ TEST 2.1 PASSED: Direct Progress record persisted all canonical fields (lastPositionSeconds, progressSeconds, watchedSeconds, progressPercentage, courseId).");

        // ======================================================================
        // TEST 3: TEACHER STUDIO API LESSON CREATION & UPDATE PERSISTENCE
        // ======================================================================
        console.log("\n--- TEST 3: TEACHER STUDIO API LESSON CREATION & UPDATE PERSISTENCE ---");
        const createLessonRes = await makeRequest(
            server,
            { path: `/api/teacher/courses/${course._id}/lessons`, method: "POST" },
            {
                title: "API Created Lesson",
                moduleName: "Module B",
                bunnyVideoId: "33333333-3333-3333-3333-333333333333",
                durationMinutes: 25,
                isFreePreview: true,
                isPublished: true,
            },
            null,
            {
                "x-test-user-id": teacher._id.toString(),
                "x-test-role": "teacher",
            }
        );

        assert.equal(createLessonRes.status, 201, "Teacher create lesson should return 201");
        assert.equal(createLessonRes.body.data.lesson.durationMinutes, 25);
        assert.equal(createLessonRes.body.data.lesson.durationSeconds, 1500);
        assert.equal(createLessonRes.body.data.lesson.isFreePreview, true);
        const apiLessonId = createLessonRes.body.data.lesson.id;
        testLessonIds.push(apiLessonId);

        // Verify from MongoDB directly
        const reloadedApiLesson = await Lesson.findById(apiLessonId).lean();
        assert.equal(reloadedApiLesson.durationMinutes, 25, "DB document must have durationMinutes=25");
        assert.equal(reloadedApiLesson.durationSeconds, 1500, "DB document must have durationSeconds=1500");
        assert.equal(reloadedApiLesson.isFreePreview, true, "DB document must have isFreePreview=true");
        console.log("✓ TEST 3.1 PASSED: Teacher API lesson creation correctly persisted durationMinutes, durationSeconds, and isFreePreview to MongoDB.");

        // Teacher updates lesson: change duration to 40 mins and toggle free preview off
        const updateLessonRes = await makeRequest(
            server,
            { path: `/api/teacher/courses/${course._id}/lessons/${apiLessonId}`, method: "PUT" },
            {
                durationMinutes: 40,
                isFreePreview: false,
            },
            null,
            {
                "x-test-user-id": teacher._id.toString(),
                "x-test-role": "teacher",
            }
        );
        assert.equal(updateLessonRes.status, 200);
        assert.equal(updateLessonRes.body.data.lesson.durationMinutes, 40);
        assert.equal(updateLessonRes.body.data.lesson.durationSeconds, 2400);
        assert.equal(updateLessonRes.body.data.lesson.isFreePreview, false);

        // Verify from MongoDB directly
        const reloadedUpdatedLesson = await Lesson.findById(apiLessonId).lean();
        assert.equal(reloadedUpdatedLesson.durationMinutes, 40);
        assert.equal(reloadedUpdatedLesson.durationSeconds, 2400);
        assert.equal(reloadedUpdatedLesson.isFreePreview, false);
        console.log("✓ TEST 3.2 PASSED: Teacher API lesson update correctly persisted duration and preview changes to MongoDB.");

        // ======================================================================
        // TEST 4: STUDENT PLAYBACK PROGRESS API PERSISTENCE
        // ======================================================================
        console.log("\n--- TEST 4: STUDENT PLAYBACK PROGRESS API PERSISTENCE ---");
        // Ensure student has content access to all course modules & lessons (Module A & Module B)
        await ContentAccess.findOneAndUpdate(
            { courseId: course._id, scope: "student", userId: student._id },
            {
                $addToSet: {
                    unlockedModules: { $each: ["Module A", "Module B"] },
                    unlockedLessons: { $each: [directLesson1._id, directLesson2._id, apiLessonId] },
                },
            },
            { upsert: true, returnDocument: "after" }
        );

        // Student saves progress at 300s (5 mins into 25 min lesson)
        const saveProgressRes1 = await makeRequest(
            server,
            { path: `/api/student/courses/${course._id}/lessons/${apiLessonId}/progress`, method: "POST" },
            {
                position: 300,
                watchedSeconds: 300,
                completed: false,
            },
            null,
            {
                "x-test-user-id": student._id.toString(),
                "x-test-role": "student",
            }
        );
        assert.equal(saveProgressRes1.status, 200);
        assert.equal(saveProgressRes1.body.data.progress.lastPositionSeconds, 300);
        assert.equal(saveProgressRes1.body.data.progress.progressSeconds, 300);
        assert.equal(saveProgressRes1.body.data.progress.watchedSeconds, 300);
        assert.equal(saveProgressRes1.body.data.progress.completed, false);

        // Reload directly from MongoDB
        const dbProg1 = await Progress.findOne({ userId: student._id, lessonId: apiLessonId }).lean();
        assert.ok(dbProg1, "Progress document must exist in DB");
        assert.equal(dbProg1.lastPositionSeconds, 300, "Resume position must persist as 300s");
        assert.equal(dbProg1.progressSeconds, 300, "Progress seconds must persist as 300s");
        assert.equal(dbProg1.watchedSeconds, 300, "Watched seconds must persist as 300s");
        assert.ok(dbProg1.progressPercentage > 0, "Progress percentage must be computed and persisted");
        assert.equal(dbProg1.completed, false, "Completion status must persist as false");
        testProgressIds.push(dbProg1._id);
        console.log(`✓ TEST 4.1 PASSED: Intermediate playback progress persisted (lastPosition: 300s, watched: 300s, percentage: ${dbProg1.progressPercentage}%).`);

        // Student marks lesson as completed
        const saveProgressRes2 = await makeRequest(
            server,
            { path: `/api/student/courses/${course._id}/lessons/${apiLessonId}/progress`, method: "POST" },
            {
                position: 2400,
                completed: true,
            },
            null,
            {
                "x-test-user-id": student._id.toString(),
                "x-test-role": "student",
            }
        );
        assert.equal(saveProgressRes2.status, 200);
        assert.equal(saveProgressRes2.body.data.progress.completed, true);
        assert.equal(saveProgressRes2.body.data.progress.progressPercentage, 100);

        // Reload from MongoDB
        const dbProg2 = await Progress.findOne({ userId: student._id, lessonId: apiLessonId }).lean();
        assert.equal(dbProg2.completed, true, "Lesson completion must persist as true");
        assert.equal(dbProg2.progressPercentage, 100, "Completed lesson progressPercentage must persist as 100");
        assert.equal(dbProg2.lastPositionSeconds, 0, "On completion, resume position resets to 0");
        assert.equal(dbProg2.watchedSeconds, 2400, "Watched duration must be preserved upon completion");
        console.log("✓ TEST 4.2 PASSED: Lesson completion and 100% progress persisted to MongoDB.");

        // ======================================================================
        // TEST 5: ALTERNATIVE PROGRESS ROUTE (POST /api/student/progress)
        // ======================================================================
        console.log("\n--- TEST 5: ALTERNATIVE PROGRESS ROUTE (POST /api/student/progress) ---");
        const altProgressRes = await makeRequest(
            server,
            { path: `/api/student/progress`, method: "POST" },
            {
                courseId: course._id.toString(),
                lessonId: directLesson2._id.toString(),
                position: 90,
                watchedSeconds: 90,
                completed: false,
            },
            null,
            {
                "x-test-user-id": student._id.toString(),
                "x-test-role": "student",
            }
        );
        assert.equal(altProgressRes.status, 200);
        assert.equal(altProgressRes.body.data.progress.lastPositionSeconds, 90);

        // Reload from MongoDB
        const dbProgAlt = await Progress.findOne({ userId: student._id, lessonId: directLesson2._id }).lean();
        assert.ok(dbProgAlt, "Progress from alternative route must exist");
        assert.equal(dbProgAlt.lastPositionSeconds, 90);
        assert.equal(dbProgAlt.watchedSeconds, 90);
        testProgressIds.push(dbProgAlt._id);
        console.log("✓ TEST 5.1 PASSED: POST /api/student/progress persisted progress accurately.");

        // ======================================================================
        // TEST 6: FREE PREVIEW ACCESS VS LOCKED PLAYBACK
        // ======================================================================
        console.log("\n--- TEST 6: FREE PREVIEW ACCESS VS LOCKED PLAYBACK ---");
        // directLesson1 has isFreePreview: true -> Un-enrolled student should be granted playback
        const freePreviewRes = await makeRequest(
            server,
            { path: `/api/student/courses/${course._id}/lessons/${directLesson1._id}/playback` },
            null,
            null,
            {
                "x-test-user-id": unenrolledStudent._id.toString(),
                "x-test-role": "student",
                "x-test-email": unenrolledStudent.email,
            }
        );
        assert.equal(freePreviewRes.status, 200, "Unenrolled student MUST be able to watch free preview lesson");
        assert.ok(freePreviewRes.body.data.playback.embedUrl, "Must return signed embed URL");
        assert.equal(freePreviewRes.body.data.lesson.isFreePreview, true);
        console.log("✓ TEST 6.1 PASSED: Un-enrolled student successfully accessed free preview playback.");

        // directLesson2 has isFreePreview: false -> Un-enrolled student must be rejected with 403
        const lockedPlaybackRes = await makeRequest(
            server,
            { path: `/api/student/courses/${course._id}/lessons/${directLesson2._id}/playback` },
            null,
            null,
            {
                "x-test-user-id": unenrolledStudent._id.toString(),
                "x-test-role": "student",
                "x-test-email": unenrolledStudent.email,
            }
        );
        assert.equal(lockedPlaybackRes.status, 403, "Unenrolled student must be denied access to locked lesson");
        console.log("✓ TEST 6.2 PASSED: Locked lesson strictly refused un-enrolled playback with 403.");

        // ======================================================================
        // TEST 7: ENROLLED STUDENT FULL-COURSE ACCESS PRESERVED
        // ======================================================================
        console.log("\n--- TEST 7: ENROLLED STUDENT FULL-COURSE ACCESS PRESERVED ---");
        const enrolledPlaybackRes = await makeRequest(
            server,
            { path: `/api/student/courses/${course._id}/lessons/${directLesson2._id}/playback` },
            null,
            null,
            {
                "x-test-user-id": student._id.toString(),
                "x-test-role": "student",
                "x-test-email": student.email,
            }
        );
        assert.equal(enrolledPlaybackRes.status, 200, "Enrolled student must have access to locked lesson");
        assert.ok(enrolledPlaybackRes.body.data.playback.embedUrl);
        console.log("✓ TEST 7.1 PASSED: Enrolled student has full playback access across course lessons.");

        // ======================================================================
        // TEST 8: SSR EJS PROGRESS PERSISTENCE
        // ======================================================================
        console.log("\n--- TEST 8: SSR EJS PROGRESS PERSISTENCE ---");
        const ejsProgressRes = await makeRequest(
            server,
            { path: `/courses/${course._id}/lessons/${directLesson1._id}/progress`, method: "POST" },
            { position: 175, completed: false },
            null,
            {
                "x-test-user-id": student._id.toString(),
                "x-test-role": "student",
            }
        );
        assert.equal(ejsProgressRes.status, 200);
        assert.equal(ejsProgressRes.body.lastPositionSeconds, 175);

        // Reload from MongoDB
        const dbProgEjs = await Progress.findOne({ userId: student._id, lessonId: directLesson1._id }).lean();
        assert.equal(dbProgEjs.lastPositionSeconds, 175, "EJS progress save must persist lastPositionSeconds");
        assert.equal(dbProgEjs.progressSeconds, 175, "EJS progress save must persist progressSeconds");
        assert.ok(dbProgEjs.watchedSeconds >= 175, "EJS progress save must persist watchedSeconds");
        console.log("✓ TEST 8.1 PASSED: SSR EJS progress route saved and persisted to MongoDB.");

        console.log("\n==============================================================================");
        console.log(" ALL 8 PERSISTENCE & ALIGNMENT TEST SUITES PASSED SUCCESSFULLY! ✓");
        console.log("==============================================================================\n");
    } finally {
        // Cleanup test fixtures
        console.log("Cleaning up test fixtures...");
        if (testCourseIds.length) await ContentAccess.deleteMany({ courseId: { $in: testCourseIds } });
        if (testProgressIds.length) await Progress.deleteMany({ _id: { $in: testProgressIds } });
        if (testLessonIds.length) await Lesson.deleteMany({ _id: { $in: testLessonIds } });
        if (testEnrollmentIds.length) await Enrollment.deleteMany({ _id: { $in: testEnrollmentIds } });
        if (testCourseIds.length) await Course.deleteMany({ _id: { $in: testCourseIds } });
        if (testUserIds.length) await User.deleteMany({ _id: { $in: testUserIds } });
        console.log("✓ Test fixtures cleaned up.");

        server.close();
        await mongoose.disconnect();
    }
}

run().catch((err) => {
    console.error("\nTEST SUITE FAILED ✗:", err);
    process.exit(1);
});
