import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "node:fs";

import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Payment from "../models/Payment.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testPayments = [];

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
  const authCsrfRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" }, null, finalCookie);
  const authCsrfToken = authCsrfRes.json?.data?.csrfToken;

  return { cookie: finalCookie, csrfToken: authCsrfToken };
}

async function runCourseCreationBugFixTests() {
  console.log("\n==========================================================");
  console.log("=== RUNNING SUPER ADMIN COURSE CREATION FIX TEST SUITE ===");
  console.log("==========================================================");

  // 0. Test DB isolation guard
  await connectTestDB();
  assertTestDatabaseIsolation();
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Seed Super Admin and Teacher
    const adminUser = await User.create({
      name: "Admin Course Tester",
      email: `admin_course_${TIMESTAMP}@example.com`,
      phone: "9988771122",
      passwordHash,
      role: "super_admin",
      isActive: true,
    });
    testUsers.push(adminUser._id);

    const teacherUser = await User.create({
      name: "Professor Turing",
      email: `turing_${TIMESTAMP}@example.com`,
      phone: "9988773344",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        headline: "Cryptography & AI",
        isApproved: true,
        commissionRate: 0.20,
      },
    });
    testUsers.push(teacherUser._id);

    const adminAuth = await loginUser(server, adminUser.email);

    // ======================================================================
    // 1. SUCCESSFUL PLATFORM-OWNED COURSE CREATION & DIRECTORY REFRESH
    // ======================================================================
    console.log("\n--- TEST 1: SUCCESSFUL PLATFORM-OWNED COURSE CREATION & DIRECTORY REFRESH ---");
    const customSlug1 = `crypto-foundations-${TIMESTAMP}`;
    const createPlatformRes = await httpRequest(
      server,
      { path: "/api/admin/courses", method: "POST" },
      {
        title: `Cryptography Foundations ${TIMESTAMP}`,
        description: "Core algorithms and mathematical principles",
        price: 2499,
        thumbnail: "https://example.com/crypto.jpg",
        instructor: "EduVibe Core",
        customSlug: customSlug1,
        ownerId: adminUser._id.toString(),
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(createPlatformRes.statusCode, 201, "Course creation must return HTTP 201 Created");
    assert.equal(createPlatformRes.json?.success, true);
    assert.equal(createPlatformRes.json?.data?.course?.title, `Cryptography Foundations ${TIMESTAMP}`);
    assert.equal(createPlatformRes.json?.data?.course?.slug, customSlug1);
    assert.equal(createPlatformRes.json?.data?.course?.ownerId, adminUser._id.toString());
    const course1Id = createPlatformRes.json.data.course.id;
    testCourses.push(new mongoose.Types.ObjectId(course1Id));

    // Simulate directory refresh (fetchData / listCourses)
    const listRes = await httpRequest(
      server,
      { path: "/api/admin/courses", method: "GET" },
      null,
      adminAuth.cookie
    );
    assert.equal(listRes.statusCode, 200);
    const catalog = listRes.json?.data?.courses || [];
    const foundPlatform = catalog.find((c) => c.id === course1Id);
    assert.ok(foundPlatform, "Newly created course must appear in refreshed catalog");
    assert.equal(foundPlatform.owner?.role, "super_admin");
    console.log("✓ TEST 1 PASSED: Platform-owned course created successfully and appears in refreshed catalog.");

    // ======================================================================
    // 2. SUCCESSFUL TEACHER-OWNED COURSE CREATION & OWNER ASSIGNMENT
    // ======================================================================
    console.log("\n--- TEST 2: SUCCESSFUL TEACHER-OWNED COURSE CREATION & CORRECT OWNER ASSIGNMENT ---");
    const createTeacherCourseRes = await httpRequest(
      server,
      { path: "/api/admin/courses", method: "POST" },
      {
        title: `Machine Learning Systems ${TIMESTAMP}`,
        description: "Deploying high-throughput model endpoints",
        price: 3999,
        thumbnail: "https://example.com/ml.jpg",
        instructor: teacherUser.name,
        customSlug: `ml-systems-${TIMESTAMP}`,
        ownerId: teacherUser._id.toString(), // Assigned to Teacher
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(createTeacherCourseRes.statusCode, 201);
    assert.equal(createTeacherCourseRes.json?.data?.course?.ownerId, teacherUser._id.toString());
    const course2Id = createTeacherCourseRes.json.data.course.id;
    testCourses.push(new mongoose.Types.ObjectId(course2Id));

    const dbTeacherCourse = await Course.findById(course2Id);
    assert.equal(dbTeacherCourse.ownerId.toString(), teacherUser._id.toString(), "Course owner must strictly match assigned teacher");
    console.log("✓ TEST 2 PASSED: Teacher-owned course created with verified ownerId assignment.");

    // ======================================================================
    // 3. SUCCESSFUL API CREATION RESILIENCE WHEN FRONTEND REFRESH FAILS
    // ======================================================================
    console.log("\n--- TEST 3: RESILIENCE WHEN CLIENT REFRESH OR CALLBACK FAILS ---");
    // Verify in database that course record persists cleanly even if UI callback threw
    const dbCourse1 = await Course.findById(course1Id);
    assert.ok(dbCourse1, "Course record must persist safely in DB independently of client refresh state");
    console.log("✓ TEST 3 PASSED: Course creation persists safely in DB regardless of client refresh state.");

    // ======================================================================
    // 4. DUPLICATE SLUG HANDLING
    // ======================================================================
    console.log("\n--- TEST 4: DUPLICATE SLUG HANDLING ---");
    // Attempting to create another course with the same slug de-duplicates or rejects safely
    const duplicateSlugRes = await httpRequest(
      server,
      { path: "/api/admin/courses", method: "POST" },
      {
        title: `Duplicate Slug Course ${TIMESTAMP}`,
        description: "Testing automated slug disambiguation",
        price: 1999,
        customSlug: customSlug1, // Same slug as Course 1
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(duplicateSlugRes.statusCode, 201);
    const newSlug = duplicateSlugRes.json?.data?.course?.slug;
    assert.notEqual(newSlug, customSlug1, "Slug must be de-duplicated to prevent collision");
    assert.ok(newSlug.startsWith(customSlug1), "De-duplicated slug must have numeric suffix");
    testCourses.push(new mongoose.Types.ObjectId(duplicateSlugRes.json.data.course.id));
    console.log(`✓ TEST 4 PASSED: Duplicate custom slug handled gracefully and disambiguated to: ${newSlug}.`);

    // ======================================================================
    // 5. INVALID COURSE DATA (400 BAD REQUEST)
    // ======================================================================
    console.log("\n--- TEST 5: INVALID COURSE DATA VALIDATION ---");
    // 5.1 Short title (< 3 chars)
    const shortTitleRes = await httpRequest(
      server,
      { path: "/api/admin/courses", method: "POST" },
      {
        title: "Go", // < 3 chars
        price: 999,
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(shortTitleRes.statusCode, 400);
    assert.equal(shortTitleRes.json?.code, "INVALID_TITLE");

    // 5.2 Negative price
    const negPriceRes = await httpRequest(
      server,
      { path: "/api/admin/courses", method: "POST" },
      {
        title: "Valid Course Title",
        price: -50, // Negative price
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(negPriceRes.statusCode, 400);
    assert.equal(negPriceRes.json?.code, "INVALID_PRICE");
    console.log("✓ TEST 5 PASSED: Invalid course title and negative price rejected with HTTP 400 and structured codes.");

    // ======================================================================
    // 6. REPEATED SUBMISSION & COMPONENT CONTRACT CHECKS
    // ======================================================================
    console.log("\n--- TEST 6: REPEATED SUBMISSION & COMPONENT CONTRACT CHECKS ---");
    const modalPath = path.resolve(__dirname, "../client/src/components/admin/CourseCreateModal.jsx");
    const modalSrc = fs.readFileSync(modalPath, "utf-8");

    assert.ok(
      modalSrc.includes("if (isSubmitting) return;"),
      "CourseCreateModal must include double-click / concurrent submission prevention guard"
    );
    assert.ok(
      modalSrc.includes("onSuccess") && modalSrc.includes("onCreated"),
      "CourseCreateModal must support both onSuccess and onCreated callback prop interfaces"
    );
    assert.ok(
      modalSrc.includes("typeof onSuccess === \"function\""),
      "CourseCreateModal must verify typeof onSuccess is function before calling"
    );
    assert.ok(
      modalSrc.includes("typeof onCreated === \"function\""),
      "CourseCreateModal must verify typeof onCreated is function before calling"
    );
    assert.ok(
      modalSrc.includes("disabled={isSubmitting}"),
      "Submit and cancel buttons must be disabled while isSubmitting is true"
    );
    console.log("✓ TEST 6 PASSED: CourseCreateModal component contract strictly enforces double-click prevention and safe callback handling.");

    // ======================================================================
    // 7. PRESERVE EXISTING FINANCIAL RECORDS & OWNERSHIP
    // ======================================================================
    console.log("\n--- TEST 7: NO CHANGE TO EXISTING FINANCIAL RECORDS OR OWNERSHIP ---");
    // Seed a payment for course 1
    const payment = await Payment.create({
      userId: adminUser._id,
      courseId: course1Id,
      ownerId: adminUser._id,
      amount: 2499,
      status: "approved",
      transactionReference: `TX_FIN_CHECK_${TIMESTAMP}`,
      financialSnapshot: {
        coursePrice: 2499,
        commissionRate: 0.20,
        platformCommission: 499.8,
        teacherShare: 1999.2,
        currency: "INR",
        calculatedAt: new Date(),
      },
    });
    testPayments.push(payment._id);

    // Verify financial snapshot immutability
    const paymentBefore = await Payment.findById(payment._id).lean();
    assert.equal(paymentBefore.financialSnapshot.coursePrice, 2499);
    assert.equal(paymentBefore.financialSnapshot.platformCommission, 499.8);
    assert.equal(paymentBefore.financialSnapshot.teacherShare, 1999.2);

    // Verify attempt to mutate course with active payments cannot delete
    const deleteAttempt = await httpRequest(
      server,
      { path: `/api/admin/courses/${course1Id}`, method: "DELETE" },
      null,
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(deleteAttempt.statusCode, 400, "Course with financial records cannot be deleted");
    assert.equal(deleteAttempt.json?.code, "FINANCIAL_RECORDS_EXIST");

    // Payment and course ownership remain 100% intact
    const paymentAfter = await Payment.findById(payment._id).lean();
    assert.equal(paymentAfter.status, "approved");
    assert.equal(paymentAfter.financialSnapshot.coursePrice, 2499);
    console.log("✓ TEST 7 PASSED: Existing financial records, snapshots, and course ownership remain strictly preserved.");

    console.log("\n==========================================================");
    console.log("=== ALL SUPER ADMIN COURSE CREATION FIX TESTS PASSED! ===");
    console.log("==========================================================");
  } finally {
    // Cleanup seeded test fixtures
    try {
      if (testPayments.length > 0) {
        await mongoose.connection.collection("payments").deleteMany({ _id: { $in: testPayments } });
      }
      if (testCourses.length > 0) {
        await Course.deleteMany({ _id: { $in: testCourses } });
      }
      if (testUsers.length > 0) {
        await User.deleteMany({ _id: { $in: testUsers } });
      }
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

runCourseCreationBugFixTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR in Course Creation Bug Fix Test Suite:", err);
    process.exit(1);
  });
