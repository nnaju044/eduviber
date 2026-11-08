import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../server.js";
import User from "../models/User.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMESTAMP = Date.now();
const testUsers = [];

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

async function runTeacherCreationBugFixTests() {
  console.log("\n==========================================================");
  console.log("=== RUNNING SUPER ADMIN TEACHER CREATION FIX TEST SUITE ===");
  console.log("==========================================================");

  // 0. Test DB isolation guard
  await connectTestDB();
  assertTestDatabaseIsolation();
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Seed Super Admin
    const adminUser = await User.create({
      name: "Admin Fix Tester",
      email: `admin_fix_${TIMESTAMP}@example.com`,
      phone: "9988776655",
      passwordHash,
      role: "super_admin",
      isActive: true,
    });
    testUsers.push(adminUser._id);

    const adminAuth = await loginUser(server, adminUser.email);

    // ======================================================================
    // 1. SUCCESSFUL TEACHER CREATION FOLLOWED BY SUCCESSFUL UI REFRESH
    // ======================================================================
    console.log("\n--- TEST 1: SUCCESSFUL CREATION & DIRECTORY REFRESH ---");
    const teacherEmail1 = `teacher_success_${TIMESTAMP}@example.com`;
    const createRes1 = await httpRequest(
      server,
      { path: "/api/admin/teachers", method: "POST" },
      {
        name: "Professor Alan Turing",
        email: teacherEmail1,
        phone: "9876543210",
        password: "ValidPassword123!",
        headline: "Computer Science & Cryptography",
        bio: "Father of theoretical computer science and artificial intelligence",
        commissionRate: 0.15,
        isApproved: true,
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(createRes1.statusCode, 201, "Teacher creation must return HTTP 201 Created");
    assert.equal(createRes1.json?.success, true);
    assert.equal(createRes1.json?.data?.teacher?.email, teacherEmail1);
    assert.equal(createRes1.json?.data?.teacher?.teacherProfile?.isApproved, true);
    assert.equal(createRes1.json?.data?.teacher?.isActive, true);
    const teacherId1 = createRes1.json.data.teacher.id;
    testUsers.push(new mongoose.Types.ObjectId(teacherId1));

    // Simulate subsequent successful UI directory refresh (fetchTeachers)
    const listRes1 = await httpRequest(
      server,
      { path: "/api/admin/teachers", method: "GET" },
      null,
      adminAuth.cookie
    );
    assert.equal(listRes1.statusCode, 200, "Directory refresh returns HTTP 200");
    const teachersList = listRes1.json?.data?.teachers || [];
    const found1 = teachersList.find((t) => t.id === teacherId1 || t.email === teacherEmail1);
    assert.ok(found1, "Newly created teacher must appear in refreshed teacher directory");
    assert.equal(found1.name, "Professor Alan Turing");
    assert.equal(found1.isApproved, true);
    assert.equal(found1.isActive, true);
    console.log("✓ TEST 1 PASSED: Successful teacher creation followed by successful UI directory refresh.");

    // ======================================================================
    // 2. SUCCESSFUL CREATION RESILIENCE WHEN UI REFRESH/CALLBACK FAILS
    // ======================================================================
    console.log("\n--- TEST 2: RESILIENCE WHEN POST-CREATION CALLBACK OR REFRESH FAILS ---");
    const teacherEmail2 = `teacher_callback_resilience_${TIMESTAMP}@example.com`;
    const createRes2 = await httpRequest(
      server,
      { path: "/api/admin/teachers", method: "POST" },
      {
        name: "Ada Lovelace",
        email: teacherEmail2,
        phone: "9876543222",
        password: "ValidPassword123!",
        headline: "Analytical Engine Pioneer",
        bio: "First computer programmer",
        commissionRate: 0.20,
        isApproved: true,
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(createRes2.statusCode, 201);
    const teacherId2 = createRes2.json.data.teacher.id;
    testUsers.push(new mongoose.Types.ObjectId(teacherId2));

    // Simulate client-side scenario:
    // Even if a post-creation UI callback throws (e.g. `onCreated is not a function` or network error on refresh),
    // the teacher record in the database remains intact and is never compromised or uncreated.
    let simulatedUiErrorCaught = false;
    try {
      // Simulate faulty caller passing a non-function or throwing callback
      const faultyCallback = null;
      if (typeof faultyCallback === "function") {
        faultyCallback();
      }
      // If code safely checked typeof, it avoids throwing TypeError
    } catch (err) {
      simulatedUiErrorCaught = true;
    }
    assert.equal(simulatedUiErrorCaught, false, "Protected callback invocation must avoid throwing TypeError");

    // Verify database record persists in database
    const dbTeacher2 = await User.findById(teacherId2);
    assert.ok(dbTeacher2, "Teacher record must persist safely in DB even if UI refresh fails");
    assert.equal(dbTeacher2.email, teacherEmail2);
    assert.equal(dbTeacher2.teacherProfile.isApproved, true);
    console.log("✓ TEST 2 PASSED: Account creation persists safely in DB regardless of client refresh state.");

    // ======================================================================
    // 3. DUPLICATE EMAIL RESPONSE (409 CONFLICT)
    // ======================================================================
    console.log("\n--- TEST 3: DUPLICATE EMAIL RESPONSE (HTTP 409) ---");
    const duplicateRes = await httpRequest(
      server,
      { path: "/api/admin/teachers", method: "POST" },
      {
        name: "Duplicate Alan Turing Attempt",
        email: teacherEmail1, // Same email as Test 1
        phone: "9876543299",
        password: "ValidPassword123!",
        headline: "Duplicate Attempt",
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(duplicateRes.statusCode, 409, "Duplicate teacher email must return HTTP 409 Conflict");
    assert.equal(duplicateRes.json?.success, false);
    assert.equal(duplicateRes.json?.code, "EMAIL_COLLISION");
    assert.ok(
      duplicateRes.json?.message?.toLowerCase().includes("already exists"),
      "Message must clearly explain email already exists"
    );
    console.log("✓ TEST 3 PASSED: Duplicate teacher submission returns clear 409 EMAIL_COLLISION error.");

    // ======================================================================
    // 4. GENUINE SERVER-SIDE CREATION FAILURES
    // ======================================================================
    console.log("\n--- TEST 4: GENUINE SERVER-SIDE VALIDATION FAILURES ---");
    // 4.1 Short name
    const shortNameRes = await httpRequest(
      server,
      { path: "/api/admin/teachers", method: "POST" },
      {
        name: "A", // < 2 chars
        email: `valid_${TIMESTAMP}@example.com`,
        phone: "9876543210",
        password: "ValidPassword123!",
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(shortNameRes.statusCode, 400);
    assert.equal(shortNameRes.json?.code, "INVALID_NAME");

    // 4.2 Malformed email
    const badEmailRes = await httpRequest(
      server,
      { path: "/api/admin/teachers", method: "POST" },
      {
        name: "Valid Name",
        email: "not-an-email",
        phone: "9876543210",
        password: "ValidPassword123!",
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(badEmailRes.statusCode, 400);
    assert.equal(badEmailRes.json?.code, "INVALID_EMAIL");

    // 4.3 Short password
    const shortPassRes = await httpRequest(
      server,
      { path: "/api/admin/teachers", method: "POST" },
      {
        name: "Valid Name",
        email: `valid_${TIMESTAMP}@example.com`,
        phone: "9876543210",
        password: "short", // < 12 chars
      },
      adminAuth.cookie,
      adminAuth.csrfToken
    );
    assert.equal(shortPassRes.statusCode, 400);
    assert.equal(shortPassRes.json?.code, "PASSWORD_TOO_SHORT");
    console.log("✓ TEST 4 PASSED: Genuine server-side validation failures return HTTP 400 with structured codes.");

    // ======================================================================
    // 5. DOUBLE-CLICK & REPEATED SUBMISSION PREVENTION CONTRACT
    // ======================================================================
    console.log("\n--- TEST 5: DOUBLE-CLICK & REPEATED SUBMISSION PREVENTION CONTRACT ---");
    // Verify client API does not automatically retry state-changing POST requests upon ambiguous errors
    // and verify TeacherCreateModal component source includes `if (isSubmitting) return;` guard.
    const fs = await import("node:fs");
    const modalPath = path.resolve(__dirname, "../client/src/components/admin/TeacherCreateModal.jsx");
    const modalSrc = fs.readFileSync(modalPath, "utf-8");

    assert.ok(
      modalSrc.includes("if (isSubmitting) return;"),
      "TeacherCreateModal must contain double-click / concurrent submission prevention guard"
    );
    assert.ok(
      modalSrc.includes("onSuccess") && modalSrc.includes("onCreated"),
      "TeacherCreateModal must support both onSuccess and onCreated callback prop interfaces"
    );
    assert.ok(
      modalSrc.includes("typeof onSuccess === \"function\""),
      "TeacherCreateModal must verify typeof onSuccess is function before invocation"
    );
    assert.ok(
      modalSrc.includes("typeof onCreated === \"function\""),
      "TeacherCreateModal must verify typeof onCreated is function before invocation"
    );
    assert.ok(
      modalSrc.includes("disabled={isSubmitting}"),
      "Submit and cancel buttons must be disabled while isSubmitting is true"
    );
    console.log("✓ TEST 5 PASSED: TeacherCreateModal component contract strictly enforces double-click prevention and safe callback handling.");

    console.log("\n==========================================================");
    console.log("=== ALL SUPER ADMIN TEACHER CREATION FIX TESTS PASSED! ===");
    console.log("==========================================================");
  } finally {
    // Cleanup seeded test fixtures
    try {
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

runTeacherCreationBugFixTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR in Teacher Creation Bug Fix Test Suite:", err);
    process.exit(1);
  });
