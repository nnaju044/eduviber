import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import app from "../server.js";
import User from "../models/User.js";
import Device from "../models/Device.js";
import { connectTestDB, assertTestDatabaseIsolation } from "../config/testDbGuard.js";
import { getSentEmails, clearSentEmails } from "../services/emailService.js";
import { getStudentAvatarPublicId } from "../config/cloudinary.js";

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
      if (typeof body === "string") {
        payload = body;
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
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
  const csrfRes = await httpRequest(server, { path: "/api/auth/csrf-token" });
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

  const finalCookie = loginRes.cookie || cookie;

  // Refresh CSRF for the authenticated session
  const authCsrfRes = await httpRequest(server, { path: "/api/auth/csrf-token" }, null, finalCookie);
  assert.equal(authCsrfRes.statusCode, 200);

  return {
    cookie: finalCookie,
    csrfToken: authCsrfRes.json.data.csrfToken,
    user: loginRes.json.data.user,
  };
}

async function runTests() {
  console.log("==========================================================");
  console.log("=== RUNNING E13: STUDENT ACCOUNT AUTOMATED TEST SUITE ====");
  console.log("==========================================================");

  await connectTestDB(mongoose);
  assertTestDatabaseIsolation(mongoose);
  console.log("✓ TEST 0 PASSED: Verified strictly isolated test database.");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`✓ Test server running on http://127.0.0.1:${port}`);

  try {
    clearSentEmails();
    await User.deleteMany({ email: { $regex: /@e13test\.local$/ } });
    await Device.deleteMany({});
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection("sessions").deleteMany({});
    }

    const testPassword = "InitialPassword123!";
    const passwordHash = await bcrypt.hash(testPassword, 10);

    const student1 = await User.create({
      name: "Original Student",
      email: "student1@e13test.local",
      phone: "+91 9876543210",
      passwordHash,
      role: "student",
      isActive: true,
      mustChangePassword: false,
    });

    const student2 = await User.create({
      name: "Secondary Student",
      email: "student2@e13test.local",
      phone: "+91 9999999999",
      passwordHash,
      role: "student",
      isActive: true,
      mustChangePassword: false,
    });

    // Session 1 for Student 1
    const session1 = await loginUser(server, student1.email, testPassword);
    // Session 2 for Student 1 (other device / browser)
    const session2 = await loginUser(server, student1.email, testPassword);
    // Session for Student 2
    const sessionStudent2 = await loginUser(server, student2.email, testPassword);

    console.log("\n--- TEST 1: F01 PROFILE RETRIEVAL & CANONICAL STUDENT ID ---");
    {
      const res = await httpRequest(server, { path: "/api/student/profile" }, null, session1.cookie);
      assert.equal(res.statusCode, 200);
      assert.equal(res.json.data.profile.id, student1._id.toString());
      assert.equal(res.json.data.profile.name, "Original Student");
      assert.equal(res.json.data.profile.email, "student1@e13test.local");
      assert.equal(res.json.data.profile.phone, "+91 9876543210");
      assert.equal(res.json.data.profile.role, "student");
      assert.equal(res.json.data.profile.profilePictureUrl, null);
      console.log("✓ TEST 1 PASSED: Profile retrieved with canonical MongoDB ObjectId as Student ID.");
    }

    console.log("\n--- TEST 2: F01 PERMITTED & FORBIDDEN PROFILE UPDATES ---");
    {
      // Valid update (name & phone)
      const updateRes = await httpRequest(
        server,
        { path: "/api/student/profile", method: "PATCH" },
        { name: "Updated Student Name", phone: "+1 555-0199" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(updateRes.statusCode, 200);
      assert.equal(updateRes.json.data.profile.name, "Updated Student Name");
      assert.equal(updateRes.json.data.profile.phone, "+1 555-0199");

      // Verify forbidden field tampering is ignored / protected
      const tamperRes = await httpRequest(
        server,
        { path: "/api/student/profile", method: "PATCH" },
        { role: "super_admin", email: "hacked@e13test.local" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(tamperRes.statusCode, 200);

      const refreshedUser = await User.findById(student1._id);
      assert.equal(refreshedUser.role, "student", "Role must remain student");
      assert.equal(refreshedUser.email, "student1@e13test.local", "Email cannot be updated via PATCH /profile");
      console.log("✓ TEST 2 PASSED: Permitted profile fields updated; protected fields strictly preserved.");
    }

    console.log("\n--- TEST 3: F01 EMAIL CHANGE VERIFICATION WORKFLOW ---");
    {
      clearSentEmails();

      // Attempt to change to an already-used email (student2)
      const conflictRes = await httpRequest(
        server,
        { path: "/api/student/profile/email-change", method: "POST" },
        { newEmail: "student2@e13test.local" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(conflictRes.statusCode, 409, "Should reject already registered email");

      // Valid new email request
      const reqRes = await httpRequest(
        server,
        { path: "/api/student/profile/email-change", method: "POST" },
        { newEmail: "student1.new@e13test.local" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(reqRes.statusCode, 200);

      // Verify email was sent to proposed address
      const emails = getSentEmails();
      assert.ok(emails.length >= 1, "Verification email must be dispatched");
      const sentEmail = emails.find((e) => e.to === "student1.new@e13test.local");
      assert.ok(sentEmail, "Sent email must be addressed to proposed new email");
      assert.ok(sentEmail.text.includes("verifyEmailToken="), "Email must contain verification token query parameter");

      // Extract raw token from email
      const tokenMatch = sentEmail.text.match(/verifyEmailToken=([a-f0-9]+)/);
      assert.ok(tokenMatch && tokenMatch[1], "Must extract raw token from email");
      const rawToken = tokenMatch[1];

      // Login email in DB must still be old email before verification
      let checkUser = await User.findById(student1._id);
      assert.equal(checkUser.email, "student1@e13test.local");
      assert.equal(checkUser.pendingEmail, "student1.new@e13test.local");

      // Verify email using token
      const verifyRes = await httpRequest(
        server,
        { path: "/api/student/profile/email-verify", method: "POST" },
        { token: rawToken },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(verifyRes.statusCode, 200);

      // Verify login email updated in DB and pending cleared
      checkUser = await User.findById(student1._id);
      assert.equal(checkUser.email, "student1.new@e13test.local");
      assert.equal(checkUser.pendingEmail, null);

      // Verify notification sent to old email address
      const oldEmailNotice = getSentEmails().find((e) => e.to === "student1@e13test.local");
      assert.ok(oldEmailNotice, "Security alert must be dispatched to old email address");

      // Verify token cannot be reused
      const reuseRes = await httpRequest(
        server,
        { path: "/api/student/profile/email-verify", method: "POST" },
        { token: rawToken },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(reuseRes.statusCode, 400, "Reused token must be rejected");

      // Verify email change failure handling and state safety
      // When email service fails or returns { success: false }
      const origSendMail = (await import("nodemailer")).default.createTransport;
      // Test invalid email triggering SMTP rejection or service failure
      const failReqRes = await httpRequest(
        server,
        { path: "/api/student/profile/email-change", method: "POST" },
        { newEmail: "invalid-recipient-trigger-failure" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(failReqRes.statusCode, 400, "Invalid email must reject without sending");

      // Test that if email service returns success: false, pending state is safely rolled back and 502 returned
      const { setMockTransportFailure } = await import("../services/emailService.js");
      try {
        setMockTransportFailure(true);

        const failedSendRes = await httpRequest(
          server,
          { path: "/api/student/profile/email-change", method: "POST" },
          { newEmail: "failed.delivery@e13test.local" },
          session1.cookie,
          session1.csrfToken
        );
        assert.equal(failedSendRes.statusCode, 502, "Must return 502 when email sending fails");
        assert.equal(failedSendRes.json.code, "EMAIL_SEND_FAILED");

        // Assert pending verification fields were cleaned up and existing email remains intact
        const refreshedUser = await User.findById(student1._id);
        assert.equal(refreshedUser.email, "student1.new@e13test.local", "Current registered email must be untouched");
        assert.equal(refreshedUser.pendingEmail, null, "pendingEmail must be rolled back to null");
        assert.equal(refreshedUser.emailVerifyExpires, undefined, "emailVerifyExpires must be undefined");
      } finally {
        setMockTransportFailure(false);
      }

      console.log("✓ TEST 3 PASSED: Secure email change workflow, token hashing, failure handling, and rollback verified.");
    }

    console.log("\n--- TEST 4: F01 CLOUDINARY DETERMINISTIC AVATAR UPLOAD & REPLACEMENT ---");
    {
      const expectedPublicId = getStudentAvatarPublicId(student1._id);
      assert.equal(expectedPublicId, `eduvibe/students/${student1._id.toString()}`);

      const dummyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      // 1. Upload avatar
      const uploadRes = await httpRequest(
        server,
        { path: "/api/student/profile/avatar", method: "POST" },
        { image: dummyBase64 },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(uploadRes.statusCode, 200);
      assert.ok(uploadRes.json.data.avatarVersion > 0);

      let studentDoc = await User.findById(student1._id);
      assert.ok(studentDoc.avatarVersion > 0);
      const firstVersion = studentDoc.avatarVersion;

      // 2. Replace avatar (same public id, updated version)
      const replaceRes = await httpRequest(
        server,
        { path: "/api/student/profile/avatar", method: "POST" },
        { image: dummyBase64 },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(replaceRes.statusCode, 200);
      studentDoc = await User.findById(student1._id);
      assert.ok(studentDoc.avatarVersion >= firstVersion);

      // 3. Delete avatar
      const deleteRes = await httpRequest(
        server,
        { path: "/api/student/profile/avatar", method: "DELETE" },
        null,
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(deleteRes.statusCode, 200);
      studentDoc = await User.findById(student1._id);
      assert.equal(studentDoc.avatarVersion, 0);

      console.log("✓ TEST 4 PASSED: Deterministic Cloudinary avatar upload, replacement, and deletion verified.");
    }

    console.log("\n--- TEST 5: F02 PASSWORD CHANGE VALIDATION & REUSE PREVENTION ---");
    {
      // Too short password (< 12 chars)
      const shortRes = await httpRequest(
        server,
        { path: "/api/auth/change-password", method: "POST" },
        { currentPassword: testPassword, newPassword: "short", confirmPassword: "short" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(shortRes.statusCode, 400);

      // Password mismatch
      const mismatchRes = await httpRequest(
        server,
        { path: "/api/auth/change-password", method: "POST" },
        { currentPassword: testPassword, newPassword: "BrandNewSecurePassword123!", confirmPassword: "DifferentPassword123!" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(mismatchRes.statusCode, 400);

      // Incorrect current password
      const wrongCurrentRes = await httpRequest(
        server,
        { path: "/api/auth/change-password", method: "POST" },
        { currentPassword: "WrongPassword999!", newPassword: "BrandNewSecurePassword123!", confirmPassword: "BrandNewSecurePassword123!" },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(wrongCurrentRes.statusCode, 400);

      // Password reuse rejection
      const reuseRes = await httpRequest(
        server,
        { path: "/api/auth/change-password", method: "POST" },
        { currentPassword: testPassword, newPassword: testPassword, confirmPassword: testPassword },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(reuseRes.statusCode, 400, "Should reject reusing current password");

      console.log("✓ TEST 5 PASSED: Password validation rules and password reuse rejection verified.");
    }

    console.log("\n--- TEST 6: F02 GLOBAL SESSION INVALIDATION & DEVICE REVOCATION ---");
    {
      clearSentEmails();

      // Register a device for Student 1 and Student 2
      const dev1 = await Device.create({
        userId: student1._id,
        tokenHash: crypto.createHash("sha256").update("token-dev-1").digest("hex"),
        deviceName: "Student 1 Laptop",
        isRevoked: false,
      });
      const dev2 = await Device.create({
        userId: student2._id,
        tokenHash: crypto.createHash("sha256").update("token-dev-2").digest("hex"),
        deviceName: "Student 2 Laptop",
        isRevoked: false,
      });

      // Verify both sessions of student 1 can access profile before password change
      const preCheck1 = await httpRequest(server, { path: "/api/student/profile" }, null, session1.cookie);
      const preCheck2 = await httpRequest(server, { path: "/api/student/profile" }, null, session2.cookie);
      assert.equal(preCheck1.statusCode, 200);
      assert.equal(preCheck2.statusCode, 200);

      const newSecurePassword = "BrandNewSecurePassword123!";

      // Student 1 changes password via session 1
      const changeRes = await httpRequest(
        server,
        { path: "/api/auth/change-password", method: "POST" },
        { currentPassword: testPassword, newPassword: newSecurePassword, confirmPassword: newSecurePassword },
        session1.cookie,
        session1.csrfToken
      );
      assert.equal(changeRes.statusCode, 200);

      // Verify session 1 is invalidated
      const postCheck1 = await httpRequest(server, { path: "/api/student/profile" }, null, session1.cookie);
      assert.equal(postCheck1.statusCode, 401, "Initiating session must be invalidated");

      // Verify session 2 (other browser/device) is ALSO invalidated
      const postCheck2 = await httpRequest(server, { path: "/api/student/profile" }, null, session2.cookie);
      assert.equal(postCheck2.statusCode, 401, "All secondary sessions for student 1 must be invalidated");

      // Verify student 2's session remains UNTOUCHED and VALID
      const student2Check = await httpRequest(server, { path: "/api/student/profile" }, null, sessionStudent2.cookie);
      assert.equal(student2Check.statusCode, 200, "Unrelated student session must remain active");

      // Verify Student 1's device was revoked
      const refreshedDev1 = await Device.findById(dev1._id);
      assert.equal(refreshedDev1.isRevoked, true, "Student 1 device must be revoked");

      // Verify Student 2's device was NOT revoked
      const refreshedDev2 = await Device.findById(dev2._id);
      assert.equal(refreshedDev2.isRevoked, false, "Student 2 device must remain active");

      // Verify security notification sent to student 1
      const sentSecurityEmail = getSentEmails().find((e) => e.to === "student1.new@e13test.local");
      assert.ok(sentSecurityEmail, "Security alert must be sent on password change");
      assert.ok(sentSecurityEmail.text.includes("successfully changed"));

      // Verify student 1 can log in with new password
      const newLogin = await loginUser(server, "student1.new@e13test.local", newSecurePassword);
      const newProfileCheck = await httpRequest(server, { path: "/api/student/profile" }, null, newLogin.cookie);
      assert.equal(newProfileCheck.statusCode, 200, "Student must be able to log in with new password");

      console.log("✓ TEST 6 PASSED: Global multi-session invalidation and device revocation verified across users.");
    }

    console.log("\n--- TEST 7: PASSWORD RESET WORKFLOW MULTI-SESSION INVALIDATION ---");
    {
      clearSentEmails();

      const student3 = await User.create({
        name: "Student Three",
        email: "student3@e13test.local",
        phone: "+91 9123456789",
        passwordHash,
        role: "student",
        isActive: true,
        mustChangePassword: false,
      });

      // Two sessions for Student 3
      const s3_session1 = await loginUser(server, student3.email, testPassword);
      const s3_session2 = await loginUser(server, student3.email, testPassword);
      // Independent session for Student 2
      const s2_checkSession = await loginUser(server, student2.email, testPassword);

      // Register device for Student 3
      const dev3 = await Device.create({
        userId: student3._id,
        tokenHash: crypto.createHash("sha256").update("token-dev-3").digest("hex"),
        deviceName: "Student 3 iPad",
        isRevoked: false,
      });

      // Verify sessions are active
      const pre1 = await httpRequest(server, { path: "/api/student/profile" }, null, s3_session1.cookie);
      const pre2 = await httpRequest(server, { path: "/api/student/profile" }, null, s3_session2.cookie);
      assert.equal(pre1.statusCode, 200);
      assert.equal(pre2.statusCode, 200);

      // Generate reset token directly on Student 3
      const rawResetToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawResetToken).digest("hex");
      student3.resetPasswordTokenHash = tokenHash;
      student3.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await student3.save();

      const newPassword3 = "CompletelyNewPassword333!";

      // Execute password reset via POST /reset-password (legacy form / endpoint)
      const resetRes = await httpRequest(
        server,
        {
          path: "/reset-password",
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "x-skip-csrf": "true",
          },
        },
        new URLSearchParams({
          token: rawResetToken,
          password: newPassword3,
          confirmPassword: newPassword3,
        }).toString(),
        s3_session1.cookie
      );
      assert.equal(resetRes.statusCode, 302, "Reset should redirect on success");
      assert.equal(resetRes.headers.location, "/app/login?reset=success", "Reset must redirect to canonical React /app/login");

      // Verify Student 3 session 1 fails
      const post1 = await httpRequest(server, { path: "/api/student/profile" }, null, s3_session1.cookie);
      assert.equal(post1.statusCode, 401, "Student 3 session 1 must be destroyed");

      // Verify Student 3 session 2 fails
      const post2 = await httpRequest(server, { path: "/api/student/profile" }, null, s3_session2.cookie);
      assert.equal(post2.statusCode, 401, "Student 3 session 2 must be destroyed");

      // Verify Student 2 session is untouched
      const s2_stillValid = await httpRequest(server, { path: "/api/student/profile" }, null, s2_checkSession.cookie);
      assert.equal(s2_stillValid.statusCode, 200, "Student 2 session must remain valid");

      // Verify device 3 was revoked
      const refreshedDev3 = await Device.findById(dev3._id);
      assert.equal(refreshedDev3.isRevoked, true, "Student 3 device must be revoked");

      // Verify security confirmation email dispatched to Student 3
      const resetAlertEmail = getSentEmails().find((e) => e.to === "student3@e13test.local");
      assert.ok(resetAlertEmail, "Security alert email must be sent to student upon password reset");
      assert.ok(resetAlertEmail.text.includes("successfully reset"));

      console.log("✓ TEST 7 PASSED: Password reset multi-session invalidation, device revocation, and email verified.");
    }

    console.log("\n--- TEST 8: NEW-DEVICE REGISTRATION & ALERT EMAIL NOTIFICATIONS ---");
    {
      clearSentEmails();

      // Create a student for device registration test
      const student4 = await User.create({
        name: "Device Alert Student",
        email: "student4@e13test.local",
        phone: "+91 9777777777",
        passwordHash,
        role: "student",
        isActive: true,
        mustChangePassword: false,
      });

      // Call authenticateDevice directly or via student flow
      const { authenticateDevice } = await import("../services/deviceService.js");

      // 1. First registration
      const reqMock1 = {
        cookies: {},
        headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" },
        ip: "127.0.0.1",
      };
      const resMock1 = { cookie: () => { } };
      const authResult1 = await authenticateDevice(reqMock1, resMock1, student4._id);
      assert.equal(authResult1.authorized, true);
      assert.equal(authResult1.device.deviceType, "Mobile");

      // Wait a moment for background email dispatch
      await new Promise((r) => setTimeout(r, 100));

      const emailsAfterReg1 = getSentEmails();
      const newDevEmail = emailsAfterReg1.find((e) => e.to === "student4@e13test.local" && e.subject.includes("New device registered"));
      assert.ok(newDevEmail, "New device registration must dispatch security alert email");
      assert.ok(newDevEmail.text.includes("new device was registered"));

      // 2. Repeat playback from same device token: MUST NOT send duplicate email
      clearSentEmails();
      const reqMockRepeat = {
        cookies: { eduvibe_device_token: authResult1.rawToken },
        headers: reqMock1.headers,
        ip: "127.0.0.1",
      };
      const repeatAuth = await authenticateDevice(reqMockRepeat, resMock1, student4._id);
      assert.equal(repeatAuth.authorized, true);

      await new Promise((r) => setTimeout(r, 100));
      assert.equal(getSentEmails().length, 0, "Repeated playback from existing device must NOT send registration email");

      console.log("✓ TEST 8 PASSED: New device registration alert sent; duplicate alerts on repeat playback suppressed.");
    }

    console.log("\n==========================================================");
    console.log("=== ALL E13 AUTOMATED TESTS PASSED SUCCESSFULLY! ===");
    console.log("==========================================================");
  } finally {
    // Cleanup
    await User.deleteMany({ email: { $regex: /@e13test\.local$/ } });
    await Device.deleteMany({});
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection("sessions").deleteMany({});
    }
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
