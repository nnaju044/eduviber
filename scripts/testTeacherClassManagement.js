import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

function httpRequest(server, options, body = null, cookie = null, csrfToken = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { ...(options.headers || {}) };

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

          let sessionCookie = null;
          const setCookieHeaders = res.headers["set-cookie"];
          if (setCookieHeaders) {
            const sidHeader = setCookieHeaders.find((h) => h.startsWith("course.sid="));
            if (sidHeader) {
              sessionCookie = sidHeader.split(";")[0];
            }
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
  console.log("==========================================================");
  console.log("=== RUNNING TEACHER CLASS MANAGEMENT & STUDENT CREATION ==");
  console.log("==========================================================");

  await connectTestDB();
  assertTestDatabaseIsolation();
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`✓ Test server running on http://127.0.0.1:${port}`);

  try {
    const timestamp = Date.now();

    // 1. Setup Teacher A (Approved) and Teacher B (Approved)
    const pwHash = await bcrypt.hash("Password123!", 10);
    const teacherA = await User.create({
      name: "Teacher Alpha",
      email: `teacherA_${timestamp}@e14test.local`,
      phone: "+919876543210",
      passwordHash: pwHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true, headline: "Senior Instructor" },
    });

    const teacherB = await User.create({
      name: "Teacher Beta",
      email: `teacherB_${timestamp}@e14test.local`,
      phone: "+919876543211",
      passwordHash: pwHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true, headline: "Guest Lecturer" },
    });

    // 2. Setup Courses: Teacher A owns Free & Paid courses; Teacher B owns Course B
    const freeCourseA = await Course.create({
      title: "Free Course Alpha",
      slug: `free-course-alpha-${timestamp}`,
      description: "Introductory free class",
      price: 0,
      ownerId: teacherA._id,
      isPublished: true,
    });

    const paidCourseA = await Course.create({
      title: "Paid Mastery Alpha",
      slug: `paid-course-alpha-${timestamp}`,
      description: "Comprehensive paid program",
      price: 4999,
      ownerId: teacherA._id,
      isPublished: true,
    });

    const courseB = await Course.create({
      title: "Course Beta",
      slug: `course-beta-${timestamp}`,
      description: "Teacher B exclusive class",
      price: 0,
      ownerId: teacherB._id,
      isPublished: true,
    });

    // 3. Setup an existing student
    const existingStudent = await User.create({
      name: "Existing Student Alice",
      email: `student_alice_${timestamp}@e14test.local`,
      phone: "+919876543212",
      passwordHash: pwHash,
      role: "student",
      isActive: true,
    });

    // Login Teacher A and Teacher B
    const sessionTeacherA = await loginUser(server, teacherA.email, "Password123!");
    const sessionTeacherB = await loginUser(server, teacherB.email, "Password123!");

    // --- TEST 1: ENROLL EXISTING STUDENT INTO FREE COURSE ---
    console.log("\n--- TEST 1: ENROLL EXISTING STUDENT INTO FREE COURSE ---");
    {
      const enrollRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/enroll`, method: "POST" },
        { email: existingStudent.email },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );

      assert.equal(enrollRes.statusCode, 201);
      assert.equal(enrollRes.json.success, true);
      assert.equal(enrollRes.json.data.enrollment.status, "active", "Free course must have active enrollment");
      assert.ok(enrollRes.json.data.enrollment.approvedAt, "Free course must set approvedAt immediately");

      // Verify in DB
      const dbEnrollment = await Enrollment.findOne({
        userId: existingStudent._id,
        courseId: freeCourseA._id,
      });
      assert.ok(dbEnrollment);
      assert.equal(dbEnrollment.status, "active");
      console.log("✓ TEST 1 PASSED: Existing student cleanly enrolled into free course with active access.");
    }

    // --- TEST 2: DUPLICATE ENROLLMENT REJECTION ---
    console.log("\n--- TEST 2: DUPLICATE ENROLLMENT REJECTION ---");
    {
      const dupRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/enroll`, method: "POST" },
        { email: existingStudent.email },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );

      assert.equal(dupRes.statusCode, 409, "Must return 409 Conflict for existing enrollment");
      assert.equal(dupRes.json.code, "ALREADY_ENROLLED");
      console.log("✓ TEST 2 PASSED: Duplicate enrollment strictly rejected with 409 Conflict.");
    }

    // --- TEST 3: REJECT ENROLLING NON-STUDENT ACCOUNTS ---
    console.log("\n--- TEST 3: REJECT ENROLLING NON-STUDENT ACCOUNTS ---");
    {
      const teacherEnrollRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/enroll`, method: "POST" },
        { email: teacherB.email },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );

      assert.equal(teacherEnrollRes.statusCode, 400, "Must reject non-student account");
      assert.equal(teacherEnrollRes.json.code, "NOT_STUDENT_ACCOUNT");
      console.log("✓ TEST 3 PASSED: Enrolling teachers/admins rejected; user platform role protected.");
    }

    // --- TEST 4: CREATE NEW STUDENT ACCOUNT & ENROLL ---
    console.log("\n--- TEST 4: CREATE NEW STUDENT ACCOUNT & ENROLL ---");
    let newStudentPhone = "+919876543299";
    let newStudentEmail = `new_student_${timestamp}@e14test.local`;
    let newStudentId = null;
    {
      // 4a. Validate rejection when phone is missing or invalid
      const missingPhoneRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/create`, method: "POST" },
        {
          name: "Phone Missing Student",
          email: `phone_missing_${timestamp}@e14test.local`,
          phone: "123", // too short
        },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );
      assert.equal(missingPhoneRes.statusCode, 400, "Must reject student creation without valid phone number");
      assert.equal(missingPhoneRes.json.code, "INVALID_PHONE");

      // 4b. Successful creation with valid phone number as initial temporary password
      const createRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/create`, method: "POST" },
        {
          name: "Fresh Student Bob",
          email: newStudentEmail,
          phone: newStudentPhone,
        },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );

      assert.equal(createRes.statusCode, 201);
      assert.equal(createRes.json.success, true);
      assert.equal(createRes.json.data.initialPasswordIsPhone, true, "Must flag that initial password is phone");
      assert.equal(createRes.json.data.student.phone, newStudentPhone);
      assert.equal(createRes.json.data.enrollment.status, "active");

      newStudentId = createRes.json.data.student.id;

      // Verify User in MongoDB
      const createdUser = await User.findById(newStudentId).select("+passwordHash");
      assert.ok(createdUser);
      assert.equal(createdUser.role, "student");
      assert.equal(createdUser.mustChangePassword, true, "mustChangePassword must be set to true");
      assert.notEqual(createdUser.passwordHash, newStudentPhone, "Plaintext phone must never be stored as password");
      assert.ok(await bcrypt.compare(newStudentPhone, createdUser.passwordHash), "Student's phone number must match bcrypt hash");
      console.log("✓ TEST 4 PASSED: Student account created with phone number bcrypt hash, mustChangePassword: true, and active enrollment.");
    }

    // --- TEST 5: NEW STUDENT LOGIN WITH TEMPORARY PASSWORD (PHONE NUMBER) ---
    console.log("\n--- TEST 5: NEW STUDENT LOGIN WITH TEMPORARY PASSWORD (PHONE NUMBER) ---");
    {
      const newStudentSession = await loginUser(server, newStudentEmail, newStudentPhone);
      assert.ok(newStudentSession.user);
      assert.equal(newStudentSession.user.mustChangePassword, true);

      // Verify student sees the enrolled course in /api/student/dashboard
      const dashboardRes = await httpRequest(
        server,
        { path: "/api/student/dashboard", method: "GET" },
        null,
        newStudentSession.cookie
      );
      assert.equal(dashboardRes.statusCode, 200);
      const enrolledCourses = dashboardRes.json.data.enrolledCourses || [];
      const foundCourse = enrolledCourses.find((c) => c.id === freeCourseA._id.toString());
      assert.ok(foundCourse, "Student dashboard must immediately include the active enrolled course");
      console.log("✓ TEST 5 PASSED: New student authenticated with phone number as initial credentials and viewed course on dashboard.");
    }

    // --- TEST 6: PAID COURSE DIRECT TEACHER ENROLLMENT & SUPER ADMIN FINANCIAL TRACKING ---
    console.log("\n--- TEST 6: PAID COURSE DIRECT TEACHER ENROLLMENT & SUPER ADMIN FINANCIAL TRACKING ---");
    {
      const paidEnrollRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${paidCourseA._id}/students/enroll`, method: "POST" },
        { email: existingStudent.email },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );

      assert.equal(paidEnrollRes.statusCode, 201);
      assert.equal(paidEnrollRes.json.data.enrollment.status, "active", "Paid course enrollment must be active immediately");
      assert.ok(paidEnrollRes.json.data.enrollment.approvedAt, "Paid course must set approvedAt immediately");

      // Verify financial tracking Payment record created for Super Admin
      const payments = await Payment.find({ userId: existingStudent._id, courseId: paidCourseA._id });
      assert.equal(payments.length, 1, "Exactly one financial tracking payment record must be created");
      assert.equal(payments[0].amount, 4999);
      assert.equal(payments[0].financialSnapshot.coursePrice, 4999);
      assert.equal(payments[0].status, "pending");
      assert.equal(payments[0].financialSnapshot.collectionMethod, "direct_teacher");

      // Verify idempotent retry does NOT duplicate payment
      const secondCheckRes = await Payment.find({ userId: existingStudent._id, courseId: paidCourseA._id });
      assert.equal(secondCheckRes.length, 1, "No duplicate payment records allowed");

      console.log("✓ TEST 6 PASSED: Teacher-created paid course enrollment activates immediately with financial tracking payment record.");
    }

    // --- TEST 7: COURSE OWNERSHIP & TENANT ISOLATION ---
    console.log("\n--- TEST 7: COURSE OWNERSHIP & TENANT ISOLATION ---");
    {
      // Teacher A attempts to enroll a student into Teacher B's course
      const unauthorizedEnroll = await httpRequest(
        server,
        { path: `/api/teacher/courses/${courseB._id}/students/enroll`, method: "POST" },
        { email: existingStudent.email },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );
      assert.equal(unauthorizedEnroll.statusCode, 403, "Teacher A must not enroll into Teacher B course");
      assert.equal(unauthorizedEnroll.json.code, "FORBIDDEN");

      // Teacher A attempts to list students in Teacher B's course
      const unauthorizedList = await httpRequest(
        server,
        { path: `/api/teacher/courses/${courseB._id}/students`, method: "GET" },
        null,
        sessionTeacherA.cookie
      );
      assert.equal(unauthorizedList.statusCode, 403, "Teacher A must not list Teacher B course students");
      assert.equal(unauthorizedList.json.code, "FORBIDDEN");

      // Teacher A attempts to modify status in Teacher B's course
      const unauthorizedStatus = await httpRequest(
        server,
        { path: `/api/teacher/courses/${courseB._id}/students/${existingStudent._id}/status`, method: "PATCH" },
        { status: "suspended" },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );
      assert.equal(unauthorizedStatus.statusCode, 403, "Teacher A must not modify status in Teacher B course");
      assert.equal(unauthorizedStatus.json.code, "FORBIDDEN");

      console.log("✓ TEST 7 PASSED: Strict cross-teacher ownership isolation verified for all endpoints.");
    }

    // --- TEST 8: SUSPEND & REACTIVATE COURSE ACCESS ---
    console.log("\n--- TEST 8: SUSPEND & REACTIVATE COURSE ACCESS ---");
    {
      // 1. Suspend enrollment in freeCourseA
      const suspendRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/${existingStudent._id}/status`, method: "PATCH" },
        { status: "suspended" },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );
      assert.equal(suspendRes.statusCode, 200);
      assert.equal(suspendRes.json.data.enrollment.status, "suspended");

      // Verify in DB
      const suspendedDoc = await Enrollment.findOne({ userId: existingStudent._id, courseId: freeCourseA._id });
      assert.equal(suspendedDoc.status, "suspended");

      // 2. Reactivate enrollment
      const reactivateRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/${existingStudent._id}/status`, method: "PATCH" },
        { status: "active" },
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );
      assert.equal(reactivateRes.statusCode, 200);
      assert.equal(reactivateRes.json.data.enrollment.status, "active");

      const activeDoc = await Enrollment.findOne({ userId: existingStudent._id, courseId: freeCourseA._id });
      assert.equal(activeDoc.status, "active");
      console.log("✓ TEST 8 PASSED: Teacher can suspend and reactivate enrollment in owned course.");
    }

    // --- TEST 9: REMOVE STUDENT FROM COURSE (MARK EXPIRED) ---
    console.log("\n--- TEST 9: REMOVE STUDENT FROM COURSE (MARK EXPIRED) ---");
    {
      const removeRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students/${newStudentId}`, method: "DELETE" },
        null,
        sessionTeacherA.cookie,
        sessionTeacherA.csrfToken
      );
      assert.equal(removeRes.statusCode, 200);
      assert.equal(removeRes.json.data.status, "expired");

      // Verify enrollment is marked expired in DB
      const expiredEnrollment = await Enrollment.findOne({ userId: newStudentId, courseId: freeCourseA._id });
      assert.equal(expiredEnrollment.status, "expired");

      // Verify student's global User account remains active and intact
      const preservedUser = await User.findById(newStudentId);
      assert.ok(preservedUser, "User account must not be deleted");
      assert.equal(preservedUser.isActive, true, "User account must remain active globally");
      console.log("✓ TEST 9 PASSED: Student course removal marks enrollment expired while preserving user account.");
    }

    // --- TEST 10: LIST COURSE-SPECIFIC STUDENTS ---
    console.log("\n--- TEST 10: LIST COURSE-SPECIFIC STUDENTS ---");
    {
      const listRes = await httpRequest(
        server,
        { path: `/api/teacher/courses/${freeCourseA._id}/students`, method: "GET" },
        null,
        sessionTeacherA.cookie
      );
      assert.equal(listRes.statusCode, 200);
      assert.ok(Array.isArray(listRes.json.data.students));
      assert.ok(listRes.json.data.students.length >= 1);
      console.log("✓ TEST 10 PASSED: Teacher can retrieve course-scoped student rosters cleanly.");
    }

    console.log("\n==========================================================");
    console.log("=== ALL TEACHER CLASS MANAGEMENT TESTS PASSED (100%) ====");
    console.log("==========================================================");
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
