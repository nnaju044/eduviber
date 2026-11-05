import mongoose from "mongoose";
import User from "../../models/User.js";
import Course from "../../models/Course.js";
import Lesson from "../../models/Lesson.js";
import Enrollment from "../../models/Enrollment.js";
import Progress from "../../models/Progress.js";
import Payment from "../../models/Payment.js";
import Device from "../../models/Device.js";
import { createSignedEmbedUrl, verifyBunnyVideo } from "../../config/bunny.js";
import { sendPaymentSubmittedEmail } from "../../services/emailService.js";
import { validatePaymentProof } from "../../controllers/publicController.js";
import { sendApiError, sendApiSuccess } from "../middleware/apiAuth.js";
import { authenticateDevice } from "../../services/deviceService.js";
import { mergeIntervals, calculateUniqueSeconds, isFullCoverage } from "../../services/intervalService.js";

/**
 * Get authenticated student's own profile
 */
export async function getProfile(req, res, next) {
    try {
        const user = await User.findById(req.session.user.id).select("name email phone role isActive createdAt").lean();
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        return sendApiSuccess(res, 200, {
            profile: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone || "",
                role: user.role === "admin" ? "super_admin" : user.role,
                joinedAt: user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update authenticated student's permitted profile fields
 */
export async function updateProfile(req, res, next) {
    try {
        const { name, phone } = req.body;
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        if (name && typeof name === "string" && name.trim().length >= 2) {
            user.name = name.trim();
        }
        if (phone !== undefined) {
            user.phone = String(phone).trim();
        }

        await user.save();
        req.session.user.name = user.name;
        await new Promise((resolve) => req.session.save(resolve));

        return sendApiSuccess(res, 200, {
            profile: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone,
            },
        }, "Profile updated successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Get authenticated student's dashboard (enrolled courses with progress)
 */
export async function getDashboard(req, res, next) {
    try {
        const userId = req.session.user.id;

        const enrollments = await Enrollment.find({ userId })
            .populate({
                path: "courseId",
                select: "title slug description thumbnail instructor price isPublished ownerId",
                populate: { path: "ownerId", select: "name teacherProfile.headline" },
            })
            .sort({ createdAt: -1 })
            .lean();

        const activeEnrollments = enrollments.filter((e) => e.courseId && e.status === "active");
        const pendingEnrollments = enrollments.filter((e) => e.courseId && e.status === "pending");

        const activeCourseIds = activeEnrollments.map((e) => e.courseId._id);

        // Fetch lesson counts and completed counts
        const [allLessons, userProgress] = await Promise.all([
            Lesson.find({ courseId: { $in: activeCourseIds }, isPublished: true }).select("_id courseId").lean(),
            Progress.find({ userId, completed: true }).select("lessonId").lean(),
        ]);

        const completedLessonIds = new Set(userProgress.map((p) => p.lessonId.toString()));
        const courseTotalLessons = new Map();
        const courseCompletedLessons = new Map();

        for (const lesson of allLessons) {
            const cid = lesson.courseId.toString();
            courseTotalLessons.set(cid, (courseTotalLessons.get(cid) || 0) + 1);
            if (completedLessonIds.has(lesson._id.toString())) {
                courseCompletedLessons.set(cid, (courseCompletedLessons.get(cid) || 0) + 1);
            }
        }

        const enrolledCourses = activeEnrollments.map((e) => {
            const c = e.courseId;
            const cid = c._id.toString();
            const total = courseTotalLessons.get(cid) || 0;
            const completed = courseCompletedLessons.get(cid) || 0;
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                id: c._id.toString(),
                enrollmentId: e._id.toString(),
                title: c.title,
                slug: c.slug,
                description: c.description,
                thumbnail: c.thumbnail,
                instructor: c.instructor,
                teacher: c.ownerId
                    ? {
                        id: c.ownerId._id.toString(),
                        name: c.ownerId.name,
                        headline: c.ownerId.teacherProfile?.headline || "",
                    }
                    : null,
                status: e.status,
                enrolledAt: e.createdAt,
                progress: {
                    totalLessons: total,
                    completedLessons: completed,
                    percentage,
                },
            };
        });

        const pendingCourses = pendingEnrollments.map((e) => ({
            id: e.courseId._id.toString(),
            enrollmentId: e._id.toString(),
            title: e.courseId.title,
            slug: e.courseId.slug,
            thumbnail: e.courseId.thumbnail,
            status: e.status,
            requestedAt: e.createdAt,
        }));

        return sendApiSuccess(res, 200, {
            enrolledCourses,
            pendingCourses,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get enrolled course details and lesson syllabus with student's personal progress
 */
export async function getEnrolledCourse(req, res, next) {
    try {
        const { courseId } = req.params;
        const userId = req.session.user.id;

        if (!mongoose.isValidObjectId(courseId)) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const course = await Course.findById(courseId)
            .select("title slug description thumbnail instructor isPublished ownerId")
            .populate("ownerId", "name teacherProfile.headline")
            .lean();

        if (!course) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const isAdmin = req.session.user.role === "super_admin" || req.session.user.role === "admin";
        const enrollment = await Enrollment.findOne({ userId, courseId: course._id }).lean();

        if (!enrollment && !isAdmin) {
            return sendApiError(res, 403, "You are not enrolled in this course.", "NOT_ENROLLED");
        }

        const lessons = await Lesson.find({ courseId: course._id, isPublished: true })
            .select("title moduleName order durationMinutes durationSeconds description isFreePreview")
            .sort({ order: 1 })
            .lean();

        const lessonIds = lessons.map((l) => l._id);
        const progressRecords = await Progress.find({ userId, lessonId: { $in: lessonIds } }).lean();
        const progressMap = new Map(progressRecords.map((p) => [p.lessonId.toString(), p]));

        const syllabus = lessons.map((l) => {
            const prog = progressMap.get(l._id.toString());
            return {
                id: l._id.toString(),
                title: l.title,
                description: l.description || "",
                moduleName: l.moduleName || "General",
                order: l.order,
                durationMinutes: l.durationMinutes || (l.durationSeconds ? Math.round(l.durationSeconds / 60) : 0),
                durationSeconds: l.durationSeconds || (l.durationMinutes ? l.durationMinutes * 60 : 0),
                isFreePreview: Boolean(l.isFreePreview),
                progress: {
                    completed: Boolean(prog?.completed),
                    lastPositionSeconds: prog?.lastPositionSeconds ?? prog?.progressSeconds ?? 0,
                    progressSeconds: prog?.progressSeconds ?? prog?.lastPositionSeconds ?? 0,
                    watchedSeconds: prog?.watchedSeconds || 0,
                    percentage: prog?.progressPercentage || (prog?.completed ? 100 : 0),
                    lastWatchedAt: prog?.lastWatchedAt || null,
                },
            };
        });

        const totalLessons = lessons.length;
        const completedLessons = syllabus.filter((s) => s.progress.completed).length;

        return sendApiSuccess(res, 200, {
            course: {
                id: course._id.toString(),
                title: course.title,
                slug: course.slug,
                description: course.description,
                thumbnail: course.thumbnail,
                instructor: course.instructor,
                teacher: course.ownerId
                    ? {
                        id: course.ownerId._id.toString(),
                        name: course.ownerId.name,
                        headline: course.ownerId.teacherProfile?.headline || "",
                    }
                    : null,
            },
            enrollmentStatus: enrollment ? enrollment.status : "admin_override",
            stats: {
                totalLessons,
                completedLessons,
                completionPercentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
            },
            syllabus,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get authorized lesson playback details and signed Bunny embed URL
 */
export async function getLessonPlayback(req, res, next) {
    try {
        const { courseId, lessonId } = req.params;
        const userId = req.session.user.id;

        if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
            return sendApiError(res, 404, "Course or Lesson not found.", "NOT_FOUND");
        }

        const course = await Course.findById(courseId).select("_id title isPublished").lean();
        if (!course) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const lesson = await Lesson.findOne({ _id: lessonId, courseId: course._id, isPublished: true }).lean();
        if (!lesson) {
            return sendApiError(res, 404, "Lesson not found or is currently unpublished.", "NOT_FOUND");
        }

        const isAdmin = req.session.user.role === "super_admin" || req.session.user.role === "admin";
        const enrollment = await Enrollment.findOne({ userId, courseId: course._id, status: "active" }).lean();

        // Must be active enrollment, admin, or free preview
        if (!enrollment && !isAdmin && !lesson.isFreePreview) {
            return sendApiError(res, 403, "Active course enrollment is required to watch this lesson.", "ENROLLMENT_REQUIRED");
        }

        // Validate Device Limit & Registration (F10)
        const deviceAuth = await authenticateDevice(req, res, userId);
        if (!deviceAuth.authorized) {
            return sendApiError(res, 403, deviceAuth.message, deviceAuth.code, {
                activeDevices: deviceAuth.activeDevices,
            });
        }

        if (!lesson.bunnyVideoId) {
            return sendApiError(res, 404, "This lesson has no video attached.", "NO_VIDEO_ATTACHED");
        }

        // Generate time-limited signed embed URL (never exposes API keys or secrets)
        const embedUrl = createSignedEmbedUrl(lesson.bunnyVideoId, 3600);

        // Fetch student's last recorded position
        const progress = await Progress.findOne({ userId, lessonId: lesson._id }).lean();

        // Compute previous and next lesson navigation
        const allLessons = await Lesson.find({ courseId: course._id, isPublished: true })
            .sort({ order: 1 })
            .select("_id title order moduleName")
            .lean();

        const currentIndex = allLessons.findIndex((l) => l._id.toString() === lesson._id.toString());
        const prevLesson = currentIndex > 0 ? { id: allLessons[currentIndex - 1]._id.toString(), title: allLessons[currentIndex - 1].title } : null;
        const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? { id: allLessons[currentIndex + 1]._id.toString(), title: allLessons[currentIndex + 1].title } : null;

        return sendApiSuccess(res, 200, {
            lesson: {
                id: lesson._id.toString(),
                title: lesson.title,
                description: lesson.description || "",
                moduleName: lesson.moduleName || "General",
                order: lesson.order,
                durationMinutes: lesson.durationMinutes || (lesson.durationSeconds ? Math.round(lesson.durationSeconds / 60) : 0),
                durationSeconds: lesson.durationSeconds || (lesson.durationMinutes ? lesson.durationMinutes * 60 : 0),
                isFreePreview: Boolean(lesson.isFreePreview),
            },
            playback: {
                embedUrl,
                lastPositionSeconds: progress?.lastPositionSeconds ?? progress?.progressSeconds ?? 0,
                progressSeconds: progress?.progressSeconds ?? progress?.lastPositionSeconds ?? 0,
                watchedSeconds: progress?.watchedSeconds || 0,
                watchedIntervals: progress?.watchedIntervals || [],
                uniqueWatchedSeconds: progress?.uniqueWatchedSeconds || 0,
                completed: Boolean(progress?.completed),
            },
            watermark: {
                text: `${req.session.user.name || "Student"} • ${req.session.user.email} • EduVibe`,
                studentName: req.session.user.name || "Student",
                studentEmail: req.session.user.email,
            },
            navigation: {
                prevLesson,
                nextLesson,
                currentIndex: currentIndex + 1,
                totalLessons: allLessons.length,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Save playback progress for a lesson
 */
export async function saveProgress(req, res, next) {
    try {
        const courseId = req.params.courseId || req.body.courseId;
        const lessonId = req.params.lessonId || req.body.lessonId;
        const userId = req.session.user.id;

        if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
            return sendApiError(res, 404, "Course or Lesson not found.", "NOT_FOUND");
        }

        const course = await Course.findById(courseId).select("_id").lean();
        if (!course) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const isAdmin = req.session.user.role === "super_admin" || req.session.user.role === "admin";
        const enrollment = await Enrollment.findOne({ userId, courseId: course._id, status: "active" }).lean();
        const lesson = await Lesson.findOne({ _id: lessonId, courseId: course._id, isPublished: true }).lean();

        if (!lesson) {
            return sendApiError(res, 404, "Lesson not found.", "NOT_FOUND");
        }

        if (!enrollment && !isAdmin && !lesson.isFreePreview) {
            return sendApiError(res, 403, "Access denied. Active enrollment required.", "FORBIDDEN");
        }

        const rawPosition = req.body.position ?? req.body.lastPositionSeconds ?? req.body.watchedSeconds ?? 0;
        const position = Number(rawPosition);
        const completedRequested = req.body.completed === true;

        if (!Number.isFinite(position) || position < 0) {
            return sendApiError(res, 400, "Invalid position. Must be a non-negative number.", "INVALID_POSITION");
        }

        const durationSeconds = (lesson.durationSeconds && lesson.durationSeconds > 0)
            ? lesson.durationSeconds
            : (lesson.durationMinutes || 0) * 60;

        const safePosition = Math.floor(position);
        const existingProgress = await Progress.findOne({ userId, lessonId: lesson._id }).lean();

        // Unique interval processing
        const existingIntervals = existingProgress?.watchedIntervals || [];
        const incomingIntervals = Array.isArray(req.body.intervals) ? req.body.intervals : [];

        // If client sends [start, end] in current range
        if (req.body.currentInterval && Array.isArray(req.body.currentInterval) && req.body.currentInterval.length === 2) {
            incomingIntervals.push(req.body.currentInterval);
        }

        // Combine and merge all intervals
        const merged = mergeIntervals([...existingIntervals, ...incomingIntervals]);
        const uniqueSeconds = calculateUniqueSeconds(merged);

        const inputWatched = req.body.watchedSeconds !== undefined ? Number(req.body.watchedSeconds) : null;
        const watchedSeconds = Math.max(
            existingProgress?.watchedSeconds || 0,
            uniqueSeconds,
            inputWatched !== null && Number.isFinite(inputWatched) ? Math.floor(inputWatched) : safePosition
        );

        let percentage = 0;
        if (durationSeconds > 0) {
            percentage = Math.min(100, Math.round((Math.max(uniqueSeconds, watchedSeconds, safePosition) / durationSeconds) * 100));
        }

        // F08: Lesson completion validation
        // In full interval mode, requires full coverage + end position
        // In direct/legacy mode, respects completed=true or percentage >= 90
        const hasFullCoverage = isFullCoverage(merged, durationSeconds) || (durationSeconds > 0 && uniqueSeconds >= durationSeconds - 2);
        const atEndPosition = durationSeconds > 0 && safePosition >= durationSeconds - 2;
        const isCompleted = completedRequested ||
            (hasFullCoverage && atEndPosition) ||
            percentage >= 90 ||
            (existingProgress?.completed === true);

        if (isCompleted) {
            percentage = 100;
        }

        const resumePosition = isCompleted ? 0 : safePosition;

        const progress = await Progress.findOneAndUpdate(
            { userId, lessonId: lesson._id },
            {
                $set: {
                    userId,
                    lessonId: lesson._id,
                    courseId: course._id,
                    lastPositionSeconds: resumePosition,
                    progressSeconds: resumePosition,
                    watchedSeconds,
                    watchedIntervals: merged,
                    uniqueWatchedSeconds: uniqueSeconds,
                    progressPercentage: percentage,
                    completed: isCompleted,
                    lastWatchedAt: new Date(),
                },
            },
            { upsert: true, returnDocument: "after", runValidators: true }
        );

        return sendApiSuccess(res, 200, {
            progress: {
                lessonId: lesson._id.toString(),
                courseId: course._id.toString(),
                lastPositionSeconds: progress.lastPositionSeconds,
                progressSeconds: progress.progressSeconds,
                watchedSeconds: progress.watchedSeconds,
                watchedIntervals: progress.watchedIntervals,
                uniqueWatchedSeconds: progress.uniqueWatchedSeconds,
                progressPercentage: progress.progressPercentage,
                completed: progress.completed,
                lastWatchedAt: progress.lastWatchedAt,
            },
        }, "Progress saved successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Submit manual payment reference and optional proof for course enrollment
 */
export async function submitPaymentProof(req, res, next) {
    try {
        const { slug } = req.params;
        const userId = req.session.user.id;

        const course = await Course.findOne({ slug, isPublished: true }).lean();
        if (!course) {
            return sendApiError(res, 404, "Course not found or is currently unpublished.", "NOT_FOUND");
        }

        const { transactionReference, proofUrl } = req.body;

        if (!transactionReference || String(transactionReference).trim().length < 4 || String(transactionReference).trim().length > 100) {
            return sendApiError(res, 400, "Please enter a valid Transaction Reference (4 to 100 characters).", "INVALID_TRANSACTION_REF");
        }

        // Validate proof
        const proofValidation = validatePaymentProof(proofUrl || "");
        if (!proofValidation.valid) {
            return sendApiError(res, 400, proofValidation.error, "INVALID_PROOF");
        }

        // Check if pending payment already exists
        const existingPending = await Payment.findOne({
            userId,
            courseId: course._id,
            status: "pending",
        }).lean();

        if (existingPending) {
            return sendApiError(
                res,
                400,
                "You already have a verification request pending for this course. Please await administrator review.",
                "PAYMENT_ALREADY_PENDING"
            );
        }

        // Strictly derive ownerId and amount from server course record
        const payment = await Payment.create({
            userId,
            courseId: course._id,
            ownerId: course.ownerId,
            amount: course.price,
            transactionReference: String(transactionReference).trim(),
            proofUrl: proofValidation.proofUrl,
            status: "pending",
        });

        // Upsert pending Enrollment - NEVER activate on submission
        await Enrollment.findOneAndUpdate(
            { userId, courseId: course._id },
            {
                $setOnInsert: {
                    userId,
                    courseId: course._id,
                    status: "pending",
                },
            },
            { upsert: true, returnDocument: "after" }
        );

        // Send non-blocking email notification
        const user = await User.findById(userId).select("name email").lean();
        if (user) {
            sendPaymentSubmittedEmail({ user, course, payment }).catch((err) => {
                console.error("[Payment API] Error sending email notification:", err.message);
            });
        }

        return sendApiSuccess(res, 201, {
            payment: {
                id: payment._id.toString(),
                courseId: payment.courseId.toString(),
                amount: payment.amount,
                transactionReference: payment.transactionReference,
                status: payment.status,
                createdAt: payment.createdAt,
            },
        }, "Payment proof submitted successfully for administrative review");
    } catch (error) {
        next(error);
    }
}

/**
 * List registered devices for authenticated student (F10)
 */
export async function listDevices(req, res, next) {
    try {
        const userId = req.session.user.id;
        const devices = await Device.find({ userId, isRevoked: false })
            .sort({ lastActiveAt: -1 })
            .select("_id deviceName deviceType browser os lastActiveAt createdAt")
            .lean();

        return sendApiSuccess(res, 200, {
            devices: devices.map((d) => ({
                id: d._id.toString(),
                deviceName: d.deviceName,
                deviceType: d.deviceType,
                browser: d.browser,
                os: d.os,
                lastActiveAt: d.lastActiveAt,
                createdAt: d.createdAt,
            })),
            maxDevices: 2,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Revoke a registered device (F10)
 */
export async function revokeDevice(req, res, next) {
    try {
        const userId = req.session.user.id;
        const { deviceId } = req.params;

        if (!mongoose.isValidObjectId(deviceId)) {
            return sendApiError(res, 400, "Invalid device ID.", "INVALID_DEVICE_ID");
        }

        const device = await Device.findOne({ _id: deviceId, userId, isRevoked: false });
        if (!device) {
            return sendApiError(res, 404, "Device not found or already removed.", "NOT_FOUND");
        }

        device.isRevoked = true;
        await device.save();

        return sendApiSuccess(res, 200, {
            revokedDeviceId: device._id.toString(),
        }, "Device removed successfully");
    } catch (error) {
        next(error);
    }
}
