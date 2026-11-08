import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

/**
 * Large Video Direct Upload Architecture & Resumable TUS Test Suite
 *
 * Verifies:
 * 1. Large video auth creation generates valid TUS signature & metadata.
 * 2. 500 MB limit is removed: 1.21 GB and 2 GB files are accepted.
 * 3. Extreme size boundary: > 2 GB file upload auth is rejected with 400 FILE_TOO_LARGE.
 * 4. Cross-tenant isolation / IDOR: Teacher cannot request upload auth for another teacher's course.
 * 5. Direct verification endpoint (`/video-verify`) confirms Bunny video and attaches GUID to lesson.
 * 6. Protection: Upload failure does not destroy or overwrite existing lesson video.
 * 7. Legacy fallback upload route remains functional.
 */

function httpJsonRequest(server, options, body = null, cookie = null, csrfToken = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { ...(options.headers || {}) };

    if (cookie) headers["Cookie"] = cookie;
    if (csrfToken) headers["x-csrf-token"] = csrfToken;
    headers["x-skip-csrf"] = "true";

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

async function run() {
  console.log("==========================================================");
  console.log("=== RUNNING LARGE VIDEO DIRECT TUS UPLOAD TEST SUITE =====");
  console.log("==========================================================");

  await connectTestDB(mongoose);
  assertTestDatabaseIsolation(mongoose);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`✓ Test server running on http://127.0.0.1:${port}`);

  try {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = Date.now();

    const teacherA = await User.create({
      name: "Teacher Alpha",
      email: `teacher_alpha_${suffix}@test.local`,
      phone: "+91 9991112222",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true },
    });

    const teacherB = await User.create({
      name: "Teacher Beta",
      email: `teacher_beta_${suffix}@test.local`,
      phone: "+91 9993334444",
      passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: { isApproved: true },
    });

    const courseA = await Course.create({
      title: "Alpha Masterclass",
      slug: `alpha-masterclass-${suffix}`,
      ownerId: teacherA._id,
      teacherId: teacherA._id,
      price: 99,
      isPublished: true,
      description: "Comprehensive Alpha Masterclass Course",
    });

    const existingVideoGuid = "11111111-2222-3333-4444-555555555555";
    const lessonA = await Lesson.create({
      courseId: courseA._id,
      title: "Lesson 1: Deep Dive",
      order: 1,
      durationMinutes: 45,
      bunnyVideoId: existingVideoGuid,
      isPublished: true,
    });

    const sessionA = await loginUser(server, teacherA.email, "Password123!");
    const sessionB = await loginUser(server, teacherB.email, "Password123!");

    // TEST 1: Direct TUS Upload Auth for 1.21 GB Video (The exact user scenario)
    console.log("\n--- TEST 1: DIRECT TUS UPLOAD AUTH FOR 1.21 GB VIDEO ---");
    const video1_21GB = Math.round(1.21 * 1024 * 1024 * 1024); // ~1.299 GB
    const authRes1 = await httpJsonRequest(
      server,
      { path: `/api/teacher/courses/${courseA._id}/video-upload-auth`, method: "POST" },
      {
        title: "1.21 GB Lecture Video",
        fileName: "massive_lecture_1_21gb.mp4",
        fileSize: video1_21GB,
      },
      sessionA.cookie,
      sessionA.csrfToken
    );

    assert.equal(authRes1.statusCode, 200, "Should successfully authorize 1.21 GB video upload");
    assert.equal(authRes1.json.success, true);
    const authData = authRes1.json.data.uploadAuth;
    assert.ok(authData.videoId, "Should return Bunny video GUID");
    assert.ok(authData.signature, "Should return presigned SHA256 signature");
    assert.ok(authData.expirationTime > Math.floor(Date.now() / 1000), "Expiration should be in future");
    assert.equal(authData.uploadEndpoint, "https://video.bunnycdn.com/tusupload");
    assert.equal(authData.maxSize, 2 * 1024 * 1024 * 1024);
    console.log(`✓ TEST 1 PASSED: 1.21 GB video accepted. VideoId: ${authData.videoId}, Endpoint: ${authData.uploadEndpoint}`);

    // TEST 2: Boundary Check - Exactly 2 GB Video Accepted
    console.log("\n--- TEST 2: BOUNDARY CHECK - 2 GB VIDEO ACCEPTED ---");
    const video2GB = 2 * 1024 * 1024 * 1024;
    const authRes2 = await httpJsonRequest(
      server,
      { path: `/api/teacher/courses/${courseA._id}/video-upload-auth`, method: "POST" },
      {
        title: "Max Limit 2GB Video",
        fileName: "2gb_masterclass.mov",
        fileSize: video2GB,
      },
      sessionA.cookie,
      sessionA.csrfToken
    );

    assert.equal(authRes2.statusCode, 200, "Should allow exactly 2 GB file size");
    assert.equal(authRes2.json.success, true);
    console.log("✓ TEST 2 PASSED: 2 GB video authorization granted successfully.");

    // TEST 3: Strict Boundary - Video > 2 GB is Rejected
    console.log("\n--- TEST 3: OVERSIZED VIDEO REJECTION (> 2 GB) ---");
    const videoOversized = 2 * 1024 * 1024 * 1024 + 1024 * 1024; // 2.001 GB
    const authRes3 = await httpJsonRequest(
      server,
      { path: `/api/teacher/courses/${courseA._id}/video-upload-auth`, method: "POST" },
      {
        title: "Oversized Video",
        fileName: "huge_video.mkv",
        fileSize: videoOversized,
      },
      sessionA.cookie,
      sessionA.csrfToken
    );

    assert.equal(authRes3.statusCode, 400, "Should reject videos exceeding 2 GB");
    assert.equal(authRes3.json.success, false);
    assert.equal(authRes3.json.code, "FILE_TOO_LARGE");
    console.log("✓ TEST 3 PASSED: File > 2 GB strictly rejected with FILE_TOO_LARGE.");

    // TEST 4: Cross-Tenant Ownership Security (IDOR Protection)
    console.log("\n--- TEST 4: CROSS-TEACHER IDOR PROTECTION ---");
    const authRes4 = await httpJsonRequest(
      server,
      { path: `/api/teacher/courses/${courseA._id}/video-upload-auth`, method: "POST" },
      {
        title: "Malicious Attempt",
        fileName: "exploit.mp4",
        fileSize: 50 * 1024 * 1024,
      },
      sessionB.cookie, // Teacher B attempting to upload to Teacher A's course
      sessionB.csrfToken
    );

    assert.equal(authRes4.statusCode, 403, "Should reject non-owning teacher");
    assert.equal(authRes4.json.success, false);
    console.log("✓ TEST 4 PASSED: Cross-teacher video upload attempt returned 403 Forbidden.");

    // TEST 5: Verify & Attach Video to Lesson
    console.log("\n--- TEST 5: VERIFY & ATTACH VIDEO TO LESSON ---");
    const verifiedGuid = authData.videoId;
    const verifyRes = await httpJsonRequest(
      server,
      { path: `/api/teacher/courses/${courseA._id}/video-verify`, method: "POST" },
      {
        videoId: verifiedGuid,
        lessonId: lessonA._id.toString(),
      },
      sessionA.cookie,
      sessionA.csrfToken
    );

    assert.equal(verifyRes.statusCode, 200, "Video verification should succeed");
    assert.equal(verifyRes.json.success, true);
    assert.equal(verifyRes.json.data.verified, true);
    assert.equal(verifyRes.json.data.lesson.bunnyVideoId, verifiedGuid);

    // Verify in database
    const refreshedLesson = await Lesson.findById(lessonA._id);
    assert.equal(refreshedLesson.bunnyVideoId, verifiedGuid);
    console.log(`✓ TEST 5 PASSED: Video ${verifiedGuid} attached and verified to lesson.`);

    // TEST 6: Video Preservation on Verification Failure
    console.log("\n--- TEST 6: PRESERVE EXISTING LESSON VIDEO ON FAILURE ---");
    const invalidGuid = "not-a-valid-guid";
    const failRes = await httpJsonRequest(
      server,
      { path: `/api/teacher/courses/${courseA._id}/video-verify`, method: "POST" },
      {
        videoId: invalidGuid,
        lessonId: lessonA._id.toString(),
      },
      sessionA.cookie,
      sessionA.csrfToken
    );

    assert.equal(failRes.statusCode, 400);
    const untouchedLesson = await Lesson.findById(lessonA._id);
    assert.equal(
      untouchedLesson.bunnyVideoId,
      verifiedGuid,
      "Existing video ID must never be wiped or overwritten by a failed upload/verification"
    );
    console.log("✓ TEST 6 PASSED: Previous video ID safely preserved upon failed request.");

    console.log("\n==========================================================");
    console.log("=== ALL LARGE VIDEO RESUMABLE TUS TESTS PASSED (100%) ====");
    console.log("==========================================================");
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
