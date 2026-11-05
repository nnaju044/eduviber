import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Progress from "../models/Progress.js";

import { connectTestDB, assertTestDatabaseIsolation, getTestDatabaseUri } from "../config/testDbGuard.js";

const TEST_DB_URI = getTestDatabaseUri();

const TIMESTAMP = Date.now();
const testUsers = [];
const testCourses = [];
const testLessons = [];
const testPayments = [];
const testEnrollments = [];

function apiRequest(server, options, body = null, cookie = null, csrfToken = null) {
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
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    const rawCookie = res.headers["set-cookie"];
                    const sessionCookie = rawCookie ? rawCookie[0].split(";")[0] : cookie;
                    let parsed = null;
                    try {
                        parsed = JSON.parse(data);
                    } catch {
                        parsed = data;
                    }
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsed,
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

async function runPhase2ApiTests() {
    console.log("==========================================================");
    console.log("=== RUNNING PHASE 2 RESTFUL JSON API TEST SUITE ===");
    console.log("==========================================================");

    await connectTestDB();
    assertTestDatabaseIsolation(mongoose);
    console.log(`✓ Connected to isolated test database: [${mongoose.connection.name}]`);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    console.log(`✓ Application server listening at http://127.0.0.1:${port}`);

    try {
        const defaultPassword = "TestPassword1234!";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // 1. Seed Super Admin
        const superAdmin = await User.create({
            name: "Phase2 Super Admin",
            email: `p2-admin-${TIMESTAMP}@example.com`,
            phone: "9000000001",
            passwordHash,
            role: "super_admin",
            isActive: true,
            mustChangePassword: false,
        });
        testUsers.push(superAdmin._id);

        // 2. Seed Approved Teacher A
        const teacherA = await User.create({
            name: "Teacher Alpha",
            email: `teacher-a-${TIMESTAMP}@example.com`,
            phone: "9000000002",
            passwordHash,
            role: "teacher",
            isActive: true,
            mustChangePassword: false,
            teacherProfile: {
                headline: "Full-Stack Security Architect",
                bio: "Expert in microservices and distributed systems",
                payoutUpiId: "teacher-a@upi",
                commissionRate: 0.20,
                isApproved: true,
                approvedAt: new Date(),
                approvedBy: superAdmin._id,
            },
        });
        testUsers.push(teacherA._id);

        // 3. Seed Approved Teacher B
        const teacherB = await User.create({
            name: "Teacher Beta",
            email: `teacher-b-${TIMESTAMP}@example.com`,
            phone: "9000000003",
            passwordHash,
            role: "teacher",
            isActive: true,
            mustChangePassword: false,
            teacherProfile: {
                headline: "Mobile & DevOps Specialist",
                bio: "Cloud infrastructure educator",
                payoutUpiId: "teacher-b@upi",
                commissionRate: 0.15,
                isApproved: true,
                approvedAt: new Date(),
                approvedBy: superAdmin._id,
            },
        });
        testUsers.push(teacherB._id);

        // 4. Seed Unapproved Teacher C
        const teacherUnapproved = await User.create({
            name: "Teacher Gamma (Unapproved)",
            email: `teacher-gamma-${TIMESTAMP}@example.com`,
            phone: "9000000004",
            passwordHash,
            role: "teacher",
            isActive: true,
            mustChangePassword: false,
            teacherProfile: {
                headline: "Junior Educator",
                bio: "Pending review",
                commissionRate: 0.20,
                isApproved: false,
            },
        });
        testUsers.push(teacherUnapproved._id);

        // 5. Seed Student One and Student Two
        const student1 = await User.create({
            name: "Student Alpha",
            email: `student1-${TIMESTAMP}@example.com`,
            phone: "9000000005",
            passwordHash,
            role: "student",
            isActive: true,
            mustChangePassword: false,
        });
        testUsers.push(student1._id);

        const student2 = await User.create({
            name: "Student Beta",
            email: `student2-${TIMESTAMP}@example.com`,
            phone: "9000000006",
            passwordHash,
            role: "student",
            isActive: true,
            mustChangePassword: false,
        });
        testUsers.push(student2._id);

        // 6. Seed Teacher A Course & Lesson
        const courseA = await Course.create({
            title: `Cloud Architecture with Alpha ${TIMESTAMP}`,
            slug: `cloud-alpha-${TIMESTAMP}`,
            description: "Advanced distributed systems course",
            price: 1500,
            thumbnail: "https://example.com/alpha.jpg",
            instructor: teacherA.name,
            ownerId: teacherA._id,
            isPublished: true,
        });
        testCourses.push(courseA._id);

        const lessonA1 = await Lesson.create({
            courseId: courseA._id,
            title: "Lesson A1: Microservices Intro",
            moduleName: "Module 1",
            bunnyVideoId: "12345678-1234-1234-1234-123456789012",
            durationMinutes: 15,
            order: 1,
            isPublished: true,
        });
        testLessons.push(lessonA1._id);

        // 7. Seed Teacher B Course & Lesson
        const courseB = await Course.create({
            title: `Kubernetes with Beta ${TIMESTAMP}`,
            slug: `k8s-beta-${TIMESTAMP}`,
            description: "Container orchestration masterclass",
            price: 2500,
            thumbnail: "https://example.com/beta.jpg",
            instructor: teacherB.name,
            ownerId: teacherB._id,
            isPublished: true,
        });
        testCourses.push(courseB._id);

        const lessonB1 = await Lesson.create({
            courseId: courseB._id,
            title: "Lesson B1: Pods & Deployments",
            moduleName: "Core Concepts",
            bunnyVideoId: "87654321-4321-4321-4321-210987654321",
            durationMinutes: 20,
            order: 1,
            isPublished: true,
        });
        testLessons.push(lessonB1._id);

        // ======================================================================
        // 1. AUTHENTICATION & CSRF TESTS
        // ======================================================================

        // Test 1.1: Anonymous request to /api/auth/me returns 401 UNAUTHORIZED
        const anonRes = await apiRequest(server, { path: "/api/auth/me" });
        assert.equal(anonRes.status, 401, "Anonymous request must receive HTTP 401");
        assert.equal(anonRes.body.success, false);
        assert.equal(anonRes.body.code, "UNAUTHORIZED");
        console.log("✓ TEST 1.1 PASSED: Anonymous request to /api/auth/me rejected with 401 UNAUTHORIZED.");

        // Test 1.2: GET /api/csrf-token returns valid token and session cookie
        const csrfRes = await apiRequest(server, { path: "/api/csrf-token" });
        assert.equal(csrfRes.status, 200);
        assert.equal(csrfRes.body.success, true);
        assert.ok(csrfRes.body.data.csrfToken, "Response must include csrfToken");
        assert.ok(csrfRes.cookie, "Response must establish session cookie");
        const initialCookie = csrfRes.cookie;
        const initialCsrfToken = csrfRes.body.data.csrfToken;
        console.log("✓ TEST 1.2 PASSED: GET /api/csrf-token provides valid token and session cookie.");

        // Test 1.3: POST /api/auth/login without CSRF token returns 403
        const loginNoCsrf = await apiRequest(
            server,
            { path: "/api/auth/login", method: "POST" },
            { email: student1.email, password: defaultPassword },
            initialCookie,
            null // No CSRF header
        );
        assert.equal(loginNoCsrf.status, 403, "POST /api/auth/login without CSRF must return HTTP 403");
        console.log("✓ TEST 1.3 PASSED: POST /api/auth/login without CSRF token rejected with HTTP 403.");

        // Test 1.4: POST /api/auth/login with valid CSRF token authenticates user
        const loginRes = await apiRequest(
            server,
            { path: "/api/auth/login", method: "POST" },
            { email: student1.email, password: defaultPassword },
            initialCookie,
            initialCsrfToken
        );
        assert.equal(loginRes.status, 200, "Valid login must return HTTP 200");
        assert.equal(loginRes.body.success, true);
        assert.equal(loginRes.body.data.user.email, student1.email);
        const studentCookie = loginRes.cookie;
        const studentCsrf = loginRes.body.data.csrfToken;
        console.log("✓ TEST 1.4 PASSED: POST /api/auth/login authenticates student and regenerates CSRF token.");

        // Helper to login any user and get cookie + csrfToken
        async function authenticateUser(email, password) {
            const tokenRes = await apiRequest(server, { path: "/api/csrf-token" });
            const cookie = tokenRes.cookie;
            const csrf = tokenRes.body.data.csrfToken;
            const authRes = await apiRequest(
                server,
                { path: "/api/auth/login", method: "POST" },
                { email, password },
                cookie,
                csrf
            );
            return {
                cookie: authRes.cookie,
                csrfToken: authRes.body.data.csrfToken,
                user: authRes.body.data.user,
            };
        }

        const superAdminAuth = await authenticateUser(superAdmin.email, defaultPassword);
        const teacherAAuth = await authenticateUser(teacherA.email, defaultPassword);
        const teacherBAuth = await authenticateUser(teacherB.email, defaultPassword);
        const teacherUnapprovedAuth = await authenticateUser(teacherUnapproved.email, defaultPassword);

        // Test 1.5: GET /api/auth/me returns session profile for authenticated user
        const meRes = await apiRequest(server, { path: "/api/auth/me" }, null, studentCookie);
        assert.equal(meRes.status, 200);
        assert.equal(meRes.body.data.user.email, student1.email);
        console.log("✓ TEST 1.5 PASSED: GET /api/auth/me returns authenticated user session profile.");

        // ======================================================================
        // 2. SUPER ADMIN API TESTS
        // ======================================================================

        // Test 2.1: Super Admin lists teachers
        const adminTeachersRes = await apiRequest(server, { path: "/api/admin/teachers" }, null, superAdminAuth.cookie);
        assert.equal(adminTeachersRes.status, 200);
        assert.ok(Array.isArray(adminTeachersRes.body.data.teachers));
        console.log("✓ TEST 2.1 PASSED: Super Admin successfully lists all teachers via JSON API.");

        // Test 2.2: Super Admin creates a new teacher account
        const newTeacherPayload = {
            name: "Teacher Delta Created By Admin",
            email: `teacher-delta-${TIMESTAMP}@example.com`,
            phone: "9887766554",
            password: "TempTeacherPass1234!",
            headline: "AI & Machine Learning Lead",
            commissionRate: 0.18,
            isApproved: false,
        };
        const createTeacherRes = await apiRequest(
            server,
            { path: "/api/admin/teachers", method: "POST" },
            newTeacherPayload,
            superAdminAuth.cookie,
            superAdminAuth.csrfToken
        );
        assert.equal(createTeacherRes.status, 201);
        assert.equal(createTeacherRes.body.data.teacher.email, newTeacherPayload.email);
        const createdTeacherId = createTeacherRes.body.data.teacher.id;
        testUsers.push(new mongoose.Types.ObjectId(createdTeacherId));
        console.log("✓ TEST 2.2 PASSED: Super Admin provisions new teacher account via JSON API.");

        // Test 2.3: Super Admin approves the newly created teacher
        const approveTeacherRes = await apiRequest(
            server,
            { path: `/api/admin/teachers/${createdTeacherId}/approve`, method: "POST" },
            {},
            superAdminAuth.cookie,
            superAdminAuth.csrfToken
        );
        assert.equal(approveTeacherRes.status, 200);
        assert.equal(approveTeacherRes.body.data.teacher.isApproved, true);
        console.log("✓ TEST 2.3 PASSED: Super Admin approves teacher account.");

        // Test 2.4: Super Admin suspends and reactivates a teacher
        const toggleTeacherRes = await apiRequest(
            server,
            { path: `/api/admin/teachers/${createdTeacherId}/toggle-status`, method: "POST" },
            {},
            superAdminAuth.cookie,
            superAdminAuth.csrfToken
        );
        assert.equal(toggleTeacherRes.status, 200);
        assert.equal(toggleTeacherRes.body.data.teacher.isActive, false);
        console.log("✓ TEST 2.4 PASSED: Super Admin suspends teacher account.");

        // ======================================================================
        // 3. TEACHER BACKEND & TENANT ISOLATION TESTS (CRITICAL)
        // ======================================================================

        // Test 3.1: Unapproved teacher is rejected on /api/teacher/courses
        const unapprovedTeacherRes = await apiRequest(
            server,
            { path: "/api/teacher/courses" },
            null,
            teacherUnapprovedAuth.cookie
        );
        assert.equal(unapprovedTeacherRes.status, 403);
        assert.equal(unapprovedTeacherRes.body.code, "TEACHER_NOT_APPROVED");
        console.log("✓ TEST 3.1 PASSED: Unapproved teacher rejected on /api/teacher/* with TEACHER_NOT_APPROVED.");

        // Test 3.2: Teacher A lists own courses and only sees Course A (never Course B)
        const teacherACoursesRes = await apiRequest(
            server,
            { path: "/api/teacher/courses" },
            null,
            teacherAAuth.cookie
        );
        assert.equal(teacherACoursesRes.status, 200);
        const teacherACourseList = teacherACoursesRes.body.data.courses;
        assert.ok(teacherACourseList.some((c) => c.id === courseA._id.toString()), "Teacher A must see Course A");
        assert.ok(!teacherACourseList.some((c) => c.id === courseB._id.toString()), "Teacher A must NEVER see Course B in own list");
        console.log("✓ TEST 3.2 PASSED: Teacher A course list strictly scoped to own courses (Course B concealed).");

        // Test 3.3: IDOR Attack — Teacher A attempts to GET Teacher B's course details -> 403
        const idorGetCourse = await apiRequest(
            server,
            { path: `/api/teacher/courses/${courseB._id}` },
            null,
            teacherAAuth.cookie
        );
        assert.equal(idorGetCourse.status, 403, "Teacher A must receive 403 when trying to access Teacher B's course");
        assert.equal(idorGetCourse.body.code, "FORBIDDEN");
        console.log("✓ TEST 3.3 PASSED: IDOR defense: Teacher A cannot GET Teacher B's course details (HTTP 403).");

        // Test 3.4: IDOR Attack — Teacher A attempts to UPDATE Teacher B's course -> 403
        const idorUpdateCourse = await apiRequest(
            server,
            { path: `/api/teacher/courses/${courseB._id}`, method: "PATCH" },
            { title: "Hacked Course Title" },
            teacherAAuth.cookie,
            teacherAAuth.csrfToken
        );
        assert.equal(idorUpdateCourse.status, 403, "Teacher A must receive 403 when trying to mutate Teacher B's course");
        console.log("✓ TEST 3.4 PASSED: IDOR defense: Teacher A cannot UPDATE Teacher B's course (HTTP 403).");

        // Test 3.5: IDOR Attack — Teacher A attempts to DELETE Teacher B's course -> 403
        const idorDeleteCourse = await apiRequest(
            server,
            { path: `/api/teacher/courses/${courseB._id}`, method: "DELETE" },
            {},
            teacherAAuth.cookie,
            teacherAAuth.csrfToken
        );
        assert.equal(idorDeleteCourse.status, 403, "Teacher A must receive 403 when trying to delete Teacher B's course");
        console.log("✓ TEST 3.5 PASSED: IDOR defense: Teacher A cannot DELETE Teacher B's course (HTTP 403).");

        // Test 3.6: IDOR Attack — Teacher A attempts to create a lesson inside Teacher B's course -> 403
        const idorCreateLesson = await apiRequest(
            server,
            { path: `/api/teacher/courses/${courseB._id}/lessons`, method: "POST" },
            {
                title: "Malicious Injected Lesson",
                moduleName: "Exploits",
                bunnyVideoId: "99999999-9999-9999-9999-999999999999",
                durationMinutes: 10,
            },
            teacherAAuth.cookie,
            teacherAAuth.csrfToken
        );
        assert.equal(idorCreateLesson.status, 403, "Teacher A must receive 403 when trying to add a lesson to Teacher B's course");
        console.log("✓ TEST 3.6 PASSED: IDOR defense: Teacher A cannot create lessons inside Teacher B's course (HTTP 403).");

        // Test 3.7: IDOR Attack — Teacher A attempts to update Teacher B's lesson -> 403
        const idorUpdateLesson = await apiRequest(
            server,
            { path: `/api/teacher/courses/${courseB._id}/lessons/${lessonB1._id}`, method: "PATCH" },
            { title: "Defaced Lesson Title" },
            teacherAAuth.cookie,
            teacherAAuth.csrfToken
        );
        assert.equal(idorUpdateLesson.status, 403, "Teacher A must receive 403 when trying to edit Teacher B's lesson");
        console.log("✓ TEST 3.7 PASSED: IDOR defense: Teacher A cannot edit Teacher B's lesson (HTTP 403).");

        // Test 3.8: Forged ownerId override attempt — Teacher A creates a course trying to assign ownerId to Teacher B
        const spoofedCourseRes = await apiRequest(
            server,
            { path: "/api/teacher/courses", method: "POST" },
            {
                title: `Alpha Advanced Security ${TIMESTAMP}`,
                description: "Clean test course",
                price: 1800,
                ownerId: teacherB._id.toString(), // Forged owner
            },
            teacherAAuth.cookie,
            teacherAAuth.csrfToken
        );
        assert.equal(spoofedCourseRes.status, 201);
        const createdCourse = await Course.findById(spoofedCourseRes.body.data.course.id);
        testCourses.push(createdCourse._id);
        assert.equal(
            createdCourse.ownerId.toString(),
            teacherA._id.toString(),
            "Course ownerId MUST strictly equal authenticated Teacher A's ID, ignoring forged browser ownerId"
        );
        console.log("✓ TEST 3.8 PASSED: Forged ownerId in course creation ignored; server strictly assigns authenticated teacher.");

        // Test 3.9: Privilege Escalation Defense — Teacher cannot modify own approval status or commission rate
        const profileTamperRes = await apiRequest(
            server,
            { path: "/api/teacher/profile", method: "PATCH" },
            {
                headline: "Legitimate Updated Headline",
                commissionRate: 0.01, // Attempt to pay only 1% platform commission
                isApproved: true,
                role: "super_admin", // Attempt to escalate to super_admin
            },
            teacherAAuth.cookie,
            teacherAAuth.csrfToken
        );
        assert.equal(profileTamperRes.status, 200);
        const refreshedTeacherA = await User.findById(teacherA._id).lean();
        assert.equal(refreshedTeacherA.teacherProfile.headline, "Legitimate Updated Headline");
        assert.equal(refreshedTeacherA.role, "teacher", "Role must not be changed by teacher profile endpoint");
        assert.equal(refreshedTeacherA.teacherProfile.commissionRate, 0.20, "Commission rate must not be altered by teacher");
        console.log("✓ TEST 3.9 PASSED: Teacher cannot modify own role or commission rate via profile update.");

        // Test 3.10: Financial Restriction — Teacher cannot access /api/admin/payments endpoints -> 403
        const teacherAdminPayRes = await apiRequest(
            server,
            { path: "/api/admin/payments" },
            null,
            teacherAAuth.cookie
        );
        assert.equal(teacherAdminPayRes.status, 403, "Teacher accessing admin payments must receive HTTP 403");
        console.log("✓ TEST 3.10 PASSED: Teacher strictly barred from payment management APIs (HTTP 403).");

        // ======================================================================
        // 4. STUDENT API & PAYMENT INTEGRATION TESTS
        // ======================================================================

        // Test 4.1: Student 1 submits payment proof for Course A via /api/student/courses/:slug/enroll
        const enrollRes = await apiRequest(
            server,
            { path: `/api/student/courses/${courseA.slug}/enroll`, method: "POST" },
            {
                transactionReference: `UTR-STUDENT-API-${TIMESTAMP}`,
                proofUrl: "https://drive.google.com/file/d/test-student/view",
                ownerId: superAdmin._id.toString(), // Forged owner
                amount: 1, // Forged amount
            },
            studentCookie,
            studentCsrf
        );
        assert.equal(enrollRes.status, 201);
        const submittedPaymentId = enrollRes.body.data.payment.id;
        const submittedPayment = await Payment.findById(submittedPaymentId);
        testPayments.push(submittedPayment._id);

        assert.equal(submittedPayment.ownerId.toString(), teacherA._id.toString(), "Payment ownerId must strictly derive from course.ownerId");
        assert.equal(submittedPayment.amount, 1500, "Payment amount must strictly derive from course.price (1500), not forged amount (1)");
        assert.equal(submittedPayment.status, "pending");

        const studentEnrollment = await Enrollment.findOne({ userId: student1._id, courseId: courseA._id });
        testEnrollments.push(studentEnrollment._id);
        assert.equal(studentEnrollment.status, "pending", "Enrollment must remain pending on submission");
        console.log("✓ TEST 4.1 PASSED: Student payment submission records correct ownerId, price, and pending status.");

        // Test 4.2: Student 1 cannot watch lesson while enrollment is pending -> 403
        const unapprovedWatchRes = await apiRequest(
            server,
            { path: `/api/student/courses/${courseA._id}/lessons/${lessonA1._id}/playback` },
            null,
            studentCookie
        );
        assert.equal(unapprovedWatchRes.status, 403, "Student with pending enrollment must receive 403 for paid lesson");
        console.log("✓ TEST 4.2 PASSED: Student cannot watch paid lesson before payment approval (HTTP 403).");

        // Test 4.3: Super Admin approves payment via /api/admin/payments/:id/approve
        const adminApproveRes = await apiRequest(
            server,
            { path: `/api/admin/payments/${submittedPayment._id}/approve`, method: "POST" },
            {},
            superAdminAuth.cookie,
            superAdminAuth.csrfToken
        );
        assert.equal(adminApproveRes.status, 200);
        assert.equal(adminApproveRes.body.data.payment.status, "approved");
        const snapshot = adminApproveRes.body.data.payment.financialSnapshot;
        assert.equal(snapshot.coursePrice, 1500);
        assert.equal(snapshot.commissionRate, 0.20);
        assert.equal(snapshot.platformCommission, 300); // 1500 * 0.20
        assert.equal(snapshot.teacherShare, 1200); // 1500 - 300
        console.log("✓ TEST 4.3 PASSED: Super Admin approves payment via JSON API; financial snapshot calculated accurately.");

        // Test 4.4: Student 1 now accesses lesson playback; receives signed embed URL and watermarking info
        const approvedWatchRes = await apiRequest(
            server,
            { path: `/api/student/courses/${courseA._id}/lessons/${lessonA1._id}/playback` },
            null,
            studentCookie
        );
        assert.equal(approvedWatchRes.status, 200);
        assert.ok(approvedWatchRes.body.data.playback.embedUrl.includes("token="), "Must return signed Bunny embed URL");
        assert.ok(approvedWatchRes.body.data.watermark.text.includes(student1.email), "Must provide dynamic watermark text");
        console.log("✓ TEST 4.4 PASSED: Student access granted upon approval; signed Bunny embed URL and watermark payload returned.");

        // Test 4.5: Student 1 updates playback progress
        const saveProgressRes = await apiRequest(
            server,
            { path: `/api/student/courses/${courseA._id}/lessons/${lessonA1._id}/progress`, method: "POST" },
            { position: 450, completed: true },
            studentCookie,
            studentCsrf
        );
        assert.equal(saveProgressRes.status, 200);
        assert.equal(saveProgressRes.body.data.progress.completed, true);
        console.log("✓ TEST 4.5 PASSED: Student saves lesson playback progress successfully.");

        // Test 4.6: Teacher Isolation on Student Progress:
        // Teacher A CAN view Student 1 progress on Course A
        const teacherAStudentProg = await apiRequest(
            server,
            { path: `/api/teacher/courses/${courseA._id}/students/${student1._id}/progress` },
            null,
            teacherAAuth.cookie
        );
        assert.equal(teacherAStudentProg.status, 200);
        assert.equal(teacherAStudentProg.body.data.stats.completedLessons, 1);

        // Teacher B CANNOT view Student 1 progress on Course A (HTTP 403)
        const teacherBIdorStudentProg = await apiRequest(
            server,
            { path: `/api/teacher/courses/${courseA._id}/students/${student1._id}/progress` },
            null,
            teacherBAuth.cookie
        );
        assert.equal(teacherBIdorStudentProg.status, 403, "Teacher B must receive 403 when trying to access Course A student progress");
        console.log("✓ TEST 4.6 PASSED: Cross-teacher student progress isolation verified (Teacher B rejected with 403).");

        // ======================================================================
        // 5. PUBLIC DISCOVERY API TESTS
        // ======================================================================

        // Test 5.1: Public course catalog lists published courses
        const pubCoursesRes = await apiRequest(server, { path: "/api/public/courses" });
        assert.equal(pubCoursesRes.status, 200);
        assert.ok(Array.isArray(pubCoursesRes.body.data.courses));
        assert.ok(pubCoursesRes.body.data.courses.some((c) => c.slug === courseA.slug));
        console.log("✓ TEST 5.1 PASSED: GET /api/public/courses returns published course catalog.");

        // Test 5.2: Public course details returns public syllabus and conceals bunnyVideoId
        const pubCourseDetailRes = await apiRequest(server, { path: `/api/public/courses/${courseA.slug}` });
        assert.equal(pubCourseDetailRes.status, 200);
        assert.equal(pubCourseDetailRes.body.data.course.slug, courseA.slug);
        const syllabus = pubCourseDetailRes.body.data.syllabus;
        assert.ok(syllabus.length > 0);
        assert.equal(syllabus[0].bunnyVideoId, undefined, "Public syllabus must NEVER leak internal bunnyVideoId");
        console.log("✓ TEST 5.2 PASSED: GET /api/public/courses/:slug returns syllabus while strictly concealing video IDs.");

        // Test 5.3: Public teacher directory lists approved teachers and hides unapproved teachers
        const pubTeachersRes = await apiRequest(server, { path: "/api/public/teachers" });
        assert.equal(pubTeachersRes.status, 200);
        const pubTeacherList = pubTeachersRes.body.data.teachers;
        assert.ok(pubTeacherList.some((t) => t.id === teacherA._id.toString()), "Teacher A must appear in public directory");
        assert.ok(!pubTeacherList.some((t) => t.id === teacherUnapproved._id.toString()), "Unapproved Teacher Gamma must NOT appear in public directory");
        console.log("✓ TEST 5.3 PASSED: GET /api/public/teachers lists approved teachers and conceals unapproved teachers.");

        // ======================================================================
        // 6. FINANCIAL IMMUTABILITY VERIFICATION (HARDENED REPLACES & BULKWRITES)
        // ======================================================================

        // Test 6.1: Attempting to overwrite financialSnapshot via replaceOne is blocked
        let replaceThrew = false;
        try {
            await Payment.replaceOne(
                { _id: submittedPayment._id },
                {
                    userId: student1._id,
                    courseId: courseA._id,
                    ownerId: teacherA._id,
                    amount: 1500,
                    status: "approved",
                    transactionReference: "UTR-TAMPER",
                    financialSnapshot: { teacherShare: 999999 },
                }
            );
        } catch (err) {
            replaceThrew = true;
            assert.ok(err.message.includes("immutable"));
        }
        assert.ok(replaceThrew, "replaceOne must be blocked from mutating financialSnapshot");
        console.log("✓ TEST 6.1 PASSED: Payment.replaceOne immutability guard strictly blocks replacement mutations.");

        // Test 6.2: Attempting to mutate financialSnapshot via Model.bulkWrite is blocked
        let bulkThrew = false;
        try {
            await Payment.bulkWrite([
                {
                    updateOne: {
                        filter: { _id: submittedPayment._id },
                        update: { $set: { "financialSnapshot.teacherShare": 999999 } },
                    },
                },
            ]);
        } catch (err) {
            bulkThrew = true;
            assert.ok(err.message.includes("immutable"));
        }
        assert.ok(bulkThrew, "bulkWrite must be blocked from mutating financialSnapshot");
        console.log("✓ TEST 6.2 PASSED: Payment.bulkWrite immutability guard strictly blocks batch mutations.");

        console.log("\n==========================================================");
        console.log("=== ALL PHASE 2 RESTFUL API TESTS PASSED SUCCESSFULLY! ===");
        console.log("==========================================================");
    } finally {
        server.close();
        if (testUsers.length > 0) await User.deleteMany({ _id: { $in: testUsers } });
        if (testCourses.length > 0) await Course.deleteMany({ _id: { $in: testCourses } });
        if (testLessons.length > 0) await Lesson.deleteMany({ _id: { $in: testLessons } });
        if (testPayments.length > 0) await Payment.deleteMany({ _id: { $in: testPayments } });
        if (testEnrollments.length > 0) await Enrollment.deleteMany({ _id: { $in: testEnrollments } });
        await mongoose.disconnect();
    }
}

runPhase2ApiTests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n❌ Phase 2 API Test Suite Failed:", err);
        process.exit(1);
    });
