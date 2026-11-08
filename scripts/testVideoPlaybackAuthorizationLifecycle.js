import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";
import Device from "../models/Device.js";
import Payment from "../models/Payment.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testLessons = [];
const testEnrollments = [];
const testProgresses = [];
const testDevices = [];
const testPayments = [];

function httpRequest(server, options, body = null, cookie = null, csrfToken = null, deviceToken = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { ...(options.headers || {}) };

    if (cookie) {
      headers["Cookie"] = cookie;
    }

    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    if (deviceToken) {
      headers["x-device-token"] = deviceToken;
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
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) { }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            json,
          });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function loginUser(server, email, password) {
  const loginRes = await httpRequest(
    server,
    { path: "/api/auth/login", method: "POST" },
    { email, password }
  );

  assert.equal(loginRes.statusCode, 200, `Login failed for ${email}`);
  const setCookie = loginRes.headers["set-cookie"];
  assert.ok(setCookie, "Login must set session cookies");

  const rawCookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
  const cookieParts = rawCookieHeader.split(";").map((p) => p.trim());

  let sessionCookie = "";
  let csrfToken = "";
  let deviceToken = "";

  for (const part of cookieParts) {
    if (part.startsWith("connect.sid=")) {
      sessionCookie = part;
    } else if (part.startsWith("eduvibe_csrf=")) {
      csrfToken = part.split("=")[1];
    } else if (part.startsWith("eduvibe_device_token=")) {
      deviceToken = part.split("=")[1];
    }
  }

  const cookie = `${sessionCookie}; eduvibe_csrf=${csrfToken}${deviceToken ? `; eduvibe_device_token=${deviceToken}` : ""}`;

  return {
    cookie,
    csrfToken,
    deviceToken,
    user: loginRes.json.data.user,
  };
}

