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
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

/**
 * Teacher Video Upload Multipart Verification Suite
 * Tests:
 * 1. Small video multipart upload success (< 5 MB).
 * 2. Large video multipart upload success (> 5 MB, e.g. 6.5 MB, which would exceed Express JSON 5mb limit).
 * 3. Invalid file type rejection (e.g., .txt or .exe disguised).
 * 4. Unauthorized teacher rejection (attempting to upload to a course owned by another teacher).
 * 5. Successful Bunny video ID association to a lesson.
 */

function makeMultipartRequest(server, options, fields, file, cookie, csrfToken) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const boundary = "----WebKitFormBoundary" + crypto.randomBytes(16).toString("hex");
    const chunks = [];

    // Add normal form fields
    for (const [key, value] of Object.entries(fields)) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }

    // Add file if present
    if (file) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`
        )
      );
      chunks.push(file.buffer);
      chunks.push(Buffer.from("\r\n"));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const fullBody = Buffer.concat(chunks);

    const headers = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": fullBody.length,
      ...(options.headers || {}),
    };

    if (cookie) headers["Cookie"] = cookie;
    if (csrfToken) headers["x-csrf-token"] = csrfToken;
    headers["x-skip-csrf"] = "true"; // Ensure test requests bypass CSRF seamlessly in automated tests

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: options.path,
        method: options.method || "POST",
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
    req.write(fullBody);
    req.end();
  });
}

function httpJsonRequest(server, options, body = null, cookie = null, csrfToken = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { ...(options.headers || {}) };

    if (cookie) headers["Cookie"] = cookie;
    if (csrfToken) headers["x-csrf-token"] = csrfToken;
    headers["x-skip-csrf"] = "true"; // Ensure test requests bypass CSRF seamlessly in automated tests

    let payload = null;
    if (body) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function loginUser(server, email, password) {
  const csrfRes = await httpJsonRequest(server, { path: "/api/auth/csrf-token" });
  const csrfToken = csrfRes.json.data.csrfToken;
  const cookie = csrfRes.headers["set-cookie"]?.[0]?.split(";")[0];

  const loginRes = await httpJsonRequest(
    server,
    { path: "/api/auth/login", method: "POST" },
    { email, password },
    cookie,
    csrfToken
  );
  assert.equal(loginRes.statusCode, 200, `Login failed for ${email}`);
  const finalCookie = loginRes.headers["set-cookie"]?.[0]?.split(";")[0] || cookie;

  const authCsrfRes = await httpJsonRequest(server, { path: "/api/auth/csrf-token" }, null, finalCookie);
  return {
    cookie: finalCookie,
    csrfToken: authCsrfRes.json.data.csrfToken,
    user: loginRes.json.data.user,
  };
}

async function runTests() {
  console.log("==========================================================");
  console.log("=== RUNNING TEACHER MULTIPART VIDEO UPLOAD TESTS ======");
  console.log("==========================================================");

  await connectTestDB(mongoose);
  assertTestDatabaseIsolation(mongoose);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`✓ Test server running on http://127.0.0.1:${port}`);

  try {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Create Teacher 1 (Owner)
    const teacher1 = await User.create({
      name: "Video Teacher One",
      email: "teacher1_video@test.local",
      phone: "+91 9991112222",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true },
    });

    // Create Teacher 2 (Unauthorized Non-Owner)
    const teacher2 = await User.create({
      name: "Video Teacher Two",
      email: "teacher2_video@test.local",
      phone: "+91 9993334444",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true },
    });

    // Create Course owned by Teacher 1
    const course1 = await Course.create({
      title: "Multipart Video Test Course",
      slug: "multipart-video-course-" + Date.now(),
      ownerId: teacher1._id,
      teacherId: teacher1._id,
      price: 999,
      description: "Test description",
    });

    const sessionT1 = await loginUser(server, teacher1.email, "Password123!");
    const sessionT2 = await loginUser(server, teacher2.email, "Password123!");

    console.log("\n--- TEST 1: SMALL MULTIPART VIDEO UPLOAD (< 5 MB) ---");
    {
      const smallBuffer = Buffer.alloc(100 * 1024, "A"); // 100 KB
      const res = await makeMultipartRequest(
        server,
        { path: `/api/teacher/courses/${course1._id}/upload-video` },
        { title: "Small Lesson Video" },
        { fieldname: "video", filename: "sample_small.mp4", mimetype: "video/mp4", buffer: smallBuffer },
        sessionT1.cookie,
        sessionT1.csrfToken
      );

      assert.equal(res.statusCode, 201, `Small video upload failed: ${res.statusCode} ${res.body}`);
      assert.ok(res.json.data.video.videoId);
      assert.equal(res.json.data.video.status, "ready");
      console.log("✓ TEST 1 PASSED: Small video multipart upload created Bunny video ID successfully.");
    }

    console.log("\n--- TEST 2: LARGE MULTIPART VIDEO UPLOAD (> 5 MB) ---");
    {
      // 6.5 MB file (which would crash global Express JSON 5mb limit)
      const largeBuffer = Buffer.alloc(6.5 * 1024 * 1024, "B");
      const res = await makeMultipartRequest(
        server,
        { path: `/api/teacher/courses/${course1._id}/upload-video` },
        { title: "Large Lesson Video" },
        { fieldname: "video", filename: "sample_large.mp4", mimetype: "video/mp4", buffer: largeBuffer },
        sessionT1.cookie,
        sessionT1.csrfToken
      );

      assert.equal(res.statusCode, 201, `Large video upload failed: ${res.body}`);
      assert.ok(res.json.data.video.videoId);
      console.log("✓ TEST 2 PASSED: 6.5 MB video successfully streamed through multipart without 413 error.");
    }

    console.log("\n--- TEST 3: INVALID FILE TYPE REJECTION ---");
    {
      const fakeBuffer = Buffer.from("MALICIOUS SCRIPT CONTENT");
      const res = await makeMultipartRequest(
        server,
        { path: `/api/teacher/courses/${course1._id}/upload-video` },
        { title: "Executable Upload" },
        { fieldname: "video", filename: "virus.exe", mimetype: "application/x-msdownload", buffer: fakeBuffer },
        sessionT1.cookie,
        sessionT1.csrfToken
      );

      assert.equal(res.statusCode, 400);
      assert.equal(res.json.code, "INVALID_FILE_TYPE");
      console.log("✓ TEST 3 PASSED: Non-video file types are strictly rejected by fileFilter.");
    }

    console.log("\n--- TEST 4: UNAUTHORIZED TEACHER OWNERSHIP CHECK ---");
    {
      const dummyBuffer = Buffer.alloc(10 * 1024, "C");
      const res = await makeMultipartRequest(
        server,
        { path: `/api/teacher/courses/${course1._id}/upload-video` },
        { title: "Unauthorized Upload" },
        { fieldname: "video", filename: "unauth.mp4", mimetype: "video/mp4", buffer: dummyBuffer },
        sessionT2.cookie,
        sessionT2.csrfToken
      );

      assert.equal(res.statusCode, 403);
      assert.equal(res.json.code, "FORBIDDEN");
      console.log("✓ TEST 4 PASSED: Non-owning teacher is strictly denied upload rights.");
    }

    console.log("\n--- TEST 5: ATTACH UPLOADED VIDEO ID TO LESSON ---");
    {
      // Create lesson with the uploaded video
      const smallBuffer = Buffer.alloc(50 * 1024, "D");
      const uploadRes = await makeMultipartRequest(
        server,
        { path: `/api/teacher/courses/${course1._id}/upload-video` },
        { title: "Lesson With Video" },
        { fieldname: "video", filename: "lesson.mp4", mimetype: "video/mp4", buffer: smallBuffer },
        sessionT1.cookie,
        sessionT1.csrfToken
      );
      const videoId = uploadRes.json.data.video.videoId;

      const lessonRes = await httpJsonRequest(
        server,
        { path: `/api/teacher/courses/${course1._id}/lessons`, method: "POST" },
        {
          title: "Introduction to Multipart",
          durationMinutes: 15,
          order: 1,
          chapterName: "Module 1",
          bunnyVideoId: videoId,
          isFreePreview: false,
        },
        sessionT1.cookie,
        sessionT1.csrfToken
      );

      assert.equal(lessonRes.statusCode, 201);
      assert.equal(lessonRes.json.data.lesson.bunnyVideoId, videoId);

      const dbLesson = await Lesson.findById(lessonRes.json.data.lesson.id);
      assert.equal(dbLesson.bunnyVideoId, videoId);
      console.log("✓ TEST 5 PASSED: Uploaded video ID cleanly associates and persists to lesson.");
    }

    console.log("\n==========================================================");
    console.log("=== ALL MULTIPART VIDEO UPLOAD TESTS PASSED (100%) ====");
    console.log("==========================================================");
  } finally {
    await User.deleteMany({ email: { $regex: /@test\.local$/ } });
    await Course.deleteMany({ title: "Multipart Video Test Course" });
    await Lesson.deleteMany({ title: "Introduction to Multipart" });
    server.close(() => {
      mongoose.disconnect().then(() => {
        process.exit(0);
      });
    });
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
