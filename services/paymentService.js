import mongoose from "mongoose";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";

/**
 * Calculates and attaches the immutable financial snapshot for a payment upon approval.
 * Idempotent: returns immediately if snapshot has already been calculated.
 */
export async function calculatePaymentSnapshot(payment, session = null) {
    if (payment.financialSnapshot?.calculatedAt) {
        return payment.financialSnapshot;
    }

    const courseQuery = Course.findById(payment.courseId);
    if (session) courseQuery.session(session);
    const course = await courseQuery;

    const ownerId = payment.ownerId || course?.ownerId || null;
    let commissionRate = 0.20;
    let isTeacherOwned = false;

    if (ownerId) {
        payment.ownerId = ownerId;
        const userQuery = User.findById(ownerId);
        if (session) userQuery.session(session);
        const owner = await userQuery;

        if (owner?.role === "teacher") {
            isTeacherOwned = true;
            commissionRate = typeof owner.teacherProfile?.commissionRate === "number"
                ? owner.teacherProfile.commissionRate
                : 0.20;
        } else if (owner?.role === "super_admin" || owner?.role === "admin") {
            commissionRate = 1.0;
        }
    }

    const coursePrice = typeof payment.amount === "number" ? payment.amount : (course?.price || 0);
    let platformCommission;
    let teacherShare;

    if (isTeacherOwned) {
        platformCommission = Math.round(coursePrice * commissionRate * 100) / 100;
        teacherShare = Math.round((coursePrice - platformCommission) * 100) / 100;
    } else {
        platformCommission = coursePrice;
        teacherShare = 0;
        commissionRate = 1.0;
    }

    payment.financialSnapshot = {
        coursePrice,
        commissionRate,
        platformCommission,
        teacherShare,
        currency: "INR",
        collectionMethod: "manual_platform",
        calculatedAt: new Date(),
    };

    return payment.financialSnapshot;
}

/**
 * Approves a submitted payment, calculating financial snapshot and activating student enrollment.
 * Idempotent: if already approved, returns existing records without re-execution.
 */
export async function approvePaymentRecord(paymentId) {
    if (!mongoose.isValidObjectId(paymentId)) {
        throw new Error("Invalid payment ID.");
    }

    const session = await mongoose.startSession().catch(() => null);

    if (session) {
        try {
            session.startTransaction();

            const payment = await Payment.findById(paymentId).session(session);
            if (!payment) {
                await session.abortTransaction();
                session.endSession();
                const err = new Error("Payment record not found.");
                err.statusCode = 404;
                throw err;
            }

            if (payment.status === "approved") {
                await session.commitTransaction();
                session.endSession();
                const enrollment = await Enrollment.findOne({
                    userId: payment.userId,
                    courseId: payment.courseId,
                });
                return { payment, enrollment, alreadyApproved: true };
            }

            await calculatePaymentSnapshot(payment, session);

            payment.status = "approved";
            payment.reviewedAt = new Date();
            payment.rejectionReason = "";
            await payment.save({ session });

            const enrollment = await Enrollment.findOneAndUpdate(
                { userId: payment.userId, courseId: payment.courseId },
                {
                    $set: {
                        status: "active",
                        approvedAt: new Date(),
                    },
                },
                { upsert: true, returnDocument: "after", session }
            );

            await session.commitTransaction();
            session.endSession();

            return { payment, enrollment, alreadyApproved: false };
        } catch (txErr) {
            await session.abortTransaction().catch(() => {});
            session.endSession();
            throw txErr;
        }
    } else {
        // Fallback without MongoDB transaction support (standalone instances)
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            const err = new Error("Payment record not found.");
            err.statusCode = 404;
            throw err;
        }

        if (payment.status === "approved") {
            const enrollment = await Enrollment.findOne({
                userId: payment.userId,
                courseId: payment.courseId,
            });
            return { payment, enrollment, alreadyApproved: true };
        }

        await calculatePaymentSnapshot(payment, null);

        payment.status = "approved";
        payment.reviewedAt = new Date();
        payment.rejectionReason = "";
        await payment.save();

        const enrollment = await Enrollment.findOneAndUpdate(
            { userId: payment.userId, courseId: payment.courseId },
            {
                $set: {
                    status: "active",
                    approvedAt: new Date(),
                },
            },
            { upsert: true, returnDocument: "after" }
        );

        return { payment, enrollment, alreadyApproved: false };
    }
}

/**
 * Rejects a submitted payment with a specified reason.
 */
export async function rejectPaymentRecord(paymentId, rejectionReason = "") {
    if (!mongoose.isValidObjectId(paymentId)) {
        throw new Error("Invalid payment ID.");
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
        const err = new Error("Payment record not found.");
        err.statusCode = 404;
        throw err;
    }

    payment.status = "rejected";
    payment.reviewedAt = new Date();
    payment.rejectionReason = String(rejectionReason || "").trim().slice(0, 500);
    await payment.save();

    return { payment };
}