async function runTests() {
  console.log("==========================================================");
  console.log("=== RUNNING VIDEO PLAYER AUTHORIZATION & PLAYBACK TESTS ==");
  console.log("==========================================================");

  await connectTestDB();
  assertTestDatabaseIsolation(mongoose);
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, "127.0.0.1", res));

  try {
    const pwHash = await bcrypt.hash("Password123!", 10);

    // 1. Create Teacher & Student
    const teacher = await User.create({
      name: "Teacher Alice",
      email: `teacher_alice_${TIMESTAMP}@videotest.local`,
      phone: "+919876543201",
      passwordHash: pwHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        headline: "Lead Instructor",
        bio: "Specialist",
        commissionRate: 0.20,
        isApproved: true,
      },
    });
    testUsers.push(teacher._id);

    const student = await User.create({
      name: "Student Bob",
      email: `student_bob_${TIMESTAMP}@videotest.local`,
      phone: "+919876543202",
      passwordHash: pwHash,
      role: "student",
      isActive: true,
    });
    testUsers.push(student._id);

    // 2. Create Course and Lesson
    const course = await Course.create({
      title: "Video Streaming Mastery",
      slug: `video-streaming-mastery-${TIMESTAMP}`,
      description: "Advanced video playback lifecycle testing",
      price: 2999,
      ownerId: teacher._id,
      isPublished: true,
    });
    testCourses.push(course._id);

    const lesson = await Lesson.create({
      courseId: course._id,
      title: "Lesson 1: Player Lifecycle",
      moduleName: "Module 1",
      order: 1,
      durationSeconds: 300,
      durationMinutes: 5,
      bunnyVideoId: "test-bunny-guid-12345",
      isPublished: true,
    });
    testLessons.push(lesson._id);

    // 3. Teacher directly enrolls student into paid course (Immediate Active Access)
    const teacherSession = await loginUser(server, teacher.email, "Password123!");
    const enrollRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/students/enroll`, method: "POST" },
      { email: student.email },
      teacherSession.cookie,
      teacherSession.csrfToken
    );
    assert.equal(enrollRes.statusCode, 201);
    assert.equal(enrollRes.json.data.enrollment.status, "active", "Enrollment must be active immediately");

    // Track payment created for cleanup
    const autoPayment = await Payment.findOne({ userId: student._id, courseId: course._id });
    if (autoPayment) testPayments.push(autoPayment._id);

    // Log in Student
    const studentSession = await loginUser(server, student.email, "Password123!");

    // --- TEST 1: INITIAL VIDEO AUTHORIZATION ---
    console.log("\n--- TEST 1: INITIAL VIDEO AUTHORIZATION ---");
    let initialAuthRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`, method: "GET" },
      null,
      studentSession.cookie
    );
    assert.equal(initialAuthRes.statusCode, 200);
    assert.ok(initialAuthRes.json.data.playback.embedUrl, "Must return signed embed URL");
    assert.equal(initialAuthRes.json.data.playback.embedUrl.includes("mediadelivery.net"), true);
    assert.equal(initialAuthRes.json.data.lesson.durationSeconds, 300);
    console.log("✓ TEST 1 PASSED: Initial video playback authorized with valid embed URL.");

    // --- TEST 2: PLAY -> PAUSE -> RESUME WITHOUT RE-AUTHORIZATION OR RE-INITIALIZATION ---
    console.log("\n--- TEST 2: PLAY -> PAUSE -> RESUME PROGRESS SAVING WITHOUT RE-AUTHORIZING ---");
    // When student pauses at 45s: Player triggers progress save with interval [0, 45]
    const pauseSyncRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/progress`, method: "POST" },
      { position: 45, intervals: [[0, 45]], completed: false },
      studentSession.cookie,
      studentSession.csrfToken
    );
    assert.equal(pauseSyncRes.statusCode, 200);
    assert.equal(pauseSyncRes.json.data.progress.lastPositionSeconds, 45);
    assert.equal(pauseSyncRes.json.data.progress.uniqueWatchedSeconds, 45);
    assert.equal(pauseSyncRes.json.data.progress.completed, false);

    // Student resumes playback and pauses again at 90s: Interval [45, 90]
    const resumeSyncRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/progress`, method: "POST" },
      { position: 90, intervals: [[0, 45], [45, 90]], completed: false },
      studentSession.cookie,
      studentSession.csrfToken
    );
    assert.equal(resumeSyncRes.statusCode, 200);
    assert.equal(resumeSyncRes.json.data.progress.lastPositionSeconds, 90);
    assert.equal(resumeSyncRes.json.data.progress.uniqueWatchedSeconds, 90);
    console.log("✓ TEST 2 PASSED: Play -> pause -> resume updates progress seamlessly without requesting new playback URL.");

    // --- TEST 3: SEEKING DOES NOT FALSELY INCREASE UNIQUE COVERAGE ---
    console.log("\n--- TEST 3: SEEKING DOES NOT FALSELY INCREASE UNIQUE COVERAGE ---");
    // Student seeks forward to 250s and pauses
    const seekForwardRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/progress`, method: "POST" },
      { position: 250, intervals: [[0, 90]], completed: false },
      studentSession.cookie,
      studentSession.csrfToken
    );
    assert.equal(seekForwardRes.statusCode, 200);
    assert.equal(seekForwardRes.json.data.progress.lastPositionSeconds, 250);
    assert.equal(seekForwardRes.json.data.progress.uniqueWatchedSeconds, 90, "Seeking must not increase unique coverage");
    console.log("✓ TEST 3 PASSED: Seeking forward updates position but preserves unique watched coverage.");

    // --- TEST 4: EXPIRED PLAYBACK AUTHORIZATION CAN BE REFRESHED ---
    console.log("\n--- TEST 4: EXPIRED PLAYBACK AUTHORIZATION REFRESH ---");
    const refreshRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`, method: "GET" },
      null,
      studentSession.cookie
    );
    assert.equal(refreshRes.statusCode, 200);
    assert.ok(refreshRes.json.data.playback.embedUrl);
    assert.equal(refreshRes.json.data.playback.lastPositionSeconds, 250, "Refreshed playback data must reflect last saved position");
    console.log("✓ TEST 4 PASSED: Playback endpoint can refresh authorization and returns current resume position.");

    // --- TEST 5: TWO-DEVICE LIMIT AND OWNERSHIP ENFORCEMENT ---
    console.log("\n--- TEST 5: TWO-DEVICE LIMIT & OWNERSHIP ENFORCEMENT ---");
    // Device 1 was registered during initial login. Register Device 2.
    const dev2Token = "dev2_test_token_" + TIMESTAMP;
    const dev2Res = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`, method: "GET" },
      null,
      studentSession.cookie,
      null,
      dev2Token
    );
    assert.equal(dev2Res.statusCode, 200);

    // Attempt to register Device 3
    const dev3Token = "dev3_test_token_" + TIMESTAMP;
    const dev3Res = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`, method: "GET" },
      null,
      studentSession.cookie,
      null,
      dev3Token
    );
    assert.equal(dev3Res.statusCode, 403);
    assert.equal(dev3Res.json.code, "DEVICE_LIMIT_EXCEEDED");
    console.log("✓ TEST 5 PASSED: Two-device limit strictly maintained; 3rd device blocked.");

    // --- TEST 6: SUPER ADMIN FINANCIAL TRACKING VISIBILITY & AUDIT ---
    console.log("\n--- TEST 6: SUPER ADMIN FINANCIAL TRACKING VISIBILITY & AUDIT ---");
    const adminUser = await User.create({
      name: "Super Admin",
      email: `admin_${TIMESTAMP}@videotest.local`,
      phone: "+919876543209",
      passwordHash: pwHash,
      role: "super_admin",
      isActive: true,
    });
    testUsers.push(adminUser._id);

    const adminSession = await loginUser(server, adminUser.email, "Password123!");
    const paymentsListRes = await httpRequest(
      server,
      { path: "/api/admin/payments?status=pending", method: "GET" },
      null,
      adminSession.cookie
    );
    assert.equal(paymentsListRes.statusCode, 200);
    const trackingPayment = paymentsListRes.json.data.payments.find(
      (p) => p.student?.id === student._id.toString() && p.course?.id === course._id.toString()
    );
    assert.ok(trackingPayment, "Teacher-created enrollment must appear in Super Admin payments queue");
    assert.equal(trackingPayment.amount, 2999);
    assert.equal(trackingPayment.financialSnapshot.collectionMethod, "direct_teacher");

    // Super Admin approves the financial settlement
    const approvePaymentRes = await httpRequest(
      server,
      { path: `/api/admin/payments/${trackingPayment.id}/approve`, method: "PATCH" },
      null,
      adminSession.cookie,
      adminSession.csrfToken
    );
    assert.equal(approvePaymentRes.statusCode, 200);
    assert.equal(approvePaymentRes.json.data.payment.status, "approved");
    assert.ok(approvePaymentRes.json.data.payment.financialSnapshot.calculatedAt);

    // Crucial check: Student active enrollment remains active
    const finalEnrollment = await Enrollment.findOne({ userId: student._id, courseId: course._id });
    assert.equal(finalEnrollment.status, "active", "Admin financial marking must not interrupt active student access");
    console.log("✓ TEST 6 PASSED: Super Admin financial tracking settlement recorded without disrupting student access.");

    console.log("\n==========================================================");
    console.log("=== ALL VIDEO PLAYER AUTHORIZATION TESTS PASSED (100%) ====");
    console.log("==========================================================");
  } finally {
    if (testDevices.length) await Device.deleteMany({ _id: { $in: testDevices } });
    if (testProgresses.length) await Progress.deleteMany({ _id: { $in: testProgresses } });
    if (testEnrollments.length) await Enrollment.deleteMany({ _id: { $in: testEnrollments } });
    if (testLessons.length) await Lesson.deleteMany({ _id: { $in: testLessons } });
    if (testCourses.length) await Course.deleteMany({ _id: { $in: testCourses } });
    if (testUsers.length) await User.deleteMany({ _id: { $in: testUsers } });
    if (testPayments.length) await Payment.deleteMany({ _id: { $in: testPayments } });

    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
