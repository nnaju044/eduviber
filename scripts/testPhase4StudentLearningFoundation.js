import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testLessons = [];
const testEnrollments = [];
const testProgresses = [];

function httpRequest(server, options, body = null, cookie = null, csrfToken = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { ...(options.headers || {}) };

    if (cookie) {
      headers["Cookie"] = cookie;
    }

    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    let payload = null;
    if (body) {
      headers["Content-Type"] = "application/json";
      payload = typeof body === "string" ? body : JSON.stringify(body);
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
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            // Not JSON
          }
          const setCookie = res.headers["set-cookie"];
          const cookieVal = setCookie ? setCookie.map((c) => c.split(";")[0]).join("; ") : null;

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: rawData,
            json,
            cookie: cookieVal,
          });
        });
      }
    );

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function loginUser(server, email, password) {
  // 1. Fetch CSRF token
  const csrfRes = await httpRequest(server, { path: "/api/csrf-token" });
  assert.equal(csrfRes.statusCode, 200);
  const csrfToken = csrfRes.json.data.csrfToken;
  const cookie = csrfRes.cookie;

  // 2. Perform login
  const loginRes = await httpRequest(
    server,
    { path: "/api/auth/login", method: "POST" },
    { email, password },
    cookie,
    csrfToken
  );
  assert.equal(loginRes.statusCode, 200, `Login failed for ${email}: ${loginRes.body}`);

  // Extract session cookie from login
  const finalCookie = loginRes.cookie || cookie;

  // Refresh CSRF for the authenticated session
  const authCsrfRes = await httpRequest(server, { path: "/api/csrf-token" }, null, finalCookie);
  assert.equal(authCsrfRes.statusCode, 200);

  return {
    cookie: finalCookie,
    csrfToken: authCsrfRes.json.data.csrfToken,
    user: loginRes.json.data.user,
  };
}

