import "dotenv/config";
import mongoose from "mongoose";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import adminRoutes from "../routes/adminRoutes.js";
import authRoutes from "../routes/authRoutes.js";
import studentRoutes from "../routes/studentRoutes.js";
import publicRoutes from "../routes/publicRoutes.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runPaymentWorkflowTests() {
    console.log("=== STARTING PAYMENT WORKFLOW TESTS ===");
    let server;
    let testAdmin;
    let testStudent1;
    let testStudent2;
    let testCourse;
    let testLesson;
    let payment1Id;
    let retryPaymentId;

    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI missing in .env");
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✓ Connected to MongoDB Atlas");

        const app = express();
        app.set("view engine", "ejs");
        app.set("views", path.join(__dirname, "../views"));
        app.use(express.urlencoded({ extended: true, limit: "5mb" }));
        app.use(express.json({ limit: "5mb" }));

        app.use(
            session({
                secret: "test-payment-secret-123456789",
                resave: false,
                saveUninitialized: false,
                cookie: { secure: false },
            })
        );

        // Header-based session injector for role testing
        app.use((req, res, next) => {
            const authHeader = req.headers["x-test-auth"];
            if (authHeader === "admin" && testAdmin) {
                req.session.user = {
                    id: testAdmin._id.toString(),
                    name: testAdmin.name,
                    email: testAdmin.email,
                    role: "admin",
                    isActive: true,
                    mustChangePassword: false,
                };
            } else if (authHeader === "student1" && testStudent1) {
                req.session.user = {
                    id: testStudent1._id.toString(),
                    name: testStudent1.name,
                    email: testStudent1.email,
                    role: "student",
                    isActive: true,
                    mustChangePassword: false,
                };
            } else if (authHeader === "student2" && testStudent2) {
                req.session.user = {
                    id: testStudent2._id.toString(),
                    name: testStudent2.name,
                    email: testStudent2.email,
                    role: "student",
                    isActive: true,
                    mustChangePassword: false,
                };
            }
            next();
        });

        app.use(publicRoutes);
        app.use(authRoutes);
        app.use(studentRoutes);
        app.use("/admin", adminRoutes);

        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });

        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`✓ Test server running at ${baseUrl}`);

        const timestamp = Date.now();
        const passwordHash = await bcrypt.hash("Password123!", 10);

        testAdmin = await User.create({
            name: "Payment Admin",
            email: `payadmin-${timestamp}@example.com`,
            phone: "9887766551",
            passwordHash,
            role: "admin",
            mustChangePassword: false,
            isActive: true,
        });

        testStudent1 = await User.create({
            name: "Payment Student One",
            email: `paystudent1-${timestamp}@example.com`,
            phone: "9887766552",
            passwordHash,
            role: "student",
            mustChangePassword: false,
            isActive: true,
        });

        testStudent2 = await User.create({
            name: "Payment Student Two",
            email: `paystudent2-${timestamp}@example.com`,
            phone: "9887766553",
            passwordHash,
            role: "student",
            mustChangePassword: false,
            isActive: true,
        });

        testCourse = await Course.create({
            title: `Payment Test Course ${timestamp}`,
            slug: `pay-course-${timestamp}`,
            description: "A course for testing payment workflows",
            price: 1299,
            isPublished: true,
        });

        testLesson = await Lesson.create({
            courseId: testCourse._id,
            title: "Paid Lesson 1",
            moduleName: "Module 1",
            order: 1,
            durationSeconds: 180,
            bunnyVideoId: "11111111-2222-3333-4444-555555555555",
            isPublished: true,
        });

        console.log("✓ Fixtures created");

        // TEST 1: Unauthorized access protections
        {
            // Anonymous -> Redirect
            const anonRes = await fetch(`${baseUrl}/admin/payments`, { redirect: "manual" });
            if (anonRes.status !== 302 || !anonRes.headers.get("location")?.includes("/login")) {
                throw new Error(`Expected 302 redirect for anonymous accessing /admin/payments, got ${anonRes.status}`);
            }

            // Student -> 403 Forbidden
            const studentRes = await fetch(`${baseUrl}/admin/payments`, {
                headers: { "x-test-auth": "student1" },
            });
            if (studentRes.status !== 403) {
                throw new Error(`Expected 403 for student accessing /admin/payments, got ${studentRes.status}`);
            }

            const studentApproveRes = await fetch(`${baseUrl}/admin/payments/123456789012345678901234/approve`, {
                method: "POST",
                headers: { "x-test-auth": "student1" },
            });
            if (studentApproveRes.status !== 403) {
                throw new Error(`Expected 403 for student calling approve, got ${studentApproveRes.status}`);
            }

            console.log("✓ TEST 1 PASSED: Admin payments endpoints are strictly protected against anonymous and student access.");
        }

        // TEST 2: Arbitrary external URL proof rejection
        {
            const maliciousBody = new URLSearchParams({
                transactionReference: "UTR-TEST-001",
                proofUrl: "https://arbitrary-untrusted-site.com/receipt.html",
            });

            const res = await fetch(`${baseUrl}/courses/${testCourse.slug}/enroll`, {
                method: "POST",
                headers: {
                    "x-test-auth": "student1",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: maliciousBody.toString(),
            });

            if (res.status !== 400) {
                throw new Error(`Expected 400 when submitting arbitrary external proof URL, got ${res.status}`);
            }
            const text = await res.text();
            if (!text.includes("trusted cloud providers")) {
                throw new Error("Expected validation error mentioning trusted cloud providers");
            }

            console.log("✓ TEST 2 PASSED: Arbitrary external URLs as proof are safely rejected.");
        }

        // TEST 3: Valid payment submission with server-derived price & pending status
        {
            const validBody = new URLSearchParams({
                transactionReference: "UTR-TEST-88991122",
                proofUrl: "https://drive.google.com/file/d/test-receipt-12345/view",
            });

            const res = await fetch(`${baseUrl}/courses/${testCourse.slug}/enroll`, {
                method: "POST",
                headers: {
                    "x-test-auth": "student1",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: validBody.toString(),
            });

            if (res.status !== 200) {
                throw new Error(`Expected 200 after submitting payment, got ${res.status}`);
            }

            const paymentInDb = await Payment.findOne({
                userId: testStudent1._id,
                courseId: testCourse._id,
            });
            if (!paymentInDb) {
                throw new Error("Payment record not saved");
            }
            if (paymentInDb.status !== "pending") {
                throw new Error(`Expected status pending, got ${paymentInDb.status}`);
            }
            if (paymentInDb.amount !== testCourse.price) {
                throw new Error(`Amount mismatch: expected server price ${testCourse.price}, got ${paymentInDb.amount}`);
            }

            payment1Id = paymentInDb._id.toString();

            // Verify enrollment is NOT active
            const enrollmentInDb = await Enrollment.findOne({
                userId: testStudent1._id,
                courseId: testCourse._id,
            });
            if (enrollmentInDb && enrollmentInDb.status === "active") {
                throw new Error("SECURITY VIOLATION: Enrollment was activated upon mere payment submission!");
            }

            console.log("✓ TEST 3 PASSED: Payment submitted with status pending, amount derived strictly from course price, enrollment NOT activated.");
        }

        // TEST 4: Duplicate pending submission prevention
        {
            const duplicateBody = new URLSearchParams({
                transactionReference: "UTR-TEST-88991122",
            });

            const res = await fetch(`${baseUrl}/courses/${testCourse.slug}/enroll`, {
                method: "POST",
                headers: {
                    "x-test-auth": "student1",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: duplicateBody.toString(),
            });

            if (res.status !== 400) {
                throw new Error(`Expected 400 for duplicate pending payment, got ${res.status}`);
            }
            console.log("✓ TEST 4 PASSED: Duplicate pending payment submission blocked.");
        }

        // TEST 5: Proof privacy check
        {
            // Student 2 attempts to view Student 1's proof -> 403 Forbidden
            const unauthorizedProofRes = await fetch(`${baseUrl}/payments/${payment1Id}/proof`, {
                headers: { "x-test-auth": "student2" },
            });
            if (unauthorizedProofRes.status !== 403) {
                throw new Error(`Expected 403 when Student 2 views Student 1 proof, got ${unauthorizedProofRes.status}`);
            }

            // Student 1 (owner) views proof -> 302 Redirect to trusted link
            const ownerProofRes = await fetch(`${baseUrl}/payments/${payment1Id}/proof`, {
                headers: { "x-test-auth": "student1" },
                redirect: "manual",
            });
            if (ownerProofRes.status !== 302) {
                throw new Error(`Expected 302 redirect for owner viewing proof, got ${ownerProofRes.status}`);
            }

            console.log("✓ TEST 5 PASSED: Proof access strictly restricted to authorized owner and admin.");
        }

        // TEST 6: Admin Rejection with Required Reason
        {
            // Missing reason -> 400
            const emptyReasonRes = await fetch(`${baseUrl}/admin/payments/${payment1Id}/reject`, {
                method: "POST",
                headers: { "x-test-auth": "admin", "Content-Type": "application/x-www-form-urlencoded" },
                body: "rejectionReason=",
            });
            if (emptyReasonRes.status !== 400) {
                throw new Error(`Expected 400 for rejection without reason, got ${emptyReasonRes.status}`);
            }

            // Valid reason -> 302 redirect
            const rejectRes = await fetch(`${baseUrl}/admin/payments/${payment1Id}/reject`, {
                method: "POST",
                headers: { "x-test-auth": "admin", "Content-Type": "application/x-www-form-urlencoded" },
                body: "rejectionReason=UTR%20not%20found%20in%20bank%20statement",
                redirect: "manual",
            });
            if (rejectRes.status !== 302) {
                throw new Error(`Expected 302 after rejection, got ${rejectRes.status}`);
            }

            const rejectedInDb = await Payment.findById(payment1Id);
            if (rejectedInDb.status !== "rejected" || !rejectedInDb.rejectionReason) {
                throw new Error("Payment status not rejected or rejection reason not saved");
            }

            console.log("✓ TEST 6 PASSED: Payment rejection validated; rejection reason enforced and preserved.");
        }

        // TEST 7: Retry payment submission after rejection
        {
            const retryBody = new URLSearchParams({
                transactionReference: "UTR-RETRY-CORRECTED-9999",
            });

            const res = await fetch(`${baseUrl}/courses/${testCourse.slug}/enroll`, {
                method: "POST",
                headers: {
                    "x-test-auth": "student1",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: retryBody.toString(),
            });

            if (res.status !== 200) {
                throw new Error(`Expected 200 for retry payment, got ${res.status}`);
            }

            const newPayment = await Payment.findOne({
                userId: testStudent1._id,
                courseId: testCourse._id,
                status: "pending",
            });
            if (!newPayment || newPayment.transactionReference !== "UTR-RETRY-CORRECTED-9999") {
                throw new Error("Retry payment record not created");
            }

            retryPaymentId = newPayment._id.toString();
            console.log("✓ TEST 7 PASSED: Student successfully submitted retry payment after prior rejection.");
        }

        // TEST 8: Admin Approval & Enrollment Activation
        {
            const approveRes = await fetch(`${baseUrl}/admin/payments/${retryPaymentId}/approve`, {
                method: "POST",
                headers: { "x-test-auth": "admin", "Content-Type": "application/x-www-form-urlencoded" },
                redirect: "manual",
            });
            if (approveRes.status !== 302) {
                throw new Error(`Expected 302 after approval, got ${approveRes.status}`);
            }

            const approvedInDb = await Payment.findById(retryPaymentId);
            if (approvedInDb.status !== "approved" || !approvedInDb.reviewedAt) {
                throw new Error("Payment was not approved or reviewedAt missing");
            }

            // Verify enrollment is now active
            const activeEnrollment = await Enrollment.findOne({
                userId: testStudent1._id,
                courseId: testCourse._id,
            });
            if (!activeEnrollment || activeEnrollment.status !== "active") {
                throw new Error("Enrollment was not activated upon payment approval!");
            }

            // TEST 9: Repeated Approval Idempotency
            const repeatApproveRes = await fetch(`${baseUrl}/admin/payments/${retryPaymentId}/approve`, {
                method: "POST",
                headers: { "x-test-auth": "admin", "Content-Type": "application/x-www-form-urlencoded" },
                redirect: "manual",
            });
            if (repeatApproveRes.status !== 302) {
                throw new Error(`Expected 302 for repeated approval, got ${repeatApproveRes.status}`);
            }

            const enrollmentCount = await Enrollment.countDocuments({
                userId: testStudent1._id,
                courseId: testCourse._id,
            });
            if (enrollmentCount !== 1) {
                throw new Error(`Expected exactly 1 enrollment record, found ${enrollmentCount}`);
            }

            console.log("✓ TEST 8 & 9 PASSED: Payment approval activated enrollment, and repeated approval remained idempotent.");
        }

        console.log("==================================================");
        console.log("ALL PAYMENT WORKFLOW TESTS PASSED! ✓");
        console.log("==================================================");
    } catch (err) {
        console.error("TEST FAILED ✗:", err);
        process.exitCode = 1;
    } finally {
        try {
            if (testStudent1) {
                await Enrollment.deleteMany({ userId: testStudent1._id });
                await Payment.deleteMany({ userId: testStudent1._id });
                await User.findByIdAndDelete(testStudent1._id);
            }
            if (testStudent2) await User.findByIdAndDelete(testStudent2._id);
            if (testAdmin) await User.findByIdAndDelete(testAdmin._id);
            if (testLesson) await Lesson.findByIdAndDelete(testLesson._id);
            if (testCourse) await Course.findByIdAndDelete(testCourse._id);
            console.log("✓ Test fixtures cleaned up from database");
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }

        if (server) server.close();
        await mongoose.disconnect().catch(() => {});
    }
}

runPaymentWorkflowTests();
