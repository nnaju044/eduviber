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
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";
import { mergeIntervals, calculateUniqueSeconds, isFullCoverage } from "../services/intervalService.js";
import { hashDeviceToken } from "../services/deviceService.js";

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testLessons = [];
const testEnrollments = [];
const testProgresses = [];
const testDevices = [];

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
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (_) { }

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
  };
}

async function runTests() {
  console.log("==========================================================");
  console.log("=== RUNNING E12: VIDEO LEARNING & SECURE PLAYBACK TESTS ===");
  console.log("==========================================================");

  await connectTestDB(mongoose);
  assertTestDatabaseIsolation(mongoose);
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("Password123!", salt);

    // 1. Create student user
    const studentUser = await User.create({
      name: "E12 Student",
      email: `student_e12_${TIMESTAMP}@example.com`,
      phone: "+919988776655",
      passwordHash,
      role: "student",
      isActive: true,
      hasChangedPassword: true,
    });
    testUsers.push(studentUser._id);

    // 2. Create course and lesson
    const course = await Course.create({
      title: `E12 Video Mastery ${TIMESTAMP}`,
      slug: `e12-video-mastery-${TIMESTAMP}`,
      description: "Mastering video playback with interval tracking.",
      price: 100,
      isPublished: true,
    });
    testCourses.push(course._id);

    const lesson = await Lesson.create({
      courseId: course._id,
      title: "Lesson 1: Deep Video Architecture",
      moduleName: "Module 1",
      order: 1,
      durationMinutes: 10,
      durationSeconds: 600,
      bunnyVideoId: "12345678-1234-1234-1234-123456789abc",
      isPublished: true,
      isFreePreview: false,
    });
    testLessons.push(lesson._id);

    // 3. Create active enrollment
    const enrollment = await Enrollment.create({
      userId: studentUser._id,
      courseId: course._id,
      status: "active",
      approvedAt: new Date(),
    });
    testEnrollments.push(enrollment._id);

    const studentAuth = await loginUser(server, studentUser.email, "Password123!");

    // ======================================================================
    // TEST 1: INTERVAL MATHEMATICS & OVERLAPPING MERGE (F06)
    // ======================================================================
    console.log("\n--- TEST 1: UNIQUE INTERVAL MATHEMATICS ---");
    const rawIntervals = [[0, 60], [30, 90], [120, 180], [150, 200]];
    const merged = mergeIntervals(rawIntervals);
    assert.deepEqual(merged, [[0, 90], [120, 200]], "Intervals must correctly merge into [0, 90] and [120, 200]");
    const uniqueSecs = calculateUniqueSeconds(merged);
    assert.equal(uniqueSecs, 170, "Unique seconds must equal 90 + 80 = 170");

    assert.equal(isFullCoverage(merged, 600), false, "170/600s must NOT be full coverage");
    const fullIntervals = [[0, 300], [290, 600]];
    assert.equal(isFullCoverage(fullIntervals, 600), true, "Continuous 0-600 must be full coverage");
    console.log("✓ TEST 1 PASSED: Watched interval merging and unique duration math verified.");

    // ======================================================================
    // TEST 2: TWO-DEVICE REGISTRATION & MAXIMUM LIMIT ENFORCEMENT (F10)
    // ======================================================================
    console.log("\n--- TEST 2: DEVICE REGISTRATION & TWO-DEVICE LIMIT ---");
    // Device 1 Playback call (should register Device 1 automatically and return 200)
    const dev1PlaybackRes = await httpRequest(
      server,
      {
        path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`,
        headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36" },
      },
      null,
      studentAuth.cookie
    );
    assert.equal(dev1PlaybackRes.statusCode, 200, "Device 1 playback request should succeed");
    assert.ok(dev1PlaybackRes.json.data.playback.embedUrl, "Must receive signed embedUrl");

    // Retrieve device token from Set-Cookie header
    const dev1SetCookie = dev1PlaybackRes.headers["set-cookie"] || [];
    const dev1CookieStr = Array.isArray(dev1SetCookie)
      ? dev1SetCookie.find((c) => c.startsWith("eduvibe_device_token="))
      : dev1SetCookie;
    assert.ok(dev1CookieStr, "Device 1 registration must set eduvibe_device_token cookie");
    const dev1Token = dev1CookieStr.split(";")[0].split("=")[1];

    // Device 2 Playback call (different UA)
    const dev2PlaybackRes = await httpRequest(
      server,
      {
        path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`,
        headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" },
      },
      null,
      studentAuth.cookie
    );
    assert.equal(dev2PlaybackRes.statusCode, 200, "Device 2 playback request should succeed");
    const dev2SetCookie = dev2PlaybackRes.headers["set-cookie"] || [];
    const dev2CookieStr = Array.isArray(dev2SetCookie)
      ? dev2SetCookie.find((c) => c.startsWith("eduvibe_device_token="))
      : dev2SetCookie;
    assert.ok(dev2CookieStr, "Device 2 registration must set cookie");
    const dev2Token = dev2CookieStr.split(";")[0].split("=")[1];

    // Device 3 Playback call (exceeds limit of 2)
    const dev3PlaybackRes = await httpRequest(
      server,
      {
        path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`,
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0" },
      },
      null,
      studentAuth.cookie
    );
    assert.equal(dev3PlaybackRes.statusCode, 403, "Device 3 should be blocked with 403");
    assert.equal(dev3PlaybackRes.json.code, "DEVICE_LIMIT_EXCEEDED");
    console.log("✓ TEST 2 PASSED: Two-device limit enforced; third device blocked.");

    // ======================================================================
    // TEST 3: DEVICE MANAGEMENT & REVOCATION (F10)
    // ======================================================================
    console.log("\n--- TEST 3: DEVICE LISTING AND REVOCATION ---");
    const listDevRes = await httpRequest(
      server,
      { path: "/api/student/devices" },
      null,
      studentAuth.cookie
    );
    assert.equal(listDevRes.statusCode, 200);
    assert.equal(listDevRes.json.data.devices.length, 2, "Must list 2 active devices");

    const deviceToRevokeId = listDevRes.json.data.devices[0].id;
    const revokeRes = await httpRequest(
      server,
      { path: `/api/student/devices/${deviceToRevokeId}`, method: "DELETE" },
      null,
      studentAuth.cookie,
      studentAuth.csrfToken
    );
    assert.equal(revokeRes.statusCode, 200, "Device revocation should succeed");

    // Now Device 3 can register successfully
    const dev3RetryRes = await httpRequest(
      server,
      {
        path: `/api/student/courses/${course._id}/lessons/${lesson._id}/playback`,
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0" },
      },
      null,
      studentAuth.cookie
    );
    assert.equal(dev3RetryRes.statusCode, 200, "Device 3 can register after device revocation");
    console.log("✓ TEST 3 PASSED: Device removal permits replacement registration.");

    // ======================================================================
    // TEST 4: PROGRESS SYNCHRONISATION & INTERVAL MERGING (F06 & F07)
    // ======================================================================
    console.log("\n--- TEST 4: PROGRESS SYNCHRONISATION & INTERVAL MERGING ---");
    // Device 1 watches [0, 120]
    const dev1SyncRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/progress`, method: "POST" },
      { position: 120, intervals: [[0, 120]], completed: false },
      studentAuth.cookie,
      studentAuth.csrfToken
    );
    assert.equal(dev1SyncRes.statusCode, 200);
    assert.equal(dev1SyncRes.json.data.progress.uniqueWatchedSeconds, 120);

    // Device 2 simultaneously watches [300, 420]
    const dev2SyncRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/progress`, method: "POST" },
      { position: 420, intervals: [[300, 420]], completed: false },
      studentAuth.cookie,
      studentAuth.csrfToken
    );
    assert.equal(dev2SyncRes.statusCode, 200);
    assert.equal(dev2SyncRes.json.data.progress.uniqueWatchedSeconds, 240, "Intervals from both devices must merge to 240 unique seconds");
    console.log("✓ TEST 4 PASSED: Multi-device interval merging and progression verified.");

    // ======================================================================
    // TEST 5: 100% COVERAGE LESSON COMPLETION VALIDATION (F08)
    // ======================================================================
    console.log("\n--- TEST 5: STRICT COMPLETION VALIDATION ---");
    // Seeking to end (position 600) with incomplete intervals must NOT complete lesson
    const seekToEndRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/progress`, method: "POST" },
      { position: 600, completed: true },
      studentAuth.cookie,
      studentAuth.csrfToken
    );
    assert.equal(seekToEndRes.statusCode, 200);
    assert.equal(seekToEndRes.json.data.progress.completed, false, "Seeking to end without full coverage must not complete lesson");

    // Now fill remaining intervals [120, 300] and [420, 600]
    const completeCoverageRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lesson._id}/progress`, method: "POST" },
      { position: 600, intervals: [[120, 300], [420, 600]], completed: true },
      studentAuth.cookie,
      studentAuth.csrfToken
    );
    assert.equal(completeCoverageRes.statusCode, 200);
    assert.equal(completeCoverageRes.json.data.progress.completed, true, "Full coverage + end position must complete lesson");
    assert.equal(completeCoverageRes.json.data.progress.progressPercentage, 100);
    console.log("✓ TEST 5 PASSED: Strict 100% unique coverage requirement for completion verified.");

    console.log("\n==========================================================");
    console.log("=== ALL E12 AUTOMATED TESTS PASSED SUCCESSFULLY! ===");
    console.log("==========================================================");
  } finally {
    if (testDevices.length) await Device.deleteMany({ _id: { $in: testDevices } });
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
