import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../server.js";
import User from "../models/User.js";
import { connectTestDB, assertTestDatabaseIsolation, getTestDatabaseUri } from "../config/testDbGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

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

async function runPhase3ReactFoundationTests() {
  console.log("\n==========================================================");
  console.log("=== RUNNING PHASE 3.1: REACT FRONTEND FOUNDATION TESTS ===");
  console.log("==========================================================");

  // 0. Verify test database isolation
  await connectTestDB();
  assertTestDatabaseIsolation();
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  // 1. Verify React build artifacts exist
  const distPath = path.join(rootDir, "client", "dist");
  const indexPath = path.join(distPath, "index.html");
  const assetsPath = path.join(distPath, "assets");

  assert.ok(fs.existsSync(indexPath), "client/dist/index.html must exist (run npm run client:build first)");
  const indexHtml = fs.readFileSync(indexPath, "utf-8");
  assert.ok(indexHtml.includes('id="root"'), "index.html must contain root mount div");
  assert.ok(fs.existsSync(assetsPath), "client/dist/assets must exist");
  const assetFiles = fs.readdirSync(assetsPath);
  assert.ok(assetFiles.some((f) => f.endsWith(".js")), "client/dist/assets must contain compiled JS");
  assert.ok(assetFiles.some((f) => f.endsWith(".css")), "client/dist/assets must contain compiled CSS");
  console.log("✓ TEST 1 PASSED: React build artifacts verified (HTML, CSS bundle, and JS chunks present).");

  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    // 2. Test Express serving React SPA at canonical /app/* routes
    const appSpaRes = await httpRequest(server, { path: "/app", method: "GET" });
    assert.equal(appSpaRes.statusCode, 200);
    assert.ok(appSpaRes.headers["content-type"].includes("text/html"));
    assert.ok(appSpaRes.body.includes('id="root"'));
    console.log("✓ TEST 2.1 PASSED: Express serves React SPA at canonical /app.");

    const adminSpaRes = await httpRequest(server, { path: "/app/admin", method: "GET" });
    assert.equal(adminSpaRes.statusCode, 200);
    assert.ok(adminSpaRes.body.includes('id="root"'));
    console.log("✓ TEST 2.2 PASSED: Express serves React SPA at canonical /app/admin.");

    const teacherSpaRes = await httpRequest(server, { path: "/app/teacher", method: "GET" });
    assert.equal(teacherSpaRes.statusCode, 200);
    assert.ok(teacherSpaRes.body.includes('id="root"'));
    console.log("✓ TEST 2.3 PASSED: Express serves React SPA at canonical /app/teacher.");

    const studentSpaRes = await httpRequest(server, { path: "/app/student", method: "GET" });
    assert.equal(studentSpaRes.statusCode, 200);
    assert.ok(studentSpaRes.body.includes('id="root"'));
    console.log("✓ TEST 2.4 PASSED: Express serves React SPA at canonical /app/student.");

    const loginSpaRes = await httpRequest(server, { path: "/app/login", method: "GET" });
    assert.equal(loginSpaRes.statusCode, 200);
    assert.ok(loginSpaRes.body.includes('id="root"'));
    console.log("✓ TEST 2.5 PASSED: Express serves React SPA at canonical /app/login.");

    // Test legacy alias 302 redirects
    const teacherRedirectRes = await httpRequest(server, { path: "/teacher", method: "GET" });
    assert.equal(teacherRedirectRes.statusCode, 302);
    assert.equal(teacherRedirectRes.headers["location"], "/app/teacher");
    console.log("✓ TEST 2.6 PASSED: Express redirects legacy /teacher to /app/teacher.");

    const studentRedirectRes = await httpRequest(server, { path: "/student", method: "GET" });
    assert.equal(studentRedirectRes.statusCode, 302);
    assert.equal(studentRedirectRes.headers["location"], "/app/student");
    console.log("✓ TEST 2.7 PASSED: Express redirects legacy /student to /app/student.");

    // Test static asset serving from client/dist
    const jsAsset = assetFiles.find((f) => f.endsWith(".js"));
    const assetRes = await httpRequest(server, { path: `/assets/${jsAsset}`, method: "GET" });
    assert.equal(assetRes.statusCode, 200);
    assert.ok(assetRes.headers["content-type"].includes("javascript"));
    console.log("✓ TEST 2.8 PASSED: Express serves compiled client assets with correct MIME types.");

    // 3. Test API routes NOT intercepted by SPA fallback
    const csrfRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" });
    assert.equal(csrfRes.statusCode, 200);
    assert.ok(csrfRes.headers["content-type"].includes("application/json"), "CSRF endpoint must return JSON, not HTML");
    assert.ok(csrfRes.json?.success === true, "CSRF endpoint must return success: true");
    assert.ok(typeof csrfRes.json?.data?.csrfToken === "string", "CSRF endpoint must provide csrfToken string");
    const initialCsrfToken = csrfRes.json.data.csrfToken;
    console.log("✓ TEST 3.1 PASSED: /api/csrf-token returns valid JSON and is not intercepted by SPA.");

    const publicCoursesRes = await httpRequest(server, { path: "/api/public/courses", method: "GET" });
    assert.equal(publicCoursesRes.statusCode, 200);
    assert.ok(publicCoursesRes.headers["content-type"].includes("application/json"));
    assert.ok(publicCoursesRes.json?.success === true);
    console.log("✓ TEST 3.2 PASSED: /api/public/courses returns JSON and is not intercepted by SPA.");

    const meUnauthorizedRes = await httpRequest(server, { path: "/api/auth/me", method: "GET" });
    assert.equal(meUnauthorizedRes.statusCode, 401);
    assert.ok(meUnauthorizedRes.headers["content-type"].includes("application/json"));
    assert.equal(meUnauthorizedRes.json?.code, "UNAUTHORIZED");
    console.log("✓ TEST 3.3 PASSED: /api/auth/me returns JSON 401 UNAUTHORIZED when unauthenticated.");

    // 4. Test unknown API routes return JSON errors (not index.html)
    const unknownApiRes = await httpRequest(server, { path: "/api/unknown-nonexistent-endpoint", method: "GET" });
    assert.equal(unknownApiRes.statusCode, 404);
    assert.ok(unknownApiRes.headers["content-type"].includes("application/json"), "Unknown API routes must return JSON, not index.html");
    assert.equal(unknownApiRes.json?.code, "ENDPOINT_NOT_FOUND");
    assert.equal(unknownApiRes.json?.success, false);
    console.log("✓ TEST 4 PASSED: Unknown /api/* routes return JSON 404 ENDPOINT_NOT_FOUND error.");

    // 5. Test existing EJS routes regression
    const landingRes = await httpRequest(server, { path: "/", method: "GET" });
    assert.equal(landingRes.statusCode, 200);
    assert.ok(landingRes.headers["content-type"].includes("text/html"));
    assert.ok(landingRes.body.includes("EDUviber"), "EJS Landing page must render properly");
    console.log("✓ TEST 5.1 PASSED: EJS root landing page (/) renders successfully.");

    const coursesEjsRes = await httpRequest(server, { path: "/courses", method: "GET" });
    assert.equal(coursesEjsRes.statusCode, 200);
    assert.ok(coursesEjsRes.headers["content-type"].includes("text/html"));
    console.log("✓ TEST 5.2 PASSED: EJS courses catalog (/courses) renders successfully.");

    const loginEjsRes = await httpRequest(server, { path: "/login", method: "GET" });
    assert.equal(loginEjsRes.statusCode, 200);
    assert.ok(loginEjsRes.body.includes('action="/login"'), "EJS login page renders form");
    console.log("✓ TEST 5.3 PASSED: EJS login page (/login) renders successfully.");

    const adminEjsRes = await httpRequest(server, { path: "/admin", method: "GET" });
    assert.equal(adminEjsRes.statusCode, 302, "Unauthenticated /admin in EJS must redirect to /login");
    console.log("✓ TEST 5.4 PASSED: EJS /admin route protects access and redirects unauthenticated users.");

    const healthRes = await httpRequest(server, { path: "/health", method: "GET" });
    assert.equal(healthRes.statusCode, 200);
    assert.equal(healthRes.json?.status, "ok");
    console.log("✓ TEST 5.5 PASSED: /health endpoint operational.");

    const notFoundEjsRes = await httpRequest(server, { path: "/unrecognized-static-page-path", method: "GET" });
    assert.equal(notFoundEjsRes.statusCode, 404);
    assert.ok(notFoundEjsRes.body.includes("Page Not Found"), "Non-existent path renders EJS 404");
    console.log("✓ TEST 5.6 PASSED: Non-existent non-API paths render EJS 404 page.");

    // 6. Test Login & Session Integration
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const testAdmin = await User.create({
      name: "Phase3 SuperAdmin",
      email: `phase3_admin_${TIMESTAMP}@example.com`,
      phone: "9876500001",
      passwordHash: passwordHash,
      role: "super_admin",
      isActive: true,
    });
    testUsers.push(testAdmin._id);

    const testApprovedTeacher = await User.create({
      name: "Phase3 ApprovedTeacher",
      email: `phase3_teacher_${TIMESTAMP}@example.com`,
      phone: "9876500002",
      passwordHash: passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        bio: "Senior Instructor",
        isApproved: true,
        approvedAt: new Date(),
      },
    });
    testUsers.push(testApprovedTeacher._id);

    const testPendingTeacher = await User.create({
      name: "Phase3 PendingTeacher",
      email: `phase3_pending_${TIMESTAMP}@example.com`,
      phone: "9876500003",
      passwordHash: passwordHash,
      role: "teacher",
      isActive: true,
      teacherProfile: {
        bio: "Applicant Instructor",
        isApproved: false,
      },
    });
    testUsers.push(testPendingTeacher._id);

    const testStudent = await User.create({
      name: "Phase3 Student",
      email: `phase3_student_${TIMESTAMP}@example.com`,
      phone: "9876500004",
      passwordHash: passwordHash,
      role: "student",
      isActive: true,
    });
    testUsers.push(testStudent._id);

    // 6.1 Test CSRF rejection on state-changing login without token
    const noCsrfLogin = await httpRequest(
      server,
      { path: "/api/auth/login", method: "POST" },
      { email: testAdmin.email, password: "Password123!" }
    );
    assert.equal(noCsrfLogin.statusCode, 403, "Login without CSRF token must be rejected with 403");
    assert.ok(
      typeof noCsrfLogin.json?.error === "string" && noCsrfLogin.json.error.includes("CSRF"),
      "Must return CSRF error message"
    );
    console.log("✓ TEST 6.1 PASSED: POST /api/auth/login strictly requires CSRF token.");

    // 6.2 Test session establishment with valid CSRF and credentials
    const sessionCookieRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" });
    const sessionCookie = extractCookie(sessionCookieRes.headers);
    const validCsrfToken = sessionCookieRes.json.data.csrfToken;

    const loginRes = await httpRequest(
      server,
      { path: "/api/auth/login", method: "POST" },
      { email: testAdmin.email, password: "Password123!" },
      sessionCookie,
      validCsrfToken
    );
    assert.equal(loginRes.statusCode, 200);
    assert.ok(loginRes.json?.success === true);
    assert.equal(loginRes.json?.data?.user?.email, testAdmin.email);
    assert.equal(loginRes.json?.data?.user?.role, "super_admin");
    const authedCookie = extractCookie(loginRes.headers) || sessionCookie;
    console.log("✓ TEST 6.2 PASSED: POST /api/auth/login succeeds and returns authenticated user and session cookie.");

    // 6.3 Test GET /api/auth/me with authenticated session
    const meRes = await httpRequest(server, { path: "/api/auth/me", method: "GET" }, null, authedCookie);
    assert.equal(meRes.statusCode, 200);
    assert.equal(meRes.json?.data?.user?.email, testAdmin.email);
    assert.equal(meRes.json?.data?.user?.role, "super_admin");
    console.log("✓ TEST 6.3 PASSED: GET /api/auth/me recognizes authenticated session and returns user profile.");

    // 6.4 Test teacher profile approval fields
    const teacherSessionRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" });
    const teacherCookie = extractCookie(teacherSessionRes.headers);
    const teacherCsrf = teacherSessionRes.json.data.csrfToken;

    const teacherLogin = await httpRequest(
      server,
      { path: "/api/auth/login", method: "POST" },
      { email: testApprovedTeacher.email, password: "Password123!" },
      teacherCookie,
      teacherCsrf
    );
    assert.equal(teacherLogin.statusCode, 200);
    assert.equal(teacherLogin.json?.data?.user?.teacherProfile?.isApproved, true);

    const pendingSessionRes = await httpRequest(server, { path: "/api/csrf-token", method: "GET" });
    const pendingCookie = extractCookie(pendingSessionRes.headers);
    const pendingCsrf = pendingSessionRes.json.data.csrfToken;

    const pendingLogin = await httpRequest(
      server,
      { path: "/api/auth/login", method: "POST" },
      { email: testPendingTeacher.email, password: "Password123!" },
      pendingCookie,
      pendingCsrf
    );
    assert.equal(pendingLogin.statusCode, 200);
    assert.equal(pendingLogin.json?.data?.user?.teacherProfile?.isApproved, false);
    console.log("✓ TEST 6.4 PASSED: User teacherProfile.isApproved field accurately reflects approval status.");

    // 6.5 Test logout destroys session
    const logoutRes = await httpRequest(
      server,
      { path: "/api/auth/logout", method: "POST" },
      {},
      authedCookie,
      loginRes.json?.data?.csrfToken || validCsrfToken
    );
    assert.equal(logoutRes.statusCode, 200);
    assert.ok(logoutRes.json?.success === true);

    const meAfterLogout = await httpRequest(server, { path: "/api/auth/me", method: "GET" }, null, authedCookie);
    assert.equal(meAfterLogout.statusCode, 401, "Session must be invalid after logout");
    console.log("✓ TEST 6.5 PASSED: POST /api/auth/logout destroys session cookie.");

    console.log("\n==========================================================");
    console.log("=== ALL PHASE 3.1 REACT FOUNDATION TESTS PASSED (21/21) ===");
    console.log("==========================================================");
  } finally {
    server.close();
    if (testUsers.length > 0) {
      await User.deleteMany({ _id: { $in: testUsers } });
    }
    await mongoose.disconnect();
  }
}

runPhase3ReactFoundationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Phase 3.1 React Foundation Test Failed:", err);
    process.exit(1);
  });
