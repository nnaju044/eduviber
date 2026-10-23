import mongoose from "mongoose";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import { sendPaymentSubmittedEmail } from "../services/emailService.js";

/**
 * Public Landing Page
 * Displays headline, benefits, and published courses
 */
export async function showLandingPage(req, res, next) {
    try {
        const user = req.session?.user || null;

        const courses = await Course.find({ isPublished: true })
            .sort({ createdAt: -1 })
            .lean();

        const courseIds = courses.map((c) => c._id);

        const lessonAggregates = await Lesson.aggregate([
            { $match: { courseId: { $in: courseIds }, isPublished: true } },
            {
                $group: {
                    _id: "$courseId",
                    count: { $sum: 1 },
                    totalDuration: { $sum: "$durationSeconds" },
                },
            },
        ]);

        const statsMap = new Map(
            lessonAggregates.map((item) => [
                item._id.toString(),
                {
                    count: item.count,
                    totalMinutes: Math.round((item.totalDuration || 0) / 60),
                },
            ])
        );

        const enrichedCourses = courses.map((c) => {
            const stats = statsMap.get(c._id.toString()) || { count: 0, totalMinutes: 0 };
            return {
                ...c,
                lessonCount: stats.count,
                totalMinutes: stats.totalMinutes,
            };
        });

        res.render("public/landing", {
            courses: enrichedCourses,
            user,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Public Course Catalogue
 * Lists all published courses
 */
export async function listPublicCourses(req, res, next) {
    try {
        const user = req.session?.user || null;

        const courses = await Course.find({ isPublished: true })
            .sort({ createdAt: -1 })
            .lean();

        const courseIds = courses.map((c) => c._id);

        const lessonAggregates = await Lesson.aggregate([
            { $match: { courseId: { $in: courseIds }, isPublished: true } },
            {
                $group: {
                    _id: "$courseId",
                    count: { $sum: 1 },
                    totalDuration: { $sum: "$durationSeconds" },
                },
            },
        ]);

        const statsMap = new Map(
            lessonAggregates.map((item) => [
                item._id.toString(),
                {
                    count: item.count,
                    totalMinutes: Math.round((item.totalDuration || 0) / 60),
                },
            ])
        );

        const enrichedCourses = courses.map((c) => {
            const stats = statsMap.get(c._id.toString()) || { count: 0, totalMinutes: 0 };
            return {
                ...c,
                lessonCount: stats.count,
                totalMinutes: stats.totalMinutes,
            };
        });

        res.render("public/catalog", {
            courses: enrichedCourses,
            user,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Course Detail & Curriculum Preview
 * Uses course slug, shows only published lessons, no video URLs exposed
 */
export async function showCourseDetail(req, res, next) {
    try {
        const { slug } = req.params;
        const user = req.session?.user || null;

        // Basic slug validation
        if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/i.test(slug)) {
            return res.status(404).render("public/404", {
                message: "Course not found",
                user,
            });
        }

        const course = await Course.findOne({
            slug: slug.toLowerCase().trim(),
            isPublished: true,
        }).lean();

        if (!course) {
            return res.status(404).render("public/404", {
                message: "Course not found or not currently available",
                user,
            });
        }

        // Fetch only published lessons, selecting only safe public fields
        const lessons = await Lesson.find({
            courseId: course._id,
            isPublished: true,
        })
            .select("title description moduleName order durationSeconds")
            .sort({ order: 1 })
            .lean();

        // Group lessons by moduleName
        const modulesMap = new Map();
        let totalDurationSeconds = 0;

        for (const lesson of lessons) {
            const modName = lesson.moduleName || "Course Content";
            if (!modulesMap.has(modName)) {
                modulesMap.set(modName, []);
            }
            modulesMap.get(modName).push(lesson);
            totalDurationSeconds += lesson.durationSeconds || 0;
        }

        const modules = Array.from(modulesMap.entries()).map(([name, modLessons]) => ({
            name,
            lessons: modLessons,
        }));

        // Check if current user is already enrolled
        let isEnrolled = false;
        if (user) {
            const enrollment = await Enrollment.findOne({
                userId: user.id,
                courseId: course._id,
                status: "active",
            }).lean();
            isEnrolled = Boolean(enrollment) || user.role === "admin";
        }

        res.render("public/course-detail", {
            course,
            modules,
            totalLessons: lessons.length,
            totalMinutes: Math.round(totalDurationSeconds / 60),
            isEnrolled,
            user,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Course Enrollment / Manual Payment Instructions
 */
const TRUSTED_PROOF_DOMAINS = [
    "drive.google.com",
    "docs.google.com",
    "dropbox.com",
    "onedrive.live.com",
    "1drv.ms",
    "i.imgur.com",
];

function getPaymentInstructionsConfig() {
    return {
        upiId: process.env.PAYMENT_UPI_ID || "payments@eduviber.bank",
        accountName: process.env.PAYMENT_ACCOUNT_NAME || "EDUviber",
        bankName: process.env.PAYMENT_BANK_NAME || "HDFC Bank",
        accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "50200012345678",
        ifscCode: process.env.PAYMENT_IFSC_CODE || "HDFC0000128",
    };
}

function validatePaymentProof(proof) {
    if (!proof || typeof proof !== "string") {
        return { valid: true, proofUrl: "" };
    }
    const trimmed = proof.trim();
    if (!trimmed) {
        return { valid: true, proofUrl: "" };
    }

    // Support Base64 image upload data URL
    if (trimmed.startsWith("data:image/")) {
        const match = trimmed.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
            return {
                valid: false,
                error: "Invalid image format. Only JPEG, PNG, and WebP images are supported.",
            };
        }
        // Limit base64 length to ~3.5MB (equivalent to ~2.5MB binary)
        if (trimmed.length > 3.5 * 1024 * 1024) {
            return {
                valid: false,
                error: "Image proof must be under 2.5 MB in size.",
            };
        }
        return { valid: true, proofUrl: trimmed };
    }

    // Validate HTTPS link from trusted cloud providers
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "https:") {
            return {
                valid: false,
                error: "Proof links must use secure HTTPS protocol.",
            };
        }
        const hostname = parsed.hostname.toLowerCase();
        const isTrusted = TRUSTED_PROOF_DOMAINS.some(
            (domain) => hostname === domain || hostname.endsWith("." + domain)
        );
        if (!isTrusted) {
            return {
                valid: false,
                error: "Proof URLs must be from trusted cloud providers (Google Drive, Dropbox, OneDrive). Arbitrary external websites are not accepted.",
            };
        }
        return { valid: true, proofUrl: parsed.toString() };
    } catch {
        return {
            valid: false,
            error: "Please enter a valid URL or upload a screenshot image.",
        };
    }
}

/**
 * Course Enrollment / Manual Payment Instructions
 */
export async function showEnrollmentPage(req, res, next) {
    try {
        const { slug } = req.params;
        const user = req.session?.user || null;

        if (!slug || typeof slug !== "string") {
            return res.status(404).render("public/404", {
                message: "Course not found",
                user,
            });
        }

        const course = await Course.findOne({
            slug: slug.toLowerCase().trim(),
            isPublished: true,
        }).lean();

        if (!course) {
            return res.status(404).render("public/404", {
                message: "Course not found or not published",
                user,
            });
        }

        // Check if user is logged in
        if (!user) {
            return res.render("public/enroll-login-required", {
                course,
                user: null,
            });
        }

        // Check if already active
        const existingEnrollment = await Enrollment.findOne({
            userId: user.id,
            courseId: course._id,
        }).lean();

        if (existingEnrollment && existingEnrollment.status === "active") {
            return res.redirect("/dashboard");
        }

        // Check latest payment state for this student and course
        const latestPayment = await Payment.findOne({
            userId: user.id,
            courseId: course._id,
        })
            .sort({ createdAt: -1 })
            .lean();

        const pendingPayment = latestPayment && latestPayment.status === "pending" ? latestPayment : null;
        const rejectedPayment = latestPayment && latestPayment.status === "rejected" ? latestPayment : null;

        res.render("public/enroll", {
            course,
            user,
            paymentConfig: getPaymentInstructionsConfig(),
            pendingPayment,
            rejectedPayment,
            error: null,
            values: {},
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Handle Manual Payment Proof Submission
 */
export async function submitEnrollmentPayment(req, res, next) {
    try {
        const { slug } = req.params;
        const user = req.session?.user || null;

        if (!user) {
            return res.redirect(`/courses/${encodeURIComponent(slug)}/enroll`);
        }

        const course = await Course.findOne({
            slug: slug.toLowerCase().trim(),
            isPublished: true,
        }).lean();

        if (!course) {
            return res.status(404).render("public/404", {
                message: "Course not found",
                user,
            });
        }

        // Check if already active
        const existingEnrollment = await Enrollment.findOne({
            userId: user.id,
            courseId: course._id,
            status: "active",
        }).lean();

        if (existingEnrollment) {
            return res.redirect("/dashboard");
        }

        const transactionReference = String(req.body.transactionReference || "").trim();
        const rawProof = String(req.body.proofData || req.body.proofUrl || "").trim();

        const values = { transactionReference, proofUrl: rawProof.startsWith("data:") ? "" : rawProof };

        if (!transactionReference || transactionReference.length < 4 || transactionReference.length > 100) {
            return res.status(400).render("public/enroll", {
                course,
                user,
                paymentConfig: getPaymentInstructionsConfig(),
                pendingPayment: null,
                rejectedPayment: null,
                error: "Please enter a valid Transaction Reference / UPI UTR number (4 to 100 characters).",
                values,
            });
        }

        // Validate proof
        const proofValidation = validatePaymentProof(rawProof);
        if (!proofValidation.valid) {
            return res.status(400).render("public/enroll", {
                course,
                user,
                paymentConfig: getPaymentInstructionsConfig(),
                pendingPayment: null,
                rejectedPayment: null,
                error: proofValidation.error,
                values,
            });
        }

        // Check if identical pending payment already exists
        const existingPending = await Payment.findOne({
            userId: user.id,
            courseId: course._id,
            status: "pending",
        }).lean();

        if (existingPending) {
            return res.status(400).render("public/enroll", {
                course,
                user,
                paymentConfig: getPaymentInstructionsConfig(),
                pendingPayment: existingPending,
                rejectedPayment: null,
                error: "You already have a verification request pending for this course. Please await administrator review.",
                values,
            });
        }

        // Amount derived strictly from course record on server
        const payment = await Payment.create({
            userId: user.id,
            courseId: course._id,
            amount: course.price,
            transactionReference,
            proofUrl: proofValidation.proofUrl,
            status: "pending",
        });

        // Upsert pending Enrollment - NEVER activate on submission
        await Enrollment.findOneAndUpdate(
            { userId: user.id, courseId: course._id },
            {
                $setOnInsert: {
                    userId: user.id,
                    courseId: course._id,
                    status: "pending",
                },
            },
            { upsert: true, returnDocument: "after" }
        );

        // Send non-blocking payment submission confirmation email
        sendPaymentSubmittedEmail({ user, course, payment }).catch((err) => {
            console.error("[Payment] Error sending payment submitted email:", err.message);
        });

        res.render("public/enroll-success", {
            course,
            user,
            payment,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Serve or redirect to payment proof securely
 */
export async function servePaymentProof(req, res, next) {
    try {
        const { id } = req.params;
        const user = req.session?.user;

        if (!user) {
            return res.status(401).send("Authentication required.");
        }

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).send("Payment not found.");
        }

        const payment = await Payment.findById(id).lean();
        if (!payment) {
            return res.status(404).send("Payment not found.");
        }

        // Authorization check: User must be admin or the payment's owner
        const isOwner = payment.userId.toString() === user.id;
        const isAdmin = user.role === "admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).send("Access denied.");
        }

        if (!payment.proofUrl) {
            return res.status(404).send("No proof attached to this payment record.");
        }

        if (payment.proofUrl.startsWith("data:image/")) {
            const parts = payment.proofUrl.split(",");
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
            const buffer = Buffer.from(parts[1], "base64");

            res.set({
                "Content-Type": mimeType,
                "Content-Length": buffer.length,
                "Content-Security-Policy": "default-src 'none'",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
            });
            return res.send(buffer);
        }

        // For trusted HTTPS URLs, redirect
        return res.redirect(payment.proofUrl);
    } catch (error) {
        next(error);
    }
}
