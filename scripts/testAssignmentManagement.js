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
import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Notification from "../models/Notification.js";
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
  console.log("=== Testing Homework & Assignment Management System ===");

  await connectTestDB();
  assertTestDatabaseIsolation();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const runId = crypto.randomBytes(4).toString("hex");

    // Clean test state
    await Assignment.deleteMany({ courseId: { $exists: true } });
    await AssignmentSubmission.deleteMany({ courseId: { $exists: true } });
    await Notification.deleteMany({ userId: { $exists: true } });

    // 1. Setup Users
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const teacher = await User.create({
      name: `Teacher ${runId}`,
      email: `teacher_hw_${runId}@eduvibe.test`,
      phone: "+919876543201",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true },
    });

    const rivalTeacher = await User.create({
      name: `Rival Teacher ${runId}`,
      email: `rival_hw_${runId}@eduvibe.test`,
      phone: "+919876543202",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true },
    });

    const student1 = await User.create({
      name: `Student 1 ${runId}`,
      email: `student1_hw_${runId}@eduvibe.test`,
      phone: "+919876543203",
      passwordHash,
      role: "student",
      isActive: true,
    });

    const student2 = await User.create({
      name: `Student 2 ${runId}`,
      email: `student2_hw_${runId}@eduvibe.test`,
      phone: "+919876543204",
      passwordHash,
      role: "student",
      isActive: true,
    });

    // 2. Setup Course with 2 Modules and 2 Lessons
    const course = await Course.create({
      title: `Assignment Masterclass ${runId}`,
      slug: `assignment-course-${runId}`,
      description: "Homework test course",
      price: 0,
      ownerId: teacher._id,
      instructor: teacher.name,
      isPublished: true,
    });

    const lessonM1 = await Lesson.create({
      courseId: course._id,
      title: "Module 1 Lesson",
      moduleName: "Module 1",
      order: 1,
      durationMinutes: 10,
      bunnyVideoId: "11111111-1111-1111-1111-111111111111",
      isPublished: true,
    });

    const lessonM2 = await Lesson.create({
      courseId: course._id,
      title: "Module 2 Lesson",
      moduleName: "Module 2",
      order: 2,
      durationMinutes: 15,
      bunnyVideoId: "22222222-2222-2222-2222-222222222222",
      isPublished: true,
    });

    // Enroll Student 1 in Course
    await Enrollment.create({
      userId: student1._id,
      courseId: course._id,
      status: "active",
      approvedAt: new Date(),
    });

    // Set default ContentAccess for Student 1 (Module 1 unlocked, Module 2 locked)
    await ContentAccess.create({
      courseId: course._id,
      scope: "student",
      userId: student1._id,
      unlockedModules: ["Module 1"],
      unlockedLessons: [lessonM1._id],
    });

    // Logins
    const teacherAuth = await loginUser(server, teacher.email, "Password123!");
    const rivalAuth = await loginUser(server, rivalTeacher.email, "Password123!");
    const student1Auth = await loginUser(server, student1.email, "Password123!");
    const student2Auth = await loginUser(server, student2.email, "Password123!"); // Not enrolled

    // --- TEST 1 to 6: Assignment Creation by Teacher ---
    console.log("-> Test 1-6: Teacher creates Course-, Module-, and Lesson-level assignments");

    // 1. Course-level assignment with Google Drive resource links
    const createRes1 = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/assignments`, method: "POST" },
      {
        title: "Course Final Project",
        description: "Submit your final term project Google Drive folder.",
        scope: "course",
        resourceLinks: [
          { title: "Project Prompt PDF", url: "https://drive.google.com/file/d/12345/view" },
          { title: "Rubric Document", url: "https://docs.google.com/document/d/abcdef/edit" },
        ],
        isEnabled: true,
      },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(createRes1.statusCode, 201);
    const courseAssignment = createRes1.json.data.assignment;
    assert.strictEqual(courseAssignment.scope, "course");
    assert.strictEqual(courseAssignment.resourceLinks.length, 2);

    // 2. Module-level assignment
    const createRes2 = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/assignments`, method: "POST" },
      {
        title: "Module 2 Capstone Assignment",
        description: "Homework associated specifically with Module 2.",
        scope: "module",
        moduleName: "Module 2",
        isEnabled: true,
      },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(createRes2.statusCode, 201);
    const module2Assignment = createRes2.json.data.assignment;

    // 3. Lesson-level assignment (Lesson 1)
    const createRes3 = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/assignments`, method: "POST" },
      {
        title: "Lesson 1 Exercise",
        description: "Homework after watching Lesson 1 video.",
        scope: "lesson",
        moduleName: "Module 1",
        lessonId: lessonM1._id.toString(),
        isEnabled: true,
      },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(createRes3.statusCode, 201);
    const lesson1Assignment = createRes3.json.data.assignment;

    // 4. Unauthorized teacher cannot create assignment in another's course
    const rivalCreateRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/assignments`, method: "POST" },
      { title: "Hacked Assignment", description: "Malicious", scope: "course" },
      rivalAuth.cookie,
      rivalAuth.csrfToken
    );
    assert.strictEqual(rivalCreateRes.statusCode, 403, "Rival teacher must be rejected");

    // --- TEST 7 to 15: Google Drive Resource Validation ---
    console.log("-> Test 7-15: Google Drive URL format verification and lookalike rejection");
    const badUrlRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/assignments`, method: "POST" },
      {
        title: "Phishing Test",
        description: "Bad links",
        scope: "course",
        resourceLinks: [{ title: "Fake Drive", url: "https://drive.google.com.malicious.net/file" }],
      },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(badUrlRes.statusCode, 400, "Lookalike domain must be rejected");

    const nonHttpsRes = await httpRequest(
      server,
      { path: `/api/teacher/courses/${course._id}/assignments`, method: "POST" },
      {
        title: "HTTP Test",
        description: "Insecure links",
        scope: "course",
        resourceLinks: [{ title: "Insecure Link", url: "http://drive.google.com/file/d/123" }],
      },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(nonHttpsRes.statusCode, 400, "Non-HTTPS must be rejected");

    // --- TEST 16 to 22: Enable / Disable Controls ---
    console.log("-> Test 16-22: Enable and Disable assignment controls");
    // Disable lesson1Assignment
    const disableRes = await httpRequest(
      server,
      { path: `/api/teacher/assignments/${lesson1Assignment.id}/status`, method: "PATCH" },
      { isEnabled: false },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(disableRes.statusCode, 200);
    assert.strictEqual(disableRes.json.data.isEnabled, false);

    // Disabled assignment is hidden from student list
    const s1ListDisabled = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/assignments`, method: "GET" },
      null,
      student1Auth.cookie
    );
    const listedIds = s1ListDisabled.json.data.assignments.map((a) => a.id);
    assert.ok(!listedIds.includes(lesson1Assignment.id), "Disabled assignment must not appear in student list");

    // Disabled assignment cannot be fetched directly by student
    const s1GetDisabled = await httpRequest(
      server,
      { path: `/api/student/assignments/${lesson1Assignment.id}`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(s1GetDisabled.statusCode, 404, "Student cannot directly fetch disabled assignment");

    // Disabled assignment rejects student submission
    const s1SubmitDisabled = await httpRequest(
      server,
      { path: `/api/student/assignments/${lesson1Assignment.id}/submissions`, method: "POST" },
      { textAnswer: "My solution" },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(s1SubmitDisabled.statusCode, 404, "Submission to disabled assignment must be rejected");

    // Re-enable lesson1Assignment
    await httpRequest(
      server,
      { path: `/api/teacher/assignments/${lesson1Assignment.id}/status`, method: "PATCH" },
      { isEnabled: true },
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );

    // --- TEST 23 to 30: Student Submissions ---
    console.log("-> Test 23-30: Student submission validation and execution");

    // Non-enrolled student (Student 2) rejected
    const s2SubmitRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${courseAssignment.id}/submissions`, method: "POST" },
      { textAnswer: "Unenrolled answer" },
      student2Auth.cookie,
      student2Auth.csrfToken
    );
    assert.strictEqual(s2SubmitRes.statusCode, 403, "Non-enrolled student must be rejected");

    // Empty submission rejected
    const emptySubRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${courseAssignment.id}/submissions`, method: "POST" },
      { textAnswer: "   ", driveLinks: [] },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(emptySubRes.statusCode, 400, "Empty submission must be rejected");

    // Student 1 submits Course Assignment with Google Drive link and written text
    const s1SubRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${courseAssignment.id}/submissions`, method: "POST" },
      {
        textAnswer: "Here is my final project solution and analysis.",
        driveLinks: [
          { title: "My Solution Folder", url: "https://drive.google.com/drive/folders/my-folder-id" },
        ],
      },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(s1SubRes.statusCode, 201, `Submit status: ${JSON.stringify(s1SubRes.json)}`);
    assert.strictEqual(s1SubRes.json.data.submission.version, 1);
    assert.strictEqual(s1SubRes.json.data.submission.status, "submitted");

    // Verify In-App Notification dispatched to teacher
    const teacherNotifs = await Notification.find({ userId: teacher._id }).sort({ createdAt: -1 });
    assert.ok(teacherNotifs.length > 0, "Teacher should receive in-app notification");
    assert.strictEqual(teacherNotifs[0].type, "assignment_submitted");

    // --- TEST 31 to 37: Resubmission Rules and History ---
    console.log("-> Test 31-37: Resubmission creates Version 2 without deleting Version 1");
    const s1ResubRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${courseAssignment.id}/submissions`, method: "POST" },
      {
        textAnswer: "Updated solution with extra derivations.",
        driveLinks: [
          { title: "Updated Drive Folder", url: "https://drive.google.com/drive/folders/my-folder-v2" },
        ],
      },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(s1ResubRes.statusCode, 201);
    assert.strictEqual(s1ResubRes.json.data.submission.version, 2);

    // Verify history contains both versions 1 and 2
    const s1HistoryRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${courseAssignment.id}`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(s1HistoryRes.statusCode, 200);
    assert.strictEqual(s1HistoryRes.json.data.submissions.length, 2);
    assert.strictEqual(s1HistoryRes.json.data.submissions[0].version, 2);
    assert.strictEqual(s1HistoryRes.json.data.submissions[1].version, 1);

    // --- TEST 38 to 43: Teacher Review ---
    console.log("-> Test 38-43: Teacher reviews submission and locks student resubmission");
    const rosterRes = await httpRequest(
      server,
      { path: `/api/teacher/assignments/${courseAssignment.id}/submissions`, method: "GET" },
      null,
      teacherAuth.cookie
    );
    assert.strictEqual(rosterRes.statusCode, 200);
    const s1RosterItem = rosterRes.json.data.roster.find((r) => r.student.id === student1._id.toString());
    assert.ok(s1RosterItem);
    assert.strictEqual(s1RosterItem.hasSubmitted, true);
    assert.strictEqual(s1RosterItem.latestSubmission.version, 2);

    const submissionV2Id = s1RosterItem.latestSubmission.id;

    // Unauthorized teacher cannot review
    const rivalReviewRes = await httpRequest(
      server,
      { path: `/api/teacher/assignments/${courseAssignment.id}/submissions/${submissionV2Id}/review`, method: "PATCH" },
      {},
      rivalAuth.cookie,
      rivalAuth.csrfToken
    );
    assert.strictEqual(rivalReviewRes.statusCode, 403, "Rival teacher cannot review");

    // Teacher reviews submission
    const reviewRes = await httpRequest(
      server,
      { path: `/api/teacher/assignments/${courseAssignment.id}/submissions/${submissionV2Id}/review`, method: "PATCH" },
      {},
      teacherAuth.cookie,
      teacherAuth.csrfToken
    );
    assert.strictEqual(reviewRes.statusCode, 200);
    assert.strictEqual(reviewRes.json.data.submission.status, "reviewed");

    // Student notified of review
    const studentNotifs = await Notification.find({ userId: student1._id, type: "assignment_reviewed" });
    assert.ok(studentNotifs.length > 0, "Student must receive review notification");

    // Student now BLOCKED from resubmitting
    const s1BlockedResub = await httpRequest(
      server,
      { path: `/api/student/assignments/${courseAssignment.id}/submissions`, method: "POST" },
      { textAnswer: "Try to resubmit after reviewed" },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(s1BlockedResub.statusCode, 403, "Resubmission after Reviewed must be rejected");
    assert.strictEqual(s1BlockedResub.json.code, "SUBMISSION_LOCKED");

    // --- TEST 44 to 50: Content Access & Unlocking Integration ---
    console.log("-> Test 44-50: Content Access & Unlocking integration with assignments");

    // Module 2 is currently locked for Student 1:
    // Module 2 Assignment must NOT be in student list
    const s1CurriculumAssignments = await httpRequest(
      server,
      { path: `/api/student/courses/${course._id}/assignments`, method: "GET" },
      null,
      student1Auth.cookie
    );
    const visibleIds = s1CurriculumAssignments.json.data.assignments.map((a) => a.id);
    assert.ok(!visibleIds.includes(module2Assignment.id), "Module 2 assignment must be hidden while module is locked");

    // Direct access to locked assignment rejected
    const directLockedRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${module2Assignment.id}`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(directLockedRes.statusCode, 403, "Direct access to locked module assignment must be 403");
    assert.strictEqual(directLockedRes.json.code, "MODULE_LOCKED");

    // Direct submission to locked assignment rejected
    const submitLockedRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${module2Assignment.id}/submissions`, method: "POST" },
      { textAnswer: "Trying to submit to locked module" },
      student1Auth.cookie,
      student1Auth.csrfToken
    );
    assert.strictEqual(submitLockedRes.statusCode, 403, "Submission to locked content must be 403");
    assert.strictEqual(submitLockedRes.json.code, "MODULE_LOCKED");

    // Now Teacher unlocks Module 2 for Student 1
    await ContentAccess.updateOne(
      { courseId: course._id, scope: "student", userId: student1._id },
      { $addToSet: { unlockedModules: "Module 2", unlockedLessons: lessonM2._id } }
    );

    // Module 2 assignment is now accessible!
    const directUnlockedRes = await httpRequest(
      server,
      { path: `/api/student/assignments/${module2Assignment.id}`, method: "GET" },
      null,
      student1Auth.cookie
    );
    assert.strictEqual(directUnlockedRes.statusCode, 200, "Assignment accessible after module unlocked");

    console.log("✅ All Homework & Assignment Management System tests passed successfully!");
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