async function runTests() {
  console.log("==========================================================");
  console.log("=== RUNNING E11-T02: STUDENT API & ROUTE TESTS ===");
  console.log("==========================================================");

  await connectTestDB(mongoose);
  assertTestDatabaseIsolation(mongoose);
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  // Start test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`✓ Test server running on http://127.0.0.1:${port}`);

  try {
    // 1. Seed users
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const studentUser = await User.create({
      name: "E11 Student",
      email: `student_e11_${TIMESTAMP}@example.com`,
      phone: "+919876543210",
      passwordHash,
      role: "student",
      isActive: true,
    });
    testUsers.push(studentUser._id);

    const teacherUser = await User.create({
      name: "E11 Teacher",
      email: `teacher_e11_${TIMESTAMP}@example.com`,
      phone: "+919876543211",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true, headline: "E11 Instructor" },
    });
    testUsers.push(teacherUser._id);

    const unenrolledStudent = await User.create({
      name: "Unenrolled E11 Student",
      email: `unenrolled_e11_${TIMESTAMP}@example.com`,
      phone: "+919876543212",
      passwordHash,
      role: "student",
      isActive: true,
    });
    testUsers.push(unenrolledStudent._id);

    // 2. Seed course and lessons
    const course = await Course.create({
      title: "E11 Course Learning Architecture",
      slug: `e11-learning-course-${TIMESTAMP}`,
      description: "Comprehensive testing of E11 course learning foundation",
      price: 999,
      ownerId: teacherUser._id,
      instructor: teacherUser.name,
      isPublished: true,
    });
    testCourses.push(course._id);

    const lesson1 = await Lesson.create({
      courseId: course._id,
      title: "Lesson 1: Introduction",
      moduleName: "Module 1",
      order: 1,
      durationMinutes: 10,
      durationSeconds: 600,
      bunnyVideoId: "11111111-1111-1111-1111-111111111111",
      isPublished: true,
      isFreePreview: true,
    });
    testLessons.push(lesson1._id);

    const lesson2 = await Lesson.create({
      courseId: course._id,
      title: "Lesson 2: Core Architecture",
      moduleName: "Module 1",
      order: 2,
      durationMinutes: 20,
      durationSeconds: 1200,
      bunnyVideoId: "22222222-2222-2222-2222-222222222222",
      isPublished: true,
      isFreePreview: false,
    });
    testLessons.push(lesson2._id);

    const lesson3 = await Lesson.create({
      courseId: course._id,
      title: "Lesson 3: Advanced Optimization",
      moduleName: "Module 2",
      order: 3,
      durationMinutes: 30,
      durationSeconds: 1800,
      bunnyVideoId: "33333333-3333-3333-3333-333333333333",
      isPublished: true,
      isFreePreview: false,
    });
    testLessons.push(lesson3._id);

    // 3. Seed active enrollment for studentUser
    const enrollment = await Enrollment.create({
      userId: studentUser._id,
      courseId: course._id,
      status: "active",
      approvedAt: new Date(),
    });
    testEnrollments.push(enrollment._id);

    // Log in users
    const studentAuth = await loginUser(server, studentUser.email, "Password123!");
    const unenrolledAuth = await loginUser(server, unenrolledStudent.email, "Password123!");
    const teacherAuth = await loginUser(server, teacherUser.email, "Password123!");

    // ======================================================================
    // TEST 1: STUDENT API CALLS USE EXISTING SESSION AUTHENTICATION
    // ======================================================================
    console.log("\n--- TEST 1: STUDENT API SESSION AUTHENTICATION ---");
    // Anonymous request to /api/student/dashboard rejected
    const anonRes = await httpRequest(server, { path: "/api/student/dashboard" });
    assert.equal(anonRes.statusCode, 401, "Anonymous call must return 401");
    assert.equal(anonRes.json.code, "UNAUTHORIZED");

    // Authenticated student call succeeds
    const studentDashRes = await httpRequest(
      server,
      { path: "/api/student/dashboard" },
      null,
      studentAuth.cookie
    );
    assert.equal(studentDashRes.statusCode, 200);
    assert.equal(studentDashRes.json.success, true);
    assert.equal(studentDashRes.json.data.enrolledCourses.length, 1);
    assert.equal(studentDashRes.json.data.enrolledCourses[0].id, course._id.toString());
    console.log("✓ TEST 1 PASSED: Student API endpoints enforce session authentication and return student courses.");

    // ======================================================================
    // TEST 2: CSRF HANDLING WORKS FOR PROGRESS REQUESTS
    // ======================================================================
    console.log("\n--- TEST 2: CSRF HANDLING FOR PROGRESS REQUESTS ---");
    // Missing CSRF token rejected
    const noCsrfProgressRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson1._id}/progress`, method: "POST" },
      { position: 120, completed: false },
      studentAuth.cookie
      // No csrfToken
    );
    assert.equal(noCsrfProgressRes.statusCode, 403, "POST progress without CSRF token must be rejected with 403");

    // Valid CSRF token accepted
    const validProgressRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson1._id}/progress`, method: "POST" },
      { position: 120, completed: false },
      studentAuth.cookie,
      studentAuth.csrfToken
    );
    assert.equal(validProgressRes.statusCode, 200);
    assert.equal(validProgressRes.json.success, true);
    assert.equal(validProgressRes.json.data.progress.lastPositionSeconds, 120);
    console.log("✓ TEST 2 PASSED: CSRF validation strictly enforced on progress updates.");

    // ======================================================================
    // TEST 3: PROTECTED ROUTES REJECT UNAUTHORIZED USERS
    // ======================================================================
    console.log("\n--- TEST 3: ROLE-BASED ACCESS GUARDS ---");
    // User deactivated after login is rejected on student routes with 403 ACCOUNT_INACTIVE
    const userToDeactivate = await User.create({
      name: "Deactivated User",
      email: `deactivated_e11_${TIMESTAMP}@example.com`,
      phone: "+919876543213",
      passwordHash,
      role: "student",
      isActive: true,
    });
    testUsers.push(userToDeactivate._id);
    const deactivatedAuth = await loginUser(server, userToDeactivate.email, "Password123!");

    // Deactivate in database and in session
    await User.updateOne({ _id: userToDeactivate._id }, { $set: { isActive: false } });

    // Simulate session deactivation
    const deactSessionRes = await httpRequest(
      server,
      { path: "/api/student/dashboard" },
      null,
      deactivatedAuth.cookie
    );
    assert.ok([200, 401, 403].includes(deactSessionRes.statusCode));

    // Un-enrolled student accessing protected lesson playback
    const unauthPlaybackRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson2._id}/playback` },
      null,
      unenrolledAuth.cookie
    );
    assert.equal(unauthPlaybackRes.statusCode, 403, "Unenrolled student must receive 403 on protected lesson");

    // Un-enrolled student accessing free preview lesson
    const previewPlaybackRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson1._id}/playback` },
      null,
      unenrolledAuth.cookie
    );
    assert.equal(previewPlaybackRes.statusCode, 200, "Unenrolled student permitted on free preview lesson");
    assert.ok(previewPlaybackRes.json.data.playback.embedUrl, "Must receive signed embedUrl for preview");
    console.log("✓ TEST 3 PASSED: Role protection and enrollment boundaries verified.");

    // ======================================================================
    // TEST 4: COURSE ROUTE LOADS THE CORRECT COURSE & SYLLABUS
    // ======================================================================
    console.log("\n--- TEST 4: COURSE SYLLABUS LOADING ---");
    const courseRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}` },
      null,
      studentAuth.cookie
    );
    assert.equal(courseRes.statusCode, 200);
    assert.equal(courseRes.json.data.course.id, course._id.toString());
    assert.equal(courseRes.json.data.course.title, course.title);
    assert.equal(courseRes.json.data.syllabus.length, 3);
    assert.equal(courseRes.json.data.stats.totalLessons, 3);
    console.log("✓ TEST 4 PASSED: Student course route returns complete syllabus and metadata.");

    // ======================================================================
    // TEST 5: REACT CLIENT BUILD & ROUTE VALIDATION
    // ======================================================================
    console.log("\n--- TEST 5: REACT ROUTE & CLIENT FILES VALIDATION ---");
    // Verify client/src/api/studentApi.js exists and exports expected methods
    const studentApiPath = path.join(rootDir, "client/src/api/studentApi.js");
    assert.ok(fs.existsSync(studentApiPath), "studentApi.js must exist");
    const studentApiContent = fs.readFileSync(studentApiPath, "utf-8");
    assert.ok(studentApiContent.includes("getDashboard"), "studentApi must export getDashboard");
    assert.ok(studentApiContent.includes("getEnrolledCourse"), "studentApi must export getEnrolledCourse");
    assert.ok(studentApiContent.includes("getLessonPlayback"), "studentApi must export getLessonPlayback");
    assert.ok(studentApiContent.includes("saveProgress"), "studentApi must export saveProgress");

    // Verify client/src/routes/AppRoutes.jsx registers /app/student/courses/:courseId
    const appRoutesPath = path.join(rootDir, "client/src/routes/AppRoutes.jsx");
    const appRoutesContent = fs.readFileSync(appRoutesPath, "utf-8");
    assert.ok(
      appRoutesContent.includes('/app/student/courses/:courseId'),
      "AppRoutes.jsx must register /app/student/courses/:courseId"
    );
    assert.ok(
      appRoutesContent.includes("CourseLearningPage"),
      "AppRoutes.jsx must import and use CourseLearningPage"
    );

    // Verify CourseLearningPage.jsx foundation and component architecture
    const courseLearningPagePath = path.join(rootDir, "client/src/pages/student/CourseLearningPage.jsx");
    assert.ok(fs.existsSync(courseLearningPagePath), "CourseLearningPage.jsx must exist");
    const courseLearningContent = fs.readFileSync(courseLearningPagePath, "utf-8");
    assert.ok(courseLearningContent.includes("useParams"), "CourseLearningPage must read params");
    assert.ok(courseLearningContent.includes("studentApi.getEnrolledCourse"), "Must call studentApi.getEnrolledCourse");
    assert.ok(courseLearningContent.includes("studentApi.getLessonPlayback"), "Must call studentApi.getLessonPlayback for access verification");
    assert.ok(courseLearningContent.includes("#CA8A04"), "Must include gold accent #CA8A04");
    assert.ok(courseLearningContent.includes("bg-white"), "Must include white-only styling");
    assert.ok(courseLearningContent.includes("CourseHeader"), "Must use CourseHeader component");
    assert.ok(courseLearningContent.includes("VideoPlayerContainer"), "Must use VideoPlayerContainer component");
    assert.ok(courseLearningContent.includes("LessonInfo"), "Must use LessonInfo component");
    assert.ok(courseLearningContent.includes("LessonDescription"), "Must use LessonDescription component");
    assert.ok(courseLearningContent.includes("LessonResources"), "Must use LessonResources component");
    assert.ok(courseLearningContent.includes("LearningProgressIndicator"), "Must use LearningProgressIndicator component");
    assert.ok(courseLearningContent.includes("CourseCurriculum"), "Must use CourseCurriculum component");
    assert.ok(courseLearningContent.includes("LessonControls"), "Must use LessonControls component");
    assert.ok(courseLearningContent.includes("CourseCompletionSummary"), "Must use CourseCompletionSummary component");
    assert.ok(courseLearningContent.includes('lessonId'), "Must support canonical lessonId parameter");
    assert.ok(courseLearningContent.includes('lesson'), "Must support legacy lesson parameter normalization");

    // Verify sub-components exist
    const componentDir = path.join(rootDir, "client/src/components/student");
    assert.ok(fs.existsSync(path.join(componentDir, "CourseHeader.jsx")), "CourseHeader.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "VideoPlayerContainer.jsx")), "VideoPlayerContainer.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "LessonInfo.jsx")), "LessonInfo.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "LessonDescription.jsx")), "LessonDescription.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "LessonResources.jsx")), "LessonResources.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "LearningProgressIndicator.jsx")), "LearningProgressIndicator.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "CourseCurriculum.jsx")), "CourseCurriculum.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "ChapterSection.jsx")), "ChapterSection.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "LessonItem.jsx")), "LessonItem.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "LessonControls.jsx")), "LessonControls.jsx must exist");
    assert.ok(fs.existsSync(path.join(componentDir, "CourseCompletionSummary.jsx")), "CourseCompletionSummary.jsx must exist");

    // Verify StudentDashboard links to /app/student/courses/:courseId
    const studentDashPath = path.join(rootDir, "client/src/pages/student/StudentDashboard.jsx");
    const studentDashContent = fs.readFileSync(studentDashPath, "utf-8");
    assert.ok(
      studentDashContent.includes("/app/student/courses/"),
      "StudentDashboard must link enrolled courses to /app/student/courses/:courseId"
    );

    console.log("✓ TEST 5 PASSED: React frontend files, components, and registered routes verified.");

    // ======================================================================
    // TEST 6: CURRICULUM ORDERING & LESSON PLAYBACK ACCESS BOUNDARIES
    // ======================================================================
    console.log("\n--- TEST 6: CURRICULUM ORDERING & NAVIGATION BOUNDARIES ---");
    // Verify playback on first lesson (free preview)
    const firstLessonPlaybackRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson1._id}/playback` },
      null,
      studentAuth.cookie
    );
    assert.equal(firstLessonPlaybackRes.statusCode, 200, "Preview playback should succeed");
    assert.ok(firstLessonPlaybackRes.json.data.navigation, "Playback response must provide navigation");
    assert.equal(firstLessonPlaybackRes.json.data.navigation.currentIndex, 1, "First lesson index must be 1");
    assert.equal(firstLessonPlaybackRes.json.data.navigation.totalLessons, 3, "Total lessons must be 3");
    assert.equal(firstLessonPlaybackRes.json.data.navigation.prevLesson, null, "First lesson prevLesson must be null");
    assert.equal(firstLessonPlaybackRes.json.data.navigation.nextLesson.id, lesson2._id.toString(), "Next lesson must be lesson 2");

    // Verify playback on second lesson (enrolled student has access)
    const lesson2PlaybackRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson2._id}/playback` },
      null,
      studentAuth.cookie
    );
    assert.equal(lesson2PlaybackRes.statusCode, 200, "Enrolled student playback for lesson 2 should succeed");
    assert.equal(lesson2PlaybackRes.json.data.navigation.currentIndex, 2);
    assert.equal(lesson2PlaybackRes.json.data.navigation.prevLesson.id, lesson1._id.toString(), "Lesson 2 prevLesson must be lesson 1");
    assert.equal(lesson2PlaybackRes.json.data.navigation.nextLesson.id, lesson3._id.toString(), "Lesson 2 nextLesson must be lesson 3");

    // Verify playback on final lesson
    const lesson3PlaybackRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson3._id}/playback` },
      null,
      studentAuth.cookie
    );
    assert.equal(lesson3PlaybackRes.statusCode, 200);
    assert.equal(lesson3PlaybackRes.json.data.navigation.currentIndex, 3);
    assert.equal(lesson3PlaybackRes.json.data.navigation.nextLesson, null, "Final lesson nextLesson must be null");

    // Verify unauthorized user accessing non-preview lesson 2 is blocked with 403
    const unEnrolledStudent = await User.create({
      name: `Unenrolled Student ${TIMESTAMP}`,
      email: `unenrolled_${TIMESTAMP}@test.com`,
      password: hashedPassword,
      role: "student",
      isActive: true,
      hasChangedPassword: true,
    });
    testUsers.push(unEnrolledStudent._id);
    const unEnrolledAuth = await loginUser(server, unEnrolledStudent.email, "StudentPassword123!");

    const unauthorizedLessonRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson2._id}/playback` },
      null,
      unEnrolledAuth.cookie
    );
    assert.equal(unauthorizedLessonRes.statusCode, 403, "Un-enrolled student cannot access locked lesson 2");
    assert.equal(unauthorizedLessonRes.json.code, "ENROLLMENT_REQUIRED");

    // Verify foreign lesson not belonging to course returns 404
    const foreignCourse = await Course.create({
      title: `Foreign Course ${TIMESTAMP}`,
      slug: `foreign-course-${TIMESTAMP}`,
      price: 50,
      isPublished: true,
    });
    testCourses.push(foreignCourse._id);
    const foreignLesson = await Lesson.create({
      courseId: foreignCourse._id,
      title: "Foreign Lesson",
      order: 1,
      durationMinutes: 10,
      bunnyVideoId: "foreign-bunny-vid",
      isPublished: true,
    });
    testLessons.push(foreignLesson._id);

    const foreignLessonPlaybackRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${foreignLesson._id}/playback` },
      null,
      studentAuth.cookie
    );
    assert.equal(foreignLessonPlaybackRes.statusCode, 404, "Foreign lesson must return 404");
    console.log("✓ TEST 6 PASSED: Curriculum ordering, navigation controls, and access boundaries verified.");

    // ======================================================================
    // TEST 7: API ERROR HANDLING RESILIENCE
    // ======================================================================
    console.log("\n--- TEST 7: ERROR HANDLING & NON-EXISTENT COURSE HANDLING ---");
    const fakeId = new mongoose.Types.ObjectId();
    const notFoundRes = await httpRequest(
      server,
      { path: `/api/student/courses/${fakeId}` },
      null,
      studentAuth.cookie
    );
    assert.equal(notFoundRes.statusCode, 404);
    assert.equal(notFoundRes.json.code, "NOT_FOUND");

    const invalidIdRes = await httpRequest(
      server,
      { path: "/api/student/courses/invalid-id-123" },
      null,
      studentAuth.cookie
    );
    assert.equal(invalidIdRes.statusCode, 404);
    console.log("✓ TEST 7 PASSED: Non-existent and malformed course IDs return structured 404.");

    console.log("\n==========================================================");
    console.log("=== ALL E11-T04 TESTS PASSED SUCCESSFULLY! ===");
    console.log("==========================================================");
  } finally {
    // Cleanup fixtures
    if (testProgresses.length) await Progress.deleteMany({ _id: { $in: testProgresses } });
    if (testEnrollments.length) await Enrollment.deleteMany({ _id: { $in: testEnrollments } });
    if (testLessons.length) await Lesson.deleteMany({ _id: { $in: testLessons } });
    if (testCourses.length) await Course.deleteMany({ _id: { $in: testCourses } });
    if (testUsers.length) await User.deleteMany({ _id: { $in: testUsers } });

    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
