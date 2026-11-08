import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import Course from "../../models/Course.js";
import Lesson from "../../models/Lesson.js";
import Enrollment from "../../models/Enrollment.js";
import Payment from "../../models/Payment.js";
import Progress from "../../models/Progress.js";
import { approvePaymentRecord, rejectPaymentRecord } from "../../services/paymentService.js";
import {
    sendWelcomeSetupEmail,
    sendPaymentApprovedEmail,
    sendPaymentRejectedEmail,
    sendEnrollmentActivatedEmail,
} from "../../services/emailService.js";
import { sendApiError, sendApiSuccess } from "../middleware/apiAuth.js";

// ---------------------------------------------------------------------------
// TEACHER MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * List all teacher accounts
 */
export async function listTeachers(req, res, next) {
    try {
        const teachers = await User.find({ role: "teacher" })
            .select("-passwordHash")
            .sort({ createdAt: -1 })
            .lean();

        const teacherIds = teachers.map((t) => t._id);
        const courses = await Course.aggregate([
            { $match: { ownerId: { $in: teacherIds } } },
            { $group: { _id: "$ownerId", count: { $sum: 1 } } },
        ]);
        const courseCountMap = new Map(courses.map((c) => [c._id.toString(), c.count]));

        const sanitized = teachers.map((t) => ({
            id: t._id.toString(),
            name: t.name,
            email: t.email,
            phone: t.phone || "",
            isActive: t.isActive,
            isApproved: Boolean(t.teacherProfile?.isApproved),
            approvedAt: t.teacherProfile?.approvedAt || null,
            commissionRate: t.teacherProfile?.commissionRate ?? 0.20,
            courseCount: courseCountMap.get(t._id.toString()) || 0,
            headline: t.teacherProfile?.headline || "",
            createdAt: t.createdAt,
        }));

        return sendApiSuccess(res, 200, { teachers: sanitized });
    } catch (error) {
        next(error);
    }
}

/**
 * Get detailed teacher information
 */
