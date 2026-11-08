import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import ContentAccess from "../models/ContentAccess.js";
import Progress from "../models/Progress.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

function httpRequest(server, options, body = null, cookie = null, csrfToken = null, userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36") {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = {
      "User-Agent": userAgent,
      ...(options.headers || {}),
    };

    if (cookie) headers["Cookie"] = cookie;
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    let payload = null;
    if (body) {
      if (typeof body === "string") {
        payload = body;
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
      } else {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
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
        let rawData = "";
        res.on("data", (chunk) => (rawData += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (_) { }

          let sessionCookie = cookie || "";
          const setCookieHeaders = res.headers["set-cookie"];
          if (setCookieHeaders) {
            const cookiesMap = new Map();
            if (cookie) {
              cookie.split(";").forEach((c) => {
                const parts = c.trim().split("=");
                if (parts[0]) cookiesMap.set(parts[0], parts.slice(1).join("="));
              });
            }
            setCookieHeaders.forEach((raw) => {
              const firstPart = raw.split(";")[0].trim();
              const eqIdx = firstPart.indexOf("=");
              if (eqIdx !== -1) {
                cookiesMap.set(firstPart.slice(0, eqIdx), firstPart.slice(eqIdx + 1));
              }
            });
            sessionCookie = Array.from(cookiesMap.entries())
              .map(([k, v]) => `${k}=${v}`)
              .join("; ");
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: rawData,
            json,
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

async function loginUser(server, email, password) {
  const csrfRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" });
  const csrfToken = csrfRes.json?.data?.csrfToken;
  const cookie = csrfRes.cookie;

  const loginRes = await httpRequest(
    server,
    { path: "/api/auth/login", method: "POST" },
    { email, password },
    cookie,
    csrfToken
  );

  return {
    cookie: loginRes.cookie || cookie,
    csrfToken: loginRes.json?.data?.csrfToken || csrfToken,
    user: loginRes.json?.data?.user,
  };
}

async function runTests() {
  console.log("=== Testing Teacher-Controlled Module & Lesson Unlocking System ===");

  await connectTestDB();
  assertTestDatabaseIsolation();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const runId = crypto.randomBytes(4).toString("hex");

    // Clean test state
    await ContentAccess.deleteMany({ courseId: { $exists: true } });

    // 1. Setup Users
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const teacher = await User.create({
      name: `Teacher ${runId}`,
      email: `teacher_${runId}@eduvibe.test`,
      phone: "+919876543210",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true, headline: "Senior Instructor" },
    });

    const student1 = await User.create({
      name: `Student 1 ${runId}`,
      email: `student1_${runId}@eduvibe.test`,
      phone: "+919876543211",
      passwordHash,
      role: "student",
      isActive: true,
    });

    const student2 = await User.create({
      name: `Student 2 ${runId}`,
      email: `student2_${runId}@eduvibe.test`,
      phone: "+919876543212",
      passwordHash,
      role: "student",
      isActive: true,
    });

    // 2. Setup Course with 2 Modules and 4 Lessons
    const course = await Course.create({
      title: `Content Access Masterclass ${runId}`,
      slug: `content-access-${runId}`,
      description: "Testing unlocking system",
      price: 500,
      ownerId: teacher._id,
      instructor: teacher.name,
      isPublished: true,
    });

    // Module 1: Lesson 1 & Lesson 2
    const lessonM1L1 = await Lesson.create({
      courseId: course._id,
      title: "Module 1 Lesson 1 (Intro)",
      moduleName: "Module 1",
      order: 1,
      durationMinutes: 10,
      durationSeconds: 600,
      bunnyVideoId: "11111111-1111-1111-1111-111111111111",
      isPublished: true,
    });

    const lessonM1L2 = await Lesson.create({
      courseId: course._id,
      title: "Module 1 Lesson 2 (Deep Dive)",
      moduleName: "Module 1",
      order: 2,
      durationMinutes: 15,
      durationSeconds: 900,
      bunnyVideoId: "22222222-2222-2222-2222-222222222222",
      isPublished: true,
    });

    // Module 2: Lesson 3 & Lesson 4
    const lessonM2L1 = await Lesson.create({
      courseId: course._id,
      title: "Module 2 Lesson 1 (Advanced)",
      moduleName: "Module 2",
      order: 3,
      durationMinutes: 20,
      durationSeconds: 1200,
      bunnyVideoId: "33333333-3333-3333-3333-333333333333",
      isPublished: true,
    });

    const lessonM2L2 = await Lesson.create({
      courseId: course._id,
      title: "Module 2 Lesson 2 (Capstone)",
      moduleName: "Module 2",
      order: 4,
      durationMinutes: 25,
      durationSeconds: 1500,
      bunnyVideoId: "44444444-4444-4444-4444-444444444444",
      isPublished: true,
    });

    const teacherAuth = await loginUser(server, teacher.email, "Password123!");
    const student1Auth = await loginUser(server, student1.email, "Password123!");
    const student2Auth = await loginUser(server, student2.email, "Password123!");

    // --- TEST 1: Teacher enrolls Student 1 and verifies default content access ---
    console.log("-> Test 1: Enroll Student 1 and verify default content access (Module 1 unlocked, Module 2 locked)");
    const enrollRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/students/enroll`, method: "POST" },
      { email: student1.email },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(enrollRes.statusCode, 201, `Enroll status: ${JSON.stringify(enrollRes.body)}`);

    // Verify ContentAccess record for student1
    const accessS1 = await ContentAccess.findOne({ courseId: course._id, scope: "student", userId: student1._id });
    assert.ok(accessS1, "Student 1 ContentAccess record should exist");
    assert.deepStrictEqual(accessS1.unlockedModules, ["Module 1"], "Only Module 1 should be unlocked by default");
    assert.strictEqual(accessS1.unlockedLessons.length, 2, "Both lessons of Module 1 should be unlocked");
    assert.ok(accessS1.unlockedLessons.map(String).includes(lessonM1L1._id.toString()));
    assert.ok(accessS1.unlockedLessons.map(String).includes(lessonM1L2._id.toString()));
    assert.ok(!accessS1.unlockedLessons.map(String).includes(lessonM2L1._id.toString()));

    // --- TEST 2: Student 1 fetches curriculum via getEnrolledCourse ---
    console.log("-> Test 2: Student 1 gets curriculum with unlocking flags");
    const s1CourseRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(s1CourseRes.statusCode, 200);
    const syllabus = s1CourseRes.json.data.syllabus;
    assert.strictEqual(syllabus.length, 4);

    const m1l1Item = syllabus.find((l) => l.id === lessonM1L1._id.toString());
    const m1l2Item = syllabus.find((l) => l.id === lessonM1L2._id.toString());
    const m2l1Item = syllabus.find((l) => l.id === lessonM2L1._id.toString());
    const m2l2Item = syllabus.find((l) => l.id === lessonM2L2._id.toString());

    assert.strictEqual(m1l1Item.isUnlocked, true, "M1L1 must be unlocked");
    assert.strictEqual(m1l2Item.isUnlocked, true, "M1L2 must be unlocked");
    assert.strictEqual(m2l1Item.isUnlocked, false, "M2L1 must be locked");
    assert.strictEqual(m2l2Item.isUnlocked, false, "M2L2 must be locked");

    // --- TEST 3: Student 1 Playback authorization for unlocked lesson vs locked lesson ---
    console.log("-> Test 3: Playback authorization checks");
    const playM1L1Res = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM1L1._id}/playback`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(playM1L1Res.statusCode, 200, "M1L1 playback should succeed");
    assert.ok(playM1L1Res.json.data.playback.embedUrl, "Must include signed embed URL");
    student1Auth.cookie = playM1L1Res.cookie; // Update with device token cookie

    const playM2L1Res = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM2L1._id}/playback`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(playM2L1Res.statusCode, 403, "M2L1 playback must be rejected with 403");
    assert.strictEqual(playM2L1Res.json.code, "MODULE_LOCKED", "Error code should be MODULE_LOCKED");

    // --- TEST 4: Student 1 Progress save blocked on locked lesson ---
    console.log("-> Test 4: Save progress authorization checks");
    const progLockRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM2L1._id}/progress`, method: "POST" },
      { position: 45, watchedSeconds: 45 },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(progLockRes.statusCode, 403, "Progress save on locked lesson must be 403");

    // Progress save on unlocked lesson succeeds
    const progOkRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM1L1._id}/progress`, method: "POST" },
      { position: 60, watchedSeconds: 60 },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(progOkRes.statusCode, 200, "Progress save on unlocked lesson must succeed");

    // --- TEST 5: Teacher unlocks Module 2 for Course Baseline ---
    console.log("-> Test 5: Teacher unlocks Module 2 for Course Baseline");
    const unlockM2Res = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/content-access/modules`, method: "PATCH" },
      { moduleName: "Module 2", unlocked: true },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(unlockM2Res.statusCode, 200);

    // Also unlock Lesson M2L1 in baseline
    const unlockM2L1Res = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/content-access/lessons/${lessonM2L1._id}`, method: "PATCH" },
      { unlocked: true },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(unlockM2L1Res.statusCode, 200);

    // --- TEST 6: Teacher customizes Student 1 override (Unlocks M2L1 for Student 1 specifically) ---
    console.log("-> Test 6: Teacher unlocks M2 & M2L1 specifically for Student 1");
    await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/content-access/modules`, method: "PATCH" },
      { moduleName: "Module 2", unlocked: true, studentId: student1._id.toString() },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/content-access/lessons/${lessonM2L1._id}`, method: "PATCH" },
      { unlocked: true, studentId: student1._id.toString() },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );

    // Now Student 1 can stream M2L1
    const playM2L1NowRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM2L1._id}/playback`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(playM2L1NowRes.statusCode, 200, "M2L1 should now be unlocked for Student 1");

    // But M2L2 is still locked for Student 1!
    const playM2L2Res = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM2L2._id}/playback`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(playM2L2Res.statusCode, 403);
    assert.strictEqual(playM2L2Res.json.code, "LESSON_LOCKED");

    // --- TEST 7: Bulk Unlock All ---
    console.log("-> Test 7: Bulk Unlock All");
    const bulkUnlockRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/content-access/unlock-all`, method: "POST" },
      {},
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(bulkUnlockRes.statusCode, 200);

    // Student 1 can now stream M2L2 as well
    const playM2L2NowRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM2L2._id}/playback`, method: "GET" },
      null,
      student1Auth.cookie
    );
    if (playM2L2NowRes.statusCode !== 200) {
      console.log("Bulk Unlock Failed Debug:", {
        status: playM2L2NowRes.statusCode,
        code: playM2L2NowRes.json?.code,
        message: playM2L2NowRes.json?.message,
      });
    }
    assert.strictEqual(playM2L2NowRes.statusCode, 200, "M2L2 should now be accessible after bulk unlock");

    // --- TEST 8: Bulk Lock All ---
    console.log("-> Test 8: Bulk Lock All");
    const bulkLockRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/content-access/lock-all`, method: "POST" },
      {},
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(bulkLockRes.statusCode, 200);

    // Even M1L1 is now locked
    const playM1L1LockedRes = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/lessons/${lessonM1L1._id}/playback`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(playM1L1LockedRes.statusCode, 403, "M1L1 must be locked after bulk lock");

    // --- TEST 9: Ownership & Tenant Security Checks ---
    console.log("-> Test 9: Security checks (Unauthorized teacher cannot change another teacher's course)");
    const otherTeacher = await User.create({
      name: `Rival Teacher ${runId}`,
      email: `rival_${runId}@eduvibe.test`,
      phone: "+919876543299",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true },
    });
    const rivalAuth = await loginUser(server, otherTeacher.email, "Password123!");

    const unauthorizedAccessRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/content-access`, method: "GET" },
      null,
      rivalAuth.cookie
    );
    assert.strictEqual(unauthorizedAccessRes.statusCode, 403, "Non-owner teacher must receive 403");
    assert.strictEqual(unauthorizedAccessRes.statusCode, 403, "Non-owner teacher must receive 403");

    console.log("✅ All Teacher-Controlled Content Access & Unlocking tests passed successfully!");
  } finally {
    // 1. Close HTTP server asynchronously
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) console.error("Error closing HTTP server:", err.message);
        resolve();
      });
    });

    // 2. Close session store client connection
    const sessionStore = app.locals?.sessionStore;
    if (sessionStore && typeof sessionStore.close === "function") {
      try {
        await sessionStore.close();
      } catch (err) {
        console.error("Error closing session store:", err.message);
      }
    }

    // 3. Disconnect Mongoose after dependent resources are closed
    try {
      await mongoose.disconnect();
    } catch (err) {
      console.error("Error disconnecting Mongoose:", err.message);
    }
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exitCode = 1;
});
