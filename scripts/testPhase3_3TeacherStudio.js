import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Progress from "../models/Progress.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testLessons = [];
const testPayments = [];
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
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: rawData,
            json,
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

function extractCookie(headers) {
  const setCookie = headers["set-cookie"];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
  const match = cookieStr.match(/(course\.sid=[^;]+)/);
  return match ? match[1] : null;
}

async function loginUser(server, email, password = "Password123!") {
  const csrfRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" });
  const cookie = extractCookie(csrfRes.headers);
  const preLoginCsrf = csrfRes.json.data.csrfToken;

  const loginRes = await httpRequest(
    server,
    { path: "/api/auth/login", method: "POST" },
    { email, password },
    cookie,
    preLoginCsrf
  );

  const finalCookie = extractCookie(loginRes.headers) || cookie;

  // Retrieve post-login CSRF token bound to authenticated session
  const authCsrfRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" }, null, finalCookie);
  const authCsrfToken = authCsrfRes.json?.data?.csrfToken;

  return { cookie: finalCookie, csrfToken: authCsrfToken };
}

async function runTeacherStudioTests() {
  console.log("\n==========================================================");
  console.log("=== RUNNING PHASE 3.3: TEACHER STUDIO TEST SUITE ===");
  console.log("==========================================================");

  // 0. Test DB isolation guard
  await connectTestDB();
  assertTestDatabaseIsolation();
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // 1. Seed Users: Teacher A (approved), Teacher B (approved), Unapproved Teacher, Suspended Teacher, Student 1, Student 2
    const teacherA = await User.create({
      name: "Teacher Alpha",
      email: `teacher_alpha_${TIMESTAMP}@example.com`,
      phone: "9100000001",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        headline: "Principal Cloud Architect",
        bio: "Specializing in microservices and distributed systems",
        isApproved: true,
        commissionRate: 0.25, // 25% platform fee => 75% teacher revenue share
        payoutUpiId: "alpha@okhdfcbank",
      },
    });
    testUsers.push(teacherA._id);

    const teacherB = await User.create({
      name: "Teacher Beta",
      email: `teacher_beta_${TIMESTAMP}@example.com`,
      phone: "9100000002",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        headline: "Senior Security Specialist",
        bio: "Expert in cryptography and penetration testing",
        isApproved: true,
        commissionRate: 0.20, // 20% platform fee => 80% teacher revenue share
        payoutUpiId: "beta@okhdfcbank",
      },
    });
    testUsers.push(teacherB._id);

    const unapprovedTeacher = await User.create({
      name: "Unapproved Candidate",
      email: `unapproved_${TIMESTAMP}@example.com`,
      phone: "9100000003",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        headline: "Aspiring Instructor",
        bio: "Pending profile review",
        isApproved: false,
        commissionRate: 0.30,
      },
    });
    testUsers.push(unapprovedTeacher._id);

    const suspendedTeacher = await User.create({
      name: "Suspended Teacher",
      email: `suspended_${TIMESTAMP}@example.com`,
      phone: "9100000004",
      passwordHash,
      role: "teacher",
      isActive: true, // Initially active to authenticate session
      teacherProfile: {
        headline: "Account To Be Suspended",
        bio: "Violation of terms",
        isApproved: true,
        commissionRate: 0.30,
      },
    });
    testUsers.push(suspendedTeacher._id);

    const student1 = await User.create({
      name: "Student One",
      email: `student1_${TIMESTAMP}@example.com`,
      phone: "9200000001",
      passwordHash,
      role: "student",
      isActive: true,
    });
    testUsers.push(student1._id);

    const student2 = await User.create({
      name: "Student Two",
      email: `student2_${TIMESTAMP}@example.com`,
      phone: "9200000002",
      passwordHash,
      role: "student",
      isActive: true,
    });
    testUsers.push(student2._id);

    console.log("✓ Seeded test users (Teacher A, Teacher B, Unapproved, Suspended, Student 1, Student 2).");

    // Authenticate sessions
    const authA = await loginUser(server, teacherA.email);
    const authB = await loginUser(server, teacherB.email);
    const authUnapproved = await loginUser(server, unapprovedTeacher.email);
    const authSuspended = await loginUser(server, suspendedTeacher.email);

    // ======================================================================
    // 1. TEACHER DASHBOARD OVERVIEW / STATS
    // ======================================================================
    console.log("\n--- TEST SUITE 1: TEACHER OVERVIEW & STATS ---");
    const statsResA = await httpRequest(
      server,
      { path: "/api/teacher/stats", method: "GET" },
      null,
      authA.cookie
    );
    assert.equal(statsResA.statusCode, 200, "Teacher A can access /api/teacher/stats");
    assert.equal(statsResA.json.success, true);
    assert.equal(statsResA.json.data.stats.totalCourses, 0);
    assert.equal(statsResA.json.data.stats.publishedCourses, 0);
    assert.equal(statsResA.json.data.stats.draftCourses, 0);
    assert.equal(statsResA.json.data.stats.totalStudents, 0);
    assert.equal(statsResA.json.data.stats.teacherRevenueShare, 0.75);
    assert.equal(statsResA.json.data.stats.commissionRate, 0.25);
    assert.equal(statsResA.json.data.stats.isApproved, true);
    assert.equal(statsResA.json.data.stats.isActive, true);
    console.log("✓ TEST 1.1 PASSED: Teacher stats endpoint returns exact live overview metrics.");

    // ======================================================================
    // 2. COURSE CREATION, EDITING & DRAFT/PUBLISH
    // ======================================================================
    console.log("\n--- TEST SUITE 2: COURSE CREATION & EDITING ---");
    // Test 2.1: Teacher A creates Course 1
    const createCourseResA = await httpRequest(
      server,
      { path: "/api/teacher/courses", method: "POST" },
      {
        title: `Cloud Mastery Alpha ${TIMESTAMP}`,
        description: "Comprehensive Cloud Engineering course",
        price: 2499,
        thumbnail: "https://example.com/alpha-thumb.jpg",
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(createCourseResA.statusCode, 201, "Course creation must return 201 Created");
    assert.equal(createCourseResA.json.success, true);
    const courseA1Id = createCourseResA.json.data.course.id;
    testCourses.push(new mongoose.Types.ObjectId(courseA1Id));

    // Verify course record in DB
    const courseA1Db = await Course.findById(courseA1Id);
    assert.ok(courseA1Db, "Course A1 must exist in database");
    assert.equal(courseA1Db.ownerId.toString(), teacherA._id.toString(), "Owner must be Teacher A");
    assert.equal(courseA1Db.isPublished, false, "Initial status must be draft (isPublished: false)");
    console.log("✓ TEST 2.1 PASSED: Course created with draft status and owner locked to authenticated teacher.");

    // Test 2.2: Teacher A updates Course 1 and publishes it
    const updateCourseResA = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}`, method: "PATCH" },
      {
        title: `Cloud Mastery Alpha (Updated) ${TIMESTAMP}`,
        price: 2999,
        isPublished: true,
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(updateCourseResA.statusCode, 200, "Teacher A can update Course A1");
    assert.equal(updateCourseResA.json.data.course.isPublished, true);
    assert.equal(updateCourseResA.json.data.course.price, 2999);
    console.log("✓ TEST 2.2 PASSED: Course updated and published successfully.");

    // Verify stats updated
    const statsResA2 = await httpRequest(
      server,
      { path: "/api/teacher/stats", method: "GET" },
      null,
      authA.cookie
    );
    assert.equal(statsResA2.json.data.stats.totalCourses, 1);
    assert.equal(statsResA2.json.data.stats.publishedCourses, 1);
    assert.equal(statsResA2.json.data.stats.draftCourses, 0);
    console.log("✓ TEST 2.3 PASSED: Dashboard stats automatically reflected published course.");

    // ======================================================================
    // 3. COURSE OWNERSHIP ENFORCEMENT & TAMPER RESISTANCE
    // ======================================================================
    console.log("\n--- TEST SUITE 3: COURSE OWNERSHIP ENFORCEMENT & ISOLATION ---");
    // Test 3.1: Teacher A tries to forge ownerId to Teacher B during creation
    const forgedCourseRes = await httpRequest(
      server,
      { path: "/api/teacher/courses", method: "POST" },
      {
        title: `Forged Owner Course ${TIMESTAMP}`,
        description: "Attempting to assign to Teacher B",
        price: 1999,
        ownerId: teacherB._id.toString(), // Forged ownerId
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(forgedCourseRes.statusCode, 201);
    const forgedCourseId = forgedCourseRes.json.data.course.id;
    testCourses.push(new mongoose.Types.ObjectId(forgedCourseId));
    const forgedCourseDb = await Course.findById(forgedCourseId);
    assert.equal(
      forgedCourseDb.ownerId.toString(),
      teacherA._id.toString(),
      "Forged ownerId must be ignored; course must belong to authenticated Teacher A"
    );
    console.log("✓ TEST 3.1 PASSED: Course creation ignores forged ownerId and assigns authenticated teacher.");

    // Test 3.2: Teacher B cannot view Teacher A's course
    const viewCourseResB = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}`, method: "GET" },
      null,
      authB.cookie
    );
    assert.equal(viewCourseResB.statusCode, 403, "Teacher B cannot access Teacher A's course");
    console.log("✓ TEST 3.2 PASSED: Teacher B blocked with 403 when trying to access Teacher A's course.");

    // Test 3.3: Teacher B cannot edit Teacher A's course
    const editCourseResB = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}`, method: "PATCH" },
      { title: "Hijacked Title" },
      authB.cookie,
      authB.csrfToken
    );
    assert.equal(editCourseResB.statusCode, 403, "Teacher B cannot modify Teacher A's course");
    console.log("✓ TEST 3.3 PASSED: Teacher B blocked with 403 when trying to edit Teacher A's course.");

    // Test 3.4: Teacher B cannot delete Teacher A's course
    const deleteCourseResB = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}`, method: "DELETE" },
      null,
      authB.cookie,
      authB.csrfToken
    );
    assert.equal(deleteCourseResB.statusCode, 403, "Teacher B cannot delete Teacher A's course");
    console.log("✓ TEST 3.4 PASSED: Teacher B blocked with 403 when trying to delete Teacher A's course.");

    // ======================================================================
    // 4. LESSON CRUD & SEQUENCING
    // ======================================================================
    console.log("\n--- TEST SUITE 4: LESSON MANAGEMENT & SEQUENCING ---");
    // Test 4.1: Teacher A adds Lesson 1
    const lesson1Res = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/lessons`, method: "POST" },
      {
        title: "Lesson 1: Introduction to Cloud",
        moduleName: "Module 1",
        bunnyVideoId: "11111111-1111-1111-1111-111111111111",
        durationMinutes: 20,
        order: 1,
        isPublished: true,
        isFreePreview: true,
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(lesson1Res.statusCode, 201, "Lesson 1 created successfully");
    const lesson1Id = lesson1Res.json.data.lesson.id;
    testLessons.push(new mongoose.Types.ObjectId(lesson1Id));

    // Test 4.2: Teacher A adds Lesson 2
    const lesson2Res = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/lessons`, method: "POST" },
      {
        title: "Lesson 2: Kubernetes Fundamentals",
        moduleName: "Module 1",
        bunnyVideoId: "22222222-2222-2222-2222-222222222222",
        durationMinutes: 35,
        order: 2,
        isPublished: true,
        isFreePreview: false,
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(lesson2Res.statusCode, 201, "Lesson 2 created successfully");
    const lesson2Id = lesson2Res.json.data.lesson.id;
    testLessons.push(new mongoose.Types.ObjectId(lesson2Id));

    // Test 4.3: Teacher B cannot add a lesson to Teacher A's course
    const unauthorizedLessonRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/lessons`, method: "POST" },
      {
        title: "Malicious Lesson",
        moduleName: "Hacked",
        order: 99,
      },
      authB.cookie,
      authB.csrfToken
    );
    assert.equal(unauthorizedLessonRes.statusCode, 403, "Teacher B cannot add lesson to Teacher A course");
    console.log("✓ TEST 4.1 PASSED: Lesson creation succeeds with ownership and fails for other teachers.");

    // Test 4.4: Teacher A updates Lesson 1
    const updateLessonRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/lessons/${lesson1Id}`, method: "PATCH" },
      {
        title: "Lesson 1: Introduction to Cloud (Revised)",
        durationMinutes: 25,
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(updateLessonRes.statusCode, 200, "Teacher A can update lesson");
    assert.equal(updateLessonRes.json.data.lesson.durationMinutes, 25);
    console.log("✓ TEST 4.2 PASSED: Lesson update succeeds with revised duration.");

    // Test 4.5: Teacher A lists lessons
    const listLessonsRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/lessons`, method: "GET" },
      null,
      authA.cookie
    );
    assert.equal(listLessonsRes.statusCode, 200);
    assert.equal(listLessonsRes.json.data.lessons.length, 2);
    assert.equal(listLessonsRes.json.data.lessons[0].order, 1);
    assert.equal(listLessonsRes.json.data.lessons[1].order, 2);
    console.log("✓ TEST 4.3 PASSED: Lessons returned in sequential order.");

    // Test 4.6: Teacher A deletes Lesson 2
    const deleteLessonRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/lessons/${lesson2Id}`, method: "DELETE" },
      null,
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(deleteLessonRes.statusCode, 200, "Teacher A can delete Lesson 2");
    const lesson2Db = await Lesson.findById(lesson2Id);
    assert.equal(lesson2Db, null, "Lesson 2 must no longer exist in DB");
    console.log("✓ TEST 4.4 PASSED: Lesson deletion succeeds cleanly.");

    // ======================================================================
    // 5. BUNNY STREAM VIDEO UPLOAD INTEGRATION & STATUS
    // ======================================================================
    console.log("\n--- TEST SUITE 5: BUNNY STREAM VIDEO UPLOAD INTEGRATION ---");
    // Test 5.1: Teacher A uploads a video for Course A1
    const uploadVideoRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/upload-video`, method: "POST" },
      {
        title: "Container Networking Deep Dive",
        videoData: "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQ==",
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(uploadVideoRes.statusCode, 201, "Video upload creation must return 201");
    assert.equal(uploadVideoRes.json.success, true);
    assert.ok(uploadVideoRes.json.data.video.videoId, "Must return Bunny videoId GUID");
    const uploadedVideoId = uploadVideoRes.json.data.video.videoId;

    // Verify Bunny credentials are NOT leaked in response
    const rawResText = JSON.stringify(uploadVideoRes.json);
    assert.equal(rawResText.includes(process.env.BUNNY_STREAM_API_KEY || "SECRET_DUMMY_KEY"), false);
    console.log("✓ TEST 5.1 PASSED: Bunny Stream video created via server without leaking API secrets.");

    // Test 5.2: Teacher B cannot upload video to Teacher A's course
    const unauthUploadRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/upload-video`, method: "POST" },
      { title: "Unauthorized Video" },
      authB.cookie,
      authB.csrfToken
    );
    assert.equal(unauthUploadRes.statusCode, 403, "Teacher B cannot upload video to Teacher A's course");
    console.log("✓ TEST 5.2 PASSED: Video upload endpoint verifies course ownership.");

    // Test 5.3: Video status check
    const statusRes = await httpRequest(
      server,
      { path: `/api/teacher/videos/${uploadedVideoId}/status`, method: "GET" },
      null,
      authA.cookie
    );
    assert.equal(statusRes.statusCode, 200, "Video status check returns 200");
    assert.equal(statusRes.json.success, true);
    assert.ok(statusRes.json.data.status, "Status object must be returned");
    console.log("✓ TEST 5.3 PASSED: Bunny video status endpoint functions correctly.");

    // ======================================================================
    // 6. STUDENT DIRECTORY & TENANT ISOLATION
    // ======================================================================
    console.log("\n--- TEST SUITE 6: ENROLLED STUDENTS & TENANT ISOLATION ---");
    // Seed Course B for Teacher B
    const courseB = await Course.create({
      title: `Security Foundations ${TIMESTAMP}`,
      slug: `security-foundations-${TIMESTAMP}`,
      instructor: teacherB.name,
      description: "Cybersecurity and defense",
      price: 1999,
      ownerId: teacherB._id,
      isPublished: true,
    });
    testCourses.push(courseB._id);

    // Enroll Student 1 in Teacher A's Course A1
    const enrollment1 = await Enrollment.create({
      userId: student1._id,
      courseId: courseA1Id,
      status: "active",
      enrolledAt: new Date(),
    });
    testEnrollments.push(enrollment1._id);

    // Enroll Student 2 in Teacher B's Course B
    const enrollment2 = await Enrollment.create({
      userId: student2._id,
      courseId: courseB._id,
      status: "active",
      enrolledAt: new Date(),
    });
    testEnrollments.push(enrollment2._id);

    // Query Teacher A's student list
    const teacherAStudentsRes = await httpRequest(
      server,
      { path: "/api/teacher/students", method: "GET" },
      null,
      authA.cookie
    );
    assert.equal(teacherAStudentsRes.statusCode, 200);
    const studentsA = teacherAStudentsRes.json.data.students;
    assert.equal(studentsA.length, 1, "Teacher A must see exactly 1 student");
    assert.equal(studentsA[0].student.id, student1._id.toString(), "Teacher A must only see Student 1");
    console.log("✓ TEST 6.1 PASSED: Teacher A only sees students enrolled in Teacher A's courses.");

    // Query Teacher B's student list
    const teacherBStudentsRes = await httpRequest(
      server,
      { path: "/api/teacher/students", method: "GET" },
      null,
      authB.cookie
    );
    assert.equal(teacherBStudentsRes.statusCode, 200);
    const studentsB = teacherBStudentsRes.json.data.students;
    assert.equal(studentsB.length, 1, "Teacher B must see exactly 1 student");
    assert.equal(studentsB[0].student.id, student2._id.toString(), "Teacher B must only see Student 2");
    console.log("✓ TEST 6.2 PASSED: Teacher B only sees students enrolled in Teacher B's courses.");

    // ======================================================================
    // 7. STUDENT PROGRESS INSPECTION & ISOLATION
    // ======================================================================
    console.log("\n--- TEST SUITE 7: STUDENT PROGRESS ISOLATION ---");
    // Seed Progress for Student 1 in Course A1
    const progress1 = await Progress.create({
      userId: student1._id,
      lessonId: lesson1Id,
      lastPositionSeconds: 120, // 2 minutes in
      watchedSeconds: 120,
      completed: true,
      lastWatchedAt: new Date(),
    });
    testProgresses.push(progress1._id);

    // Teacher A inspects Student 1's progress
    const progressResA = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/students/${student1._id}/progress`, method: "GET" },
      null,
      authA.cookie
    );
    assert.equal(progressResA.statusCode, 200);
    assert.equal(progressResA.json.success, true);
    assert.equal(progressResA.json.data.stats.totalLessons, 1);
    assert.equal(progressResA.json.data.stats.completedLessons, 1);
    assert.equal(progressResA.json.data.stats.completionPercentage, 100);
    assert.equal(progressResA.json.data.lessons[0].progressSeconds, 120);
    console.log("✓ TEST 7.1 PASSED: Teacher A can inspect Student 1's real progress data.");

    // Teacher B attempts to inspect Student 1's progress in Teacher A's course
    const unauthProgressRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/students/${student1._id}/progress`, method: "GET" },
      null,
      authB.cookie
    );
    assert.equal(unauthProgressRes.statusCode, 403, "Teacher B cannot view progress for Teacher A's course");
    console.log("✓ TEST 7.2 PASSED: Cross-teacher student progress access blocked with 403.");

    // ======================================================================
    // 8. COURSE DELETION SAFEGUARDS (ACTIVE ENROLLMENTS & PAYMENTS)
    // ======================================================================
    console.log("\n--- TEST SUITE 8: COURSE DELETION SAFEGUARDS ---");
    // Teacher A attempts to delete Course A1 while Student 1 is actively enrolled
    const deleteCourseAttempt1 = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}`, method: "DELETE" },
      null,
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(deleteCourseAttempt1.statusCode, 400, "Deletion must be rejected when active enrollments exist");
    assert.equal(deleteCourseAttempt1.json.code, "ACTIVE_ENROLLMENTS_EXIST");
    console.log("✓ TEST 8.1 PASSED: Backend safeguards prevent deleting courses with active student enrollments.");

    // Seed Payment for Course A1
    const payment1 = await Payment.create({
      userId: student1._id,
      courseId: courseA1Id,
      ownerId: teacherA._id,
      amount: 2999,
      status: "approved",
      transactionReference: `TX_${TIMESTAMP}`,
    });
    testPayments.push(payment1._id);

    // Cancel enrollment
    await Enrollment.findByIdAndUpdate(enrollment1._id, { status: "cancelled" });

    // Teacher A attempts to delete Course A1 while payment records exist
    const deleteCourseAttempt2 = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}`, method: "DELETE" },
      null,
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(deleteCourseAttempt2.statusCode, 400, "Deletion must be rejected when financial records exist");
    assert.equal(deleteCourseAttempt2.json.code, "FINANCIAL_RECORDS_EXIST");
    console.log("✓ TEST 8.2 PASSED: Backend safeguards prevent deleting courses with financial payment history.");

    // ======================================================================
    // 9. TEACHER PROFILE & FINANCIAL DATA PROTECTION
    // ======================================================================
    console.log("\n--- TEST SUITE 9: TEACHER PROFILE & COMMISSION IMMUTABILITY ---");
    // Test 9.1: Teacher A views profile
    const profileResA = await httpRequest(
      server,
      { path: "/api/teacher/profile", method: "GET" },
      null,
      authA.cookie
    );
    assert.equal(profileResA.statusCode, 200);
    assert.equal(profileResA.json.data.profile.teacherProfile.commissionRate, 0.25);
    assert.equal(profileResA.json.data.profile.teacherProfile.isApproved, true);

    // Test 9.2: Teacher A updates profile fields (headline, bio, upiId)
    const updateProfileRes = await httpRequest(
      server,
      { path: "/api/teacher/profile", method: "PATCH" },
      {
        headline: "Distinguished Fellow in Cloud Computing",
        bio: "Updated biography and curriculum vitae",
        phone: "9100000099",
        payoutUpiId: "alpha_new@okhdfcbank",
        commissionRate: 0.99, // Malicious attempt to raise own commission rate
        isApproved: true,
      },
      authA.cookie,
      authA.csrfToken
    );
    assert.equal(updateProfileRes.statusCode, 200);
    assert.equal(updateProfileRes.json.data.profile.teacherProfile.headline, "Distinguished Fellow in Cloud Computing");
    assert.equal(updateProfileRes.json.data.profile.teacherProfile.payoutUpiId, "alpha_new@okhdfcbank");

    // Verify in database that commissionRate was NOT changed by teacher
    const teacherADb = await User.findById(teacherA._id);
    assert.equal(
      teacherADb.teacherProfile.commissionRate,
      0.25,
      "Teacher commissionRate must remain strictly immutable against teacher edits"
    );
    console.log("✓ TEST 9.1 PASSED: Profile fields updated while commissionRate remained strictly protected.");

    // ======================================================================
    // 10. UNAPPROVED TEACHER RESTRICTIONS
    // ======================================================================
    console.log("\n--- TEST SUITE 10: UNAPPROVED TEACHER RESTRICTIONS ---");
    // Test 10.1: Unapproved teacher can view their profile and stats
    const unapprovedProfileRes = await httpRequest(
      server,
      { path: "/api/teacher/profile", method: "GET" },
      null,
      authUnapproved.cookie
    );
    assert.equal(unapprovedProfileRes.statusCode, 200, "Unapproved teacher can view profile");
    assert.equal(unapprovedProfileRes.json.data.profile.teacherProfile.isApproved, false);

    const unapprovedStatsRes = await httpRequest(
      server,
      { path: "/api/teacher/stats", method: "GET" },
      null,
      authUnapproved.cookie
    );
    assert.equal(unapprovedStatsRes.statusCode, 200, "Unapproved teacher can view stats");
    assert.equal(unapprovedStatsRes.json.data.stats.isApproved, false);
    console.log("✓ TEST 10.1 PASSED: Unapproved teacher can view profile and vetting status notice.");

    // Test 10.2: Unapproved teacher is blocked from creating courses
    const unapprovedCourseRes = await httpRequest(
      server,
      { path: "/api/teacher/courses", method: "POST" },
      {
        title: "Premature Course",
        price: 999,
      },
      authUnapproved.cookie,
      authUnapproved.csrfToken
    );
    assert.equal(unapprovedCourseRes.statusCode, 403, "Unapproved teacher cannot create courses");
    assert.equal(unapprovedCourseRes.json.code, "TEACHER_NOT_APPROVED");

    // Test 10.3: Unapproved teacher is blocked from video upload
    const unapprovedVideoRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${courseA1Id}/upload-video`, method: "POST" },
      { title: "Premature Video" },
      authUnapproved.cookie,
      authUnapproved.csrfToken
    );
    assert.equal(unapprovedVideoRes.statusCode, 403, "Unapproved teacher cannot upload video");
    assert.equal(unapprovedVideoRes.json.code, "TEACHER_NOT_APPROVED");
    console.log("✓ TEST 10.2 PASSED: Unapproved teacher blocked from course creation and video uploads.");

    // ======================================================================
    // 11. SUSPENDED TEACHER RESTRICTIONS
    // ======================================================================
    console.log("\n--- TEST SUITE 11: SUSPENDED TEACHER RESTRICTIONS ---");
    // Suspend the teacher account in database while session is active
    await User.findByIdAndUpdate(suspendedTeacher._id, { isActive: false });

    // Test 11.1: Suspended teacher with active session is barred from stats and courses
    const suspendedStatsRes = await httpRequest(
      server,
      { path: "/api/teacher/stats", method: "GET" },
      null,
      authSuspended.cookie
    );
    assert.equal(suspendedStatsRes.statusCode, 403, "Suspended teacher is barred from accessing stats");
    assert.equal(suspendedStatsRes.json.code, "ACCOUNT_INACTIVE");

    const suspendedCoursesRes = await httpRequest(
      server,
      { path: "/api/teacher/courses", method: "GET" },
      null,
      authSuspended.cookie
    );
    assert.equal(suspendedCoursesRes.statusCode, 403, "Suspended teacher is barred from accessing courses");
    assert.equal(suspendedCoursesRes.json.code, "ACCOUNT_INACTIVE");
    console.log("✓ TEST 11.1 PASSED: Suspended teacher blocked with 403 ACCOUNT_INACTIVE on all studio endpoints.");

    // Test 11.2: Suspended teacher cannot initiate a new session
    const freshCsrfRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" });
    const freshCookie = extractCookie(freshCsrfRes.headers);
    const freshCsrf = freshCsrfRes.json.data.csrfToken;
    const suspendedLoginAttempt = await httpRequest(
      server,
      { path: "/api/auth/login", method: "POST" },
      { email: suspendedTeacher.email, password: "Password123!" },
      freshCookie,
      freshCsrf
    );
    assert.equal(suspendedLoginAttempt.statusCode, 401, "Suspended user login must be rejected with 401");
    console.log("✓ TEST 11.2 PASSED: Suspended teacher login rejected with 401 INVALID_CREDENTIALS.");

    // ======================================================================
    // 12. CSRF & SESSION SECURITY
    // ======================================================================
    console.log("\n--- TEST SUITE 12: CSRF & SESSION SECURITY ---");
    // Test 12.1: Missing CSRF token on state-changing course creation
    const noCsrfRes = await httpRequest(
      server,
      { path: "/api/teacher/courses", method: "POST" },
      { title: "No CSRF Course" },
      authA.cookie,
      null // No CSRF
    );
    assert.equal(noCsrfRes.statusCode, 403, "Missing CSRF token must return 403");

    // Test 12.2: Invalid CSRF token
    const badCsrfRes = await httpRequest(
      server,
      { path: "/api/teacher/courses", method: "POST" },
      { title: "Bad CSRF Course" },
      authA.cookie,
      "invalid-csrf-token"
    );
    assert.equal(badCsrfRes.statusCode, 403, "Invalid CSRF token must return 403");

    // Test 12.3: Unauthenticated request
    const unauthReqRes = await httpRequest(
      server,
      { path: "/api/teacher/courses", method: "GET" }
    );
    assert.equal(unauthReqRes.statusCode, 401, "Unauthenticated request must return 401");
    console.log("✓ TEST 12.1 PASSED: CSRF and session authentication strictly verified.");

    console.log("\n==========================================================");
    console.log("=== ALL PHASE 3.3 TEACHER STUDIO TESTS PASSED SUCCESSFULLY! ===");
    console.log("==========================================================");
  } finally {
    // Cleanup seeded test artifacts in isolated DB
    try {
      if (testLessons.length > 0) await Lesson.deleteMany({ _id: { $in: testLessons } });
      if (testCourses.length > 0) {
        await Lesson.deleteMany({ courseId: { $in: testCourses } });
        await Course.deleteMany({ _id: { $in: testCourses } });
      }
      if (testProgresses.length > 0) await Progress.deleteMany({ _id: { $in: testProgresses } });
      if (testPayments.length > 0) {
        await mongoose.connection.collection("payments").deleteMany({ _id: { $in: testPayments } });
      }
      if (testEnrollments.length > 0) await Enrollment.deleteMany({ _id: { $in: testEnrollments } });
      if (testUsers.length > 0) await User.deleteMany({ _id: { $in: testUsers } });
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }

    try {
      if (server.closeAllConnections) server.closeAllConnections();
      server.close();
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  }
}

runTeacherStudioTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL ERROR in Phase 3.3 Teacher Studio Test Suite:", err);
    process.exit(1);
  });