export async function getTeacher(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Teacher not found.", "NOT_FOUND");
        }

        const teacher = await User.findOne({ _id: id, role: "teacher" }).select("-passwordHash").lean();
        if (!teacher) {
            return sendApiError(res, 404, "Teacher not found.", "NOT_FOUND");
        }

        const courses = await Course.find({ ownerId: teacher._id }).sort({ createdAt: -1 }).lean();

        return sendApiSuccess(res, 200, {
            teacher: {
                id: teacher._id.toString(),
                name: teacher.name,
                email: teacher.email,
                phone: teacher.phone || "",
                isActive: teacher.isActive,
                mustChangePassword: teacher.mustChangePassword,
                teacherProfile: teacher.teacherProfile || {},
                createdAt: teacher.createdAt,
            },
            courses: courses.map((c) => ({
                id: c._id.toString(),
                title: c.title,
                slug: c.slug,
                price: c.price,
                isPublished: c.isPublished,
                createdAt: c.createdAt,
            })),
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Create a new teacher account (Super Admin only)
 */
export async function createTeacher(req, res, next) {
    try {
        const { name, email, phone, password, headline, bio, commissionRate, isApproved } = req.body;

        if (!name || String(name).trim().length < 2) {
            return sendApiError(res, 400, "Teacher name must be at least 2 characters.", "INVALID_NAME");
        }

        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            return sendApiError(res, 400, "Please provide a valid email address.", "INVALID_EMAIL");
        }

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return sendApiError(res, 409, "An account with this email address already exists.", "EMAIL_COLLISION");
        }

        const plainPassword = String(password || "").trim();
        if (plainPassword.length < 12) {
            return sendApiError(res, 400, "Temporary password must be at least 12 characters long.", "PASSWORD_TOO_SHORT");
        }

        const rate = commissionRate !== undefined ? Math.min(1.0, Math.max(0, parseFloat(commissionRate) || 0.20)) : 0.20;
        const approved = isApproved === true || isApproved === "true";

        const passwordHash = await bcrypt.hash(plainPassword, 10);

        const teacher = await User.create({
            name: String(name).trim(),
            email: normalizedEmail,
            phone: String(phone || "").trim(),
            passwordHash,
            role: "teacher",
            isActive: true,
            mustChangePassword: true,
            teacherProfile: {
                headline: String(headline || "").trim(),
                bio: String(bio || "").trim(),
                commissionRate: rate,
                isApproved: approved,
                approvedAt: approved ? new Date() : null,
                approvedBy: approved ? req.session.user.id : null,
            },
        });

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        sendWelcomeSetupEmail({
            user: teacher,
            tempPassword: plainPassword,
            baseUrl,
        }).catch((err) => {
            console.error("[Teacher Create] Welcome email delivery failed:", err.message);
        });

        return sendApiSuccess(res, 201, {
            teacher: {
                id: teacher._id.toString(),
                name: teacher.name,
                email: teacher.email,
                role: teacher.role,
                isActive: teacher.isActive,
                teacherProfile: teacher.teacherProfile,
                createdAt: teacher.createdAt,
            },
        }, "Teacher account created successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Approve a teacher account (Super Admin only)
 */
export async function approveTeacher(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Teacher not found.", "NOT_FOUND");
        }

        const teacher = await User.findOne({ _id: id, role: "teacher" });
        if (!teacher) {
            return sendApiError(res, 404, "Teacher account not found.", "NOT_FOUND");
        }

        if (!teacher.teacherProfile) {
            teacher.teacherProfile = {};
        }

        teacher.teacherProfile.isApproved = true;
        teacher.teacherProfile.approvedAt = new Date();
        teacher.teacherProfile.approvedBy = req.session.user.id;

        await teacher.save();

        return sendApiSuccess(res, 200, {
            teacher: {
                id: teacher._id.toString(),
                name: teacher.name,
                isApproved: true,
                approvedAt: teacher.teacherProfile.approvedAt,
            },
        }, "Teacher account approved successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Suspend or reactivate a teacher account
 */
export async function toggleTeacherStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Teacher not found.", "NOT_FOUND");
        }

        const teacher = await User.findOne({ _id: id, role: "teacher" });
        if (!teacher) {
            return sendApiError(res, 404, "Teacher not found.", "NOT_FOUND");
        }

        teacher.isActive = !teacher.isActive;
        await teacher.save();

        return sendApiSuccess(res, 200, {
            teacher: {
                id: teacher._id.toString(),
                isActive: teacher.isActive,
            },
        }, `Teacher account ${teacher.isActive ? "activated" : "suspended"} successfully`);
    } catch (error) {
        next(error);
    }
}

// ---------------------------------------------------------------------------
// COURSE MANAGEMENT (SUPER ADMIN)
// ---------------------------------------------------------------------------

/**
 * List all courses across platform
 */
export async function listCourses(req, res, next) {
    try {
        const courses = await Course.find()
            .populate("ownerId", "name email role teacherProfile.headline")
            .sort({ createdAt: -1 })
            .lean();

        const courseIds = courses.map((c) => c._id);
        const [lessonCounts, enrollmentCounts] = await Promise.all([
            Lesson.aggregate([
                { $match: { courseId: { $in: courseIds } } },
                { $group: { _id: "$courseId", count: { $sum: 1 } } },
            ]),
            Enrollment.aggregate([
                { $match: { courseId: { $in: courseIds }, status: "active" } },
                { $group: { _id: "$courseId", count: { $sum: 1 } } },
            ]),
        ]);

        const lessonMap = new Map(lessonCounts.map((l) => [l._id.toString(), l.count]));
        const enrollMap = new Map(enrollmentCounts.map((e) => [e._id.toString(), e.count]));

        const sanitized = courses.map((c) => ({
            id: c._id.toString(),
            title: c.title,
            slug: c.slug,
            price: c.price,
            thumbnail: c.thumbnail,
            instructor: c.instructor,
            isPublished: Boolean(c.isPublished),
            owner: c.ownerId
                ? {
                      id: c.ownerId._id.toString(),
                      name: c.ownerId.name,
                      email: c.ownerId.email,
                      role: c.ownerId.role,
                  }
                : null,
            lessonCount: lessonMap.get(c._id.toString()) || 0,
            activeStudentCount: enrollMap.get(c._id.toString()) || 0,
            createdAt: c.createdAt,
        }));

        return sendApiSuccess(res, 200, { courses: sanitized });
    } catch (error) {
        next(error);
    }
}

/**
 * Create a course (Super Admin can assign ownerId to self or any teacher)
 */
export async function createCourse(req, res, next) {
    try {
        const { title, description, price, thumbnail, instructor, customSlug, ownerId } = req.body;

        if (!title || String(title).trim().length < 3) {
            return sendApiError(res, 400, "Course title must be at least 3 characters.", "INVALID_TITLE");
        }

        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice < 0) {
            return sendApiError(res, 400, "Price must be a non-negative number.", "INVALID_PRICE");
        }

        let assignedOwnerId = req.session.user.id;
        if (ownerId && mongoose.isValidObjectId(ownerId)) {
            const ownerExists = await User.findById(ownerId).lean();
            if (ownerExists) {
                assignedOwnerId = ownerExists._id;
            }
        }

        let baseSlug = customSlug
            ? String(customSlug).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
            : String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        if (!baseSlug) baseSlug = `course-${Date.now()}`;

        let slug = baseSlug;
        let suffix = 1;
        while (await Course.exists({ slug })) {
            slug = `${baseSlug}-${suffix++}`;
        }

        const course = await Course.create({
            title: String(title).trim(),
            slug,
            description: String(description || "").trim(),
            price: numPrice,
            thumbnail: String(thumbnail || "").trim(),
            instructor: String(instructor || req.session.user.name).trim(),
            ownerId: assignedOwnerId,
            isPublished: false,
        });

        return sendApiSuccess(res, 201, {
            course: {
                id: course._id.toString(),
                title: course.title,
                slug: course.slug,
                price: course.price,
                ownerId: course.ownerId.toString(),
                isPublished: course.isPublished,
                createdAt: course.createdAt,
            },
        }, "Course created successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Toggle publication of any course
 */
export async function toggleCoursePublication(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const course = await Course.findById(id);
        if (!course) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        course.isPublished = !course.isPublished;
        await course.save();

        return sendApiSuccess(res, 200, {
            course: {
                id: course._id.toString(),
                isPublished: course.isPublished,
            },
        }, `Course ${course.isPublished ? "published" : "unpublished"} successfully`);
    } catch (error) {
        next(error);
    }
}

/**
 * Delete a course (Super Admin oversight, preserving deletion safeguards)
 */
export async function deleteCourse(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const course = await Course.findById(id);
        if (!course) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const [paymentCount, enrollmentCount] = await Promise.all([
            Payment.countDocuments({ courseId: course._id }),
            Enrollment.countDocuments({ courseId: course._id, status: "active" }),
        ]);

        if (paymentCount > 0) {
            return sendApiError(
                res,
                400,
                "Course cannot be deleted because financial payment records exist for it. Unpublish it instead.",
                "FINANCIAL_RECORDS_EXIST"
            );
        }

        if (enrollmentCount > 0) {
            return sendApiError(
                res,
                400,
                "Course cannot be deleted because active student enrollments exist.",
                "ACTIVE_ENROLLMENTS_EXIST"
            );
        }

        await Lesson.deleteMany({ courseId: course._id });
        await Course.findByIdAndDelete(course._id);

        return sendApiSuccess(res, 200, null, "Course and associated lessons deleted successfully");
    } catch (error) {
        next(error);
    }
}

// ---------------------------------------------------------------------------
// STUDENT & ENROLLMENT MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * List all students with search and pagination
 */
export async function listStudents(req, res, next) {
    try {
        const search = String(req.query.q || "").trim();
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const filter = { role: "student" };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }

        const [students, total] = await Promise.all([
            User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            User.countDocuments(filter),
        ]);

        const studentIds = students.map((s) => s._id);
        const enrollments = await Enrollment.aggregate([
            { $match: { userId: { $in: studentIds }, status: "active" } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
        ]);
        const enrollCountMap = new Map(enrollments.map((e) => [e._id.toString(), e.count]));

        return sendApiSuccess(res, 200, {
            students: students.map((s) => ({
                id: s._id.toString(),
                name: s.name,
                email: s.email,
                phone: s.phone || "",
                isActive: s.isActive,
                activeEnrollmentCount: enrollCountMap.get(s._id.toString()) || 0,
                createdAt: s.createdAt,
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get detailed student profile and all enrollments
 */
export async function getStudent(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Student not found.", "NOT_FOUND");
        }

        const student = await User.findById(id).select("-passwordHash").lean();
        if (!student) {
            return sendApiError(res, 404, "Student not found.", "NOT_FOUND");
        }

        const enrollments = await Enrollment.find({ userId: student._id })
            .populate("courseId", "title slug price isPublished")
            .sort({ createdAt: -1 })
            .lean();

        return sendApiSuccess(res, 200, {
            student: {
                id: student._id.toString(),
                name: student.name,
                email: student.email,
                phone: student.phone || "",
                role: student.role,
                isActive: student.isActive,
                createdAt: student.createdAt,
            },
            enrollments: enrollments.map((e) => ({
                id: e._id.toString(),
                course: e.courseId
                    ? {
                          id: e.courseId._id.toString(),
                          title: e.courseId.title,
                          slug: e.courseId.slug,
                          price: e.courseId.price,
                      }
                    : null,
                status: e.status,
                approvedAt: e.approvedAt || null,
                createdAt: e.createdAt,
            })),
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update an enrollment's status
 */
export async function updateEnrollmentStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Enrollment not found.", "NOT_FOUND");
        }

        const validStatuses = ["active", "pending", "suspended", "expired"];
        if (!validStatuses.includes(status)) {
            return sendApiError(res, 400, "Invalid enrollment status.", "INVALID_STATUS");
        }

        const enrollment = await Enrollment.findById(id);
        if (!enrollment) {
            return sendApiError(res, 404, "Enrollment not found.", "NOT_FOUND");
        }

        enrollment.status = status;
        if (status === "active" && !enrollment.approvedAt) {
            enrollment.approvedAt = new Date();
        }

        await enrollment.save();

        return sendApiSuccess(res, 200, {
            enrollment: {
                id: enrollment._id.toString(),
                status: enrollment.status,
                approvedAt: enrollment.approvedAt,
            },
        }, `Enrollment status updated to ${status}`);
    } catch (error) {
        next(error);
    }
}

// ---------------------------------------------------------------------------
// PAYMENT REVIEW & FINANCIAL APPROVAL (SUPER ADMIN ONLY)
// ---------------------------------------------------------------------------

/**
 * List payments with status filtering
 */
export async function listPayments(req, res, next) {
    try {
        const statusFilter = req.query.status;
        const filter = {};
        if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
            filter.status = statusFilter;
        }

        const payments = await Payment.find(filter)
            .populate("userId", "name email")
            .populate("courseId", "title price slug")
            .populate("ownerId", "name email role")
            .sort({ createdAt: -1 })
            .lean();

        const sanitized = payments.map((p) => ({
            id: p._id.toString(),
            student: p.userId ? { id: p.userId._id.toString(), name: p.userId.name, email: p.userId.email } : null,
            course: p.courseId ? { id: p.courseId._id.toString(), title: p.courseId.title, slug: p.courseId.slug, price: p.courseId.price } : null,
            owner: p.ownerId ? { id: p.ownerId._id.toString(), name: p.ownerId.name, role: p.ownerId.role } : null,
            amount: p.amount,
            status: p.status,
            transactionReference: p.transactionReference,
            proofUrl: p.proofUrl || "",
            financialSnapshot: p.financialSnapshot || null,
            reviewedAt: p.reviewedAt || null,
            rejectionReason: p.rejectionReason || "",
            createdAt: p.createdAt,
        }));

        return sendApiSuccess(res, 200, { payments: sanitized });
    } catch (error) {
        next(error);
    }
}

/**
 * Get details of a single payment record
 */
export async function getPayment(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Payment record not found.", "NOT_FOUND");
        }

        const payment = await Payment.findById(id)
            .populate("userId", "name email phone")
            .populate("courseId", "title slug price thumbnail")
            .populate("ownerId", "name email role teacherProfile.headline")
            .lean();

        if (!payment) {
            return sendApiError(res, 404, "Payment record not found.", "NOT_FOUND");
        }

        return sendApiSuccess(res, 200, {
            payment: {
                id: payment._id.toString(),
                student: payment.userId ? { id: payment.userId._id.toString(), name: payment.userId.name, email: payment.userId.email, phone: payment.userId.phone } : null,
                course: payment.courseId ? { id: payment.courseId._id.toString(), title: payment.courseId.title, slug: payment.courseId.slug, price: payment.courseId.price } : null,
                owner: payment.ownerId ? { id: payment.ownerId._id.toString(), name: payment.ownerId.name, role: payment.ownerId.role } : null,
                amount: payment.amount,
                status: payment.status,
                transactionReference: payment.transactionReference,
                proofUrl: payment.proofUrl,
                financialSnapshot: payment.financialSnapshot,
                reviewedAt: payment.reviewedAt,
                rejectionReason: payment.rejectionReason,
                createdAt: payment.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Approve payment: calculates immutable financial snapshot and activates enrollment
 */
export async function approvePayment(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Payment record not found.", "NOT_FOUND");
        }

        // Delegate to centralized payment service
        const result = await approvePaymentRecord(id);

        // Send non-blocking approval email notification
        if (!result.alreadyApproved) {
            const [user, course] = await Promise.all([
                User.findById(result.payment.userId).lean(),
                Course.findById(result.payment.courseId).lean(),
            ]);
            if (user && course) {
                const baseUrl = `${req.protocol}://${req.get("host")}`;
                sendPaymentApprovedEmail({ user, course, payment: result.payment, baseUrl }).catch((err) => {
                    console.error("[Payment API] Approval email failed:", err.message);
                });
            }
        }

        return sendApiSuccess(res, 200, {
            payment: {
                id: result.payment._id.toString(),
                status: result.payment.status,
                reviewedAt: result.payment.reviewedAt,
                financialSnapshot: result.payment.financialSnapshot,
            },
            alreadyApproved: result.alreadyApproved,
        }, result.alreadyApproved ? "Payment was already approved." : "Payment approved and enrollment activated.");
    } catch (error) {
        next(error);
    }
}

/**
 * Reject payment with reason
 */
export async function rejectPayment(req, res, next) {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Payment record not found.", "NOT_FOUND");
        }

        const result = await rejectPaymentRecord(id, rejectionReason);

        const [user, course] = await Promise.all([
            User.findById(result.payment.userId).lean(),
            Course.findById(result.payment.courseId).lean(),
        ]);
        if (user && course) {
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            sendPaymentRejectedEmail({
                user,
                course,
                payment: result.payment,
                rejectionReason: result.payment.rejectionReason,
                baseUrl,
            }).catch((err) => {
                console.error("[Payment API] Rejection email failed:", err.message);
            });
        }

        return sendApiSuccess(res, 200, {
            payment: {
                id: result.payment._id.toString(),
                status: result.payment.status,
                rejectionReason: result.payment.rejectionReason,
                reviewedAt: result.payment.reviewedAt,
            },
        }, "Payment rejected successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Returns read-only aggregated platform statistics for Super Admin dashboard overview
 */
export async function getOverviewStats(req, res, next) {
    try {
        const [
            totalTeachers,
            approvedTeachers,
            pendingTeachers,
            totalCourses,
            publishedCourses,
            totalStudents,
            pendingPayments,
            approvedPayments,
            totalPayments,
        ] = await Promise.all([
            User.countDocuments({ role: "teacher" }),
            User.countDocuments({ role: "teacher", "teacherProfile.isApproved": true }),
            User.countDocuments({ role: "teacher", "teacherProfile.isApproved": false }),
            Course.countDocuments(),
            Course.countDocuments({ isPublished: true }),
            User.countDocuments({ role: "student" }),
            Payment.countDocuments({ status: "pending" }),
            Payment.countDocuments({ status: "approved" }),
            Payment.countDocuments(),
        ]);

        return sendApiSuccess(res, 200, {
            stats: {
                totalTeachers,
                approvedTeachers,
                pendingTeachers,
                totalCourses,
                publishedCourses,
                totalStudents,
                pendingPayments,
                approvedPayments,
                totalPayments,
            },
        });
    } catch (error) {
        next(error);
    }
}
