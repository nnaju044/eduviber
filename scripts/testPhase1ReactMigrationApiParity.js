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
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

function httpRequest(server, options, body = null, cookie = null, csrfToken = null, rawBuffer = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = {
      "User-Agent": "Mozilla/5.0 (EduViber-API-Parity-Test)",
      "x-skip-rate-limit": "true",
      ...(options.headers || {}),
    };

    if (cookie) headers["Cookie"] = cookie;
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    let payload = rawBuffer || null;
    if (!payload && body) {
      if (typeof body === "string") {
        payload = Buffer.from(body);
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
      } else {
        headers["Content-Type"] = "application/json";
        payload = Buffer.from(JSON.stringify(body));
      }
      headers["Content-Length"] = payload.length;
    } else if (payload) {
      headers["Content-Length"] = payload.length;
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

async function getCsrf(server, cookie = null) {
  const res = await httpRequest(server, { path: "/api/csrf-token", method: "GET" }, null, cookie);
  return {
    csrfToken: res.json?.data?.csrfToken || "",
    cookie: res.cookie,
  };
}

async function loginUser(server, email, password) {
  const { csrfToken, cookie } = await getCsrf(server);
  const loginRes = await httpRequest(
    server,
    { path: "/api/auth/login", method: "POST" },
    { email, password },
    cookie,
    csrfToken
  );
  return {
    statusCode: loginRes.statusCode,
    json: loginRes.json,
    cookie: loginRes.cookie,
    csrfToken: loginRes.json?.data?.csrfToken || csrfToken,
  };
}

async function runTests() {
  console.log("=== Testing Phase 1: React Migration API Parity ===");
  await connectTestDB();
  assertTestDatabaseIsolation();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const runId = Date.now();

    // Seed test users & courses
    const initialPassword = "Password123456!";
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const studentUser = await User.create({
      name: "API Parity Student",
      email: `student_parity_${runId}@eduviber.test`,
      phone: "9876543210",
      passwordHash,
      role: "student",
      isActive: true,
    });

    const teacherUser = await User.create({
      name: "API Parity Teacher",
      email: `teacher_parity_${runId}@eduviber.test`,
      phone: "9876543211",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        headline: "Master Instructor",
        bio: "Veteran digital educator.",
      },
    });

    // Seed published course with modules and lessons
    const publishedCourse = await Course.create({
      title: "Parity Published Course",
      slug: `parity-course-${runId}`,
      description: "Comprehensive public curriculum for testing.",
      price: 2499,
      thumbnail: "https://example.com/thumb.jpg",
      instructor: teacherUser.name,
      ownerId: teacherUser._id,
      isPublished: true,
    });

    // Seed unpublished course
    const unpublishedCourse = await Course.create({
      title: "Parity Unpublished Draft",
      slug: `parity-draft-${runId}`,
      description: "Draft course that should never be public.",
      price: 4999,
      ownerId: teacherUser._id,
      isPublished: false,
    });

    // Seed lessons for published course
    await Lesson.create([
      {
        courseId: publishedCourse._id,
        title: "Introduction to React",
        moduleName: "Module 1: Foundations",
        order: 1,
        durationMinutes: 15,
        durationSeconds: 900,
        isFreePreview: true,
        bunnyVideoId: "11111111-2222-3333-4444-555555555555",
        isPublished: true,
      },
      {
        courseId: publishedCourse._id,
        title: "Advanced Hooks Deep Dive",
        moduleName: "Module 1: Foundations",
        order: 2,
        durationMinutes: 25,
        durationSeconds: 1500,
        isFreePreview: false,
        bunnyVideoId: "22222222-3333-4444-5555-666666666666",
        isPublished: true,
      },
      {
        courseId: publishedCourse._id,
        title: "Serverless Deployment Mastery",
        moduleName: "Module 2: Production",
        order: 3,
        durationMinutes: 30,
        durationSeconds: 1800,
        isFreePreview: false,
        bunnyVideoId: "33333333-4444-5555-6666-777777777777",
        isPublished: true,
      },
      // Draft lesson in published course
      {
        courseId: publishedCourse._id,
        title: "Secret Unreleased Lesson",
        moduleName: "Module 2: Production",
        order: 4,
        durationMinutes: 45,
        durationSeconds: 2700,
        isFreePreview: false,
        bunnyVideoId: "99999999-9999-9999-9999-999999999999",
        isPublished: false,
      },
    ]);

    // -------------------------------------------------------------
    // Test 1: Forgot-Password Request
    // -------------------------------------------------------------
    console.log("-> Test 1: Forgot-password request handling");
    const { csrfToken: csrf1, cookie: cookie1 } = await getCsrf(server);

    // 1a. Missing email
    const emptyEmailRes = await httpRequest(
      server,
      { path: "/api/auth/forgot-password", method: "POST" },
      { email: "" },
      cookie1,
      csrf1
    );
    assert.strictEqual(emptyEmailRes.statusCode, 400, "Empty email must return 400");
    assert.strictEqual(emptyEmailRes.json?.code, "INVALID_INPUT");

    // 1b. Non-existent email (must NOT leak enumeration)
    const ghostRes = await httpRequest(
      server,
      { path: "/api/auth/forgot-password", method: "POST" },
      { email: "nonexistent_ghost_user@eduviber.test" },
      cookie1,
      csrf1
    );
    assert.strictEqual(ghostRes.statusCode, 200, "Non-existent email must return 200 to prevent enumeration");
    assert.strictEqual(ghostRes.json?.success, true);
    assert.ok(ghostRes.json?.message.includes("If an active account exists"));

    // 1c. Valid student email
    const validForgotRes = await httpRequest(
      server,
      { path: "/api/auth/forgot-password", method: "POST" },
      { email: studentUser.email },
      cookie1,
      csrf1
    );
    assert.strictEqual(validForgotRes.statusCode, 200, "Valid email must return 200");
    assert.strictEqual(validForgotRes.json?.success, true);

    // Verify token was stored hashed in MongoDB with ~1 hr expiration
    const updatedStudent = await User.findById(studentUser._id).select("+resetPasswordTokenHash");
    assert.ok(updatedStudent.resetPasswordTokenHash, "resetPasswordTokenHash must be set");
    assert.ok(updatedStudent.resetPasswordExpires, "resetPasswordExpires must be set");
    const timeRemaining = updatedStudent.resetPasswordExpires.getTime() - Date.now();
    assert.ok(timeRemaining > 50 * 60 * 1000 && timeRemaining <= 60 * 60 * 1000, "Expiry must be ~60 minutes");

    // -------------------------------------------------------------
    // Test 2 & 3: Reset-Password with Valid, Invalid, Expired Tokens
    // -------------------------------------------------------------
    console.log("-> Test 2 & 3: Reset password token validation, length rules & expiry");

    // Generate explicit raw token for controlled testing
    const rawResetToken = "test_raw_reset_token_" + runId;
    const rawTokenHash = crypto.createHash("sha256").update(rawResetToken).digest("hex");

    updatedStudent.resetPasswordTokenHash = rawTokenHash;
    updatedStudent.resetPasswordExpires = new Date(Date.now() + 3600000);
    await updatedStudent.save();

    const { csrfToken: csrf2, cookie: cookie2 } = await getCsrf(server);

    // 3a. Invalid / non-existent token
    const invalidTokenRes = await httpRequest(
      server,
      { path: "/api/auth/reset-password", method: "POST" },
      { token: "completely_fake_token", password: "NewSecurePassword123!" },
      cookie2,
      csrf2
    );
    assert.strictEqual(invalidTokenRes.statusCode, 400, "Invalid token must return 400");
    assert.strictEqual(invalidTokenRes.json?.code, "INVALID_OR_EXPIRED_TOKEN");

    // 3b. Expired token
    updatedStudent.resetPasswordExpires = new Date(Date.now() - 10000); // 10s in past
    await updatedStudent.save();

    const expiredTokenRes = await httpRequest(
      server,
      { path: "/api/auth/reset-password", method: "POST" },
      { token: rawResetToken, password: "NewSecurePassword123!" },
      cookie2,
      csrf2
    );
    assert.strictEqual(expiredTokenRes.statusCode, 400, "Expired token must return 400");
    assert.strictEqual(expiredTokenRes.json?.code, "INVALID_OR_EXPIRED_TOKEN");

    // Re-activate valid token for password validation checks
    updatedStudent.resetPasswordExpires = new Date(Date.now() + 3600000);
    await updatedStudent.save();

    // 3c. Password too short (< 12 chars)
    const shortPassRes = await httpRequest(
      server,
      { path: "/api/auth/reset-password", method: "POST" },
      { token: rawResetToken, password: "Short1!" },
      cookie2,
      csrf2
    );
    assert.strictEqual(shortPassRes.statusCode, 400, "Short password must return 400");
    assert.strictEqual(shortPassRes.json?.code, "PASSWORD_TOO_SHORT");

    // 3d. Passwords do not match
    const mismatchRes = await httpRequest(
      server,
      { path: "/api/auth/reset-password", method: "POST" },
      { token: rawResetToken, password: "NewSecurePassword123!", confirmPassword: "DifferentPassword123!" },
      cookie2,
      csrf2
    );
    assert.strictEqual(mismatchRes.statusCode, 400, "Mismatched passwords must return 400");
    assert.strictEqual(mismatchRes.json?.code, "PASSWORDS_DO_NOT_MATCH");

    // 3e. Password reuse rejection (same as existing password)
    const reuseRes = await httpRequest(
      server,
      { path: "/api/auth/reset-password", method: "POST" },
      { token: rawResetToken, password: initialPassword },
      cookie2,
      csrf2
    );
    assert.strictEqual(reuseRes.statusCode, 400, "Reused password must return 400");
    assert.strictEqual(reuseRes.json?.code, "PASSWORD_REUSED");

    // 2. Successful reset with valid token and strong new password
    const newPassword = "BrandNewPassword123456!";
    const validResetRes = await httpRequest(
      server,
      { path: "/api/auth/reset-password", method: "POST" },
      { token: rawResetToken, password: newPassword, confirmPassword: newPassword },
      cookie2,
      csrf2
    );
    assert.strictEqual(validResetRes.statusCode, 200, "Valid reset must return 200");
    assert.strictEqual(validResetRes.json?.success, true);
    assert.strictEqual(validResetRes.json?.data?.requiresRelogin, true);

    // -------------------------------------------------------------
    // Test 4: Token Reuse Rejection
    // -------------------------------------------------------------
    console.log("-> Test 4: Token reuse rejection");
    const { csrfToken: csrf4, cookie: cookie4 } = await getCsrf(server);
    const reuseTokenRes = await httpRequest(
      server,
      { path: "/api/auth/reset-password", method: "POST" },
      { token: rawResetToken, password: "YetAnotherPassword123!" },
      cookie4,
      csrf4
    );
    assert.strictEqual(reuseTokenRes.statusCode, 400, "Reusing spent token must return 400");
    assert.strictEqual(reuseTokenRes.json?.code, "INVALID_OR_EXPIRED_TOKEN");

    // Confirm tokens are completely wiped from database record
    const postResetUser = await User.findById(studentUser._id).select("+resetPasswordTokenHash");
    assert.strictEqual(postResetUser.resetPasswordTokenHash, undefined, "Token hash must be removed");
    assert.strictEqual(postResetUser.resetPasswordExpires, undefined, "Expiry must be removed");
    assert.strictEqual(postResetUser.mustChangePassword, false, "mustChangePassword must be false");

    // -------------------------------------------------------------
    // Test 5: Existing Login After Password Reset
    // -------------------------------------------------------------
    console.log("-> Test 5: Existing login after password reset");

    // 5a. Login with old password fails
    const oldLogin = await loginUser(server, studentUser.email, initialPassword);
    assert.strictEqual(oldLogin.statusCode, 401, "Old password must fail authentication");

    // 5b. Login with new password succeeds
    const newLogin = await loginUser(server, studentUser.email, newPassword);
    assert.strictEqual(newLogin.statusCode, 200, "New password must succeed");
    assert.strictEqual(newLogin.json?.data?.user?.email, studentUser.email);
    assert.strictEqual(newLogin.json?.data?.user?.role, "student");

    // -------------------------------------------------------------
    // Test 6: Public Course Catalog (GET /api/public/courses)
    // -------------------------------------------------------------
    console.log("-> Test 6: Public course catalog structure and metrics");
    const catalogRes = await httpRequest(server, { path: "/api/public/courses", method: "GET" });
    assert.strictEqual(catalogRes.statusCode, 200, "Course catalog must return 200");
    assert.strictEqual(catalogRes.json?.success, true);

    const catalogList = catalogRes.json?.data?.courses || [];
    assert.ok(Array.isArray(catalogList), "Catalog courses must be an array");

    // Published course must be present
    const foundPublished = catalogList.find((c) => c.slug === publishedCourse.slug);
    assert.ok(foundPublished, "Published course must be returned in catalog");
    assert.strictEqual(foundPublished.title, publishedCourse.title);
    assert.strictEqual(foundPublished.price, 2499);
    assert.strictEqual(foundPublished.totalLessons, 3, "Catalog must report exactly 3 published lessons");
    assert.strictEqual(foundPublished.totalMinutes, 70, "Catalog must report (900+1500+1800)/60 = 70 minutes");
    assert.ok(foundPublished.teacher, "Catalog must include teacher profile");
    assert.strictEqual(foundPublished.teacher.name, teacherUser.name);

    // Unpublished course must NOT be in catalog
    const foundUnpublished = catalogList.find((c) => c.slug === unpublishedCourse.slug);
    assert.strictEqual(foundUnpublished, undefined, "Unpublished course must NEVER appear in catalog");

    // -------------------------------------------------------------
    // Test 7: Public Course Details & Security (GET /api/public/courses/:slug)
    // -------------------------------------------------------------
    console.log("-> Test 7: Public course details, hierarchy and video protection");

    // 7a. Published course detail
    const detailRes = await httpRequest(
      server,
      { path: `/api/public/courses/${publishedCourse.slug}`, method: "GET" }
    );
    assert.strictEqual(detailRes.statusCode, 200, "Course detail must return 200");
    assert.strictEqual(detailRes.json?.success, true);

    const detailData = detailRes.json?.data;
    assert.strictEqual(detailData.course.title, publishedCourse.title);
    assert.strictEqual(detailData.course.totalLessons, 3, "Detail must count only published lessons");
    assert.strictEqual(detailData.course.totalMinutes, 70, "Detail must calculate duration correctly");
    assert.strictEqual(detailData.course.isEnrolled, false, "Guest must have isEnrolled=false");

    // Verify modules grouping
    assert.ok(Array.isArray(detailData.modules), "Modules must be an array");
    assert.strictEqual(detailData.modules.length, 2, "Must group into 2 modules");
    assert.strictEqual(detailData.modules[0].name, "Module 1: Foundations");
    assert.strictEqual(detailData.modules[0].lessonCount, 2);
    assert.strictEqual(detailData.modules[1].name, "Module 2: Production");
    assert.strictEqual(detailData.modules[1].lessonCount, 1); // 1 published, 1 draft excluded

    // Verify syllabus
    assert.ok(Array.isArray(detailData.syllabus), "Syllabus must be an array");
    assert.strictEqual(detailData.syllabus.length, 3, "Syllabus must contain only 3 published lessons");
    assert.strictEqual(detailData.syllabus[0].isFreePreview, true);

    // Verify payment configuration is exposed
    assert.ok(detailData.paymentConfig, "paymentConfig must be present");
    assert.ok(detailData.paymentConfig.upiId, "paymentConfig.upiId must be present");
    assert.ok(detailData.paymentConfig.accountNumber, "paymentConfig.accountNumber must be present");

    // CRITICAL SECURITY ASSERTION: bunnyVideoId must NEVER be leaked in public APIs
    const rawDetailJson = JSON.stringify(detailData);
    assert.ok(!rawDetailJson.includes("11111111-2222-3333"), "bunnyVideoId must NEVER be exposed publicly");
    assert.ok(!rawDetailJson.includes("22222222-3333-4444"), "bunnyVideoId must NEVER be exposed publicly");
    assert.ok(!rawDetailJson.includes("99999999-9999-9999"), "Draft video ID must NEVER be exposed publicly");

    // 7b. Unpublished course detail must return 404
    const draftRes = await httpRequest(
      server,
      { path: `/api/public/courses/${unpublishedCourse.slug}`, method: "GET" }
    );
    assert.strictEqual(draftRes.statusCode, 404, "Draft course detail must return 404");
    assert.strictEqual(draftRes.json?.code, "NOT_FOUND");

    // -------------------------------------------------------------
    // Test 8: Avatar Upload Size and File Validation
    // -------------------------------------------------------------
    console.log("-> Test 8: Avatar upload size limit and magic bytes validation");
    const studentLogin = await loginUser(server, studentUser.email, newPassword);

    // 8a. Oversized file (> 4 MB)
    // Create multipart payload with 4.2 MB dummy buffer
    const boundary = "----WebKitFormBoundary" + crypto.randomBytes(8).toString("hex");
    const oversizedBuffer = Buffer.alloc(4.2 * 1024 * 1024, 0x41); // 4.2MB of 'A's
    const headerPart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n`
    );
    const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
    const oversizedBody = Buffer.concat([headerPart, oversizedBuffer, footerPart]);

    const oversizedRes = await httpRequest(
      server,
      {
        path: "/api/student/profile/avatar",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      null,
      studentLogin.cookie,
      studentLogin.csrfToken,
      oversizedBody
    );
    assert.strictEqual(oversizedRes.statusCode, 400, "Oversized upload (>4MB) must return 400");
    assert.strictEqual(oversizedRes.json?.code, "FILE_TOO_LARGE");
    assert.ok(oversizedRes.json?.message.includes("4 MB limit"), "Error must state 4 MB limit");

    // 8b. Invalid file signature (fake PNG extension but text content)
    const fakeBuffer = Buffer.from("THIS_IS_NOT_A_VALID_IMAGE_CONTENT");
    const fakeBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="fake.png"\r\nContent-Type: image/png\r\n\r\n`),
      fakeBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const fakeRes = await httpRequest(
      server,
      {
        path: "/api/student/profile/avatar",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      null,
      studentLogin.cookie,
      studentLogin.csrfToken,
      fakeBody
    );
    assert.strictEqual(fakeRes.statusCode, 400, "Spoofed image must return 400");
    assert.strictEqual(fakeRes.json?.code, "INVALID_IMAGE_SIGNATURE");

    // 8c. Unsupported extension / MIME type via Multer fileFilter
    const pdfBuffer = Buffer.from("%PDF-1.4 dummy pdf content");
    const pdfBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="document.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      pdfBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const pdfRes = await httpRequest(
      server,
      {
        path: "/api/student/profile/avatar",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      null,
      studentLogin.cookie,
      studentLogin.csrfToken,
      pdfBody
    );
    assert.strictEqual(pdfRes.statusCode, 400, "Unsupported MIME type must return 400");
    assert.ok(pdfRes.json?.message.includes("Only JPEG, PNG, and WebP"), "Must specify allowed image types");

    // 8d. Missing file payload
    const missingRes = await httpRequest(
      server,
      { path: "/api/student/profile/avatar", method: "POST" },
      {},
      studentLogin.cookie,
      studentLogin.csrfToken
    );
    assert.strictEqual(missingRes.statusCode, 400, "Missing image file must return 400");
    assert.strictEqual(missingRes.json?.code, "MISSING_IMAGE");

    // -------------------------------------------------------------
    // Test 9: Existing Student and Teacher Authentication Regressions
    // -------------------------------------------------------------
    console.log("-> Test 9: Authentication session regressions for student and teacher");

    // 9a. Student /api/auth/me
    const meRes = await httpRequest(
      server,
      { path: "/api/auth/me", method: "GET" },
      null,
      studentLogin.cookie
    );
    assert.strictEqual(meRes.statusCode, 200, "/api/auth/me must return 200 for student");
    assert.strictEqual(meRes.json?.data?.user?.email, studentUser.email);
    assert.strictEqual(meRes.json?.data?.user?.role, "student");

    // 9b. Teacher login and me
    const teacherLogin = await loginUser(server, teacherUser.email, initialPassword);
    assert.strictEqual(teacherLogin.statusCode, 200, "Teacher login must succeed");
    assert.strictEqual(teacherLogin.json?.data?.user?.role, "teacher");

    const teacherMe = await httpRequest(
      server,
      { path: "/api/auth/me", method: "GET" },
      null,
      teacherLogin.cookie
    );
    assert.strictEqual(teacherMe.statusCode, 200, "/api/auth/me must return 200 for teacher");
    assert.strictEqual(teacherMe.json?.data?.user?.email, teacherUser.email);
    assert.strictEqual(teacherMe.json?.data?.user?.role, "teacher");
    assert.strictEqual(teacherMe.json?.data?.user?.teacherProfile?.headline, "Master Instructor");

    // 9c. Logout
    const logoutRes = await httpRequest(
      server,
      { path: "/api/auth/logout", method: "POST" },
      null,
      teacherLogin.cookie,
      teacherLogin.csrfToken
    );
    assert.strictEqual(logoutRes.statusCode, 200, "Logout must return 200");
    assert.strictEqual(logoutRes.json?.success, true);

    console.log("✅ All Phase 1 React Migration API Parity tests passed successfully!");
  } finally {
    // Settle pending I/O before teardown
    await new Promise((r) => setTimeout(r, 100));

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
        await sessionStore.close().catch(() => { });
      } catch (err) {
        // Ignore expected closure interruption
      }
    }

    // 3. Disconnect Mongoose after dependent resources are closed
    try {
      await mongoose.disconnect().catch(() => { });
    } catch (err) {
      // Ignore disconnect errors
    }
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exitCode = 1;
});
