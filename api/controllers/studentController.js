import mongoose from "mongoose";
import crypto from "crypto";
import User from "../../models/User.js";
import Course from "../../models/Course.js";
import Lesson from "../../models/Lesson.js";
import Enrollment from "../../models/Enrollment.js";
import Progress from "../../models/Progress.js";
import Payment from "../../models/Payment.js";
import Device from "../../models/Device.js";
import cloudinary, { getCloudinaryClient, isCloudinaryConfigured, getStudentAvatarPublicId, getStudentAvatarUrl } from "../../config/cloudinary.js";
import { createSignedEmbedUrl, verifyBunnyVideo } from "../../config/bunny.js";
import {
    sendPaymentSubmittedEmail,
    sendEmailChangeVerificationEmail,
    sendEmailAddressChangedNotice,
    sendDeviceRevokedEmail,
} from "../../services/emailService.js";
import { validatePaymentProof } from "../../controllers/publicController.js";
import { sendApiError, sendApiSuccess } from "../middleware/apiAuth.js";
import { authenticateDevice } from "../../services/deviceService.js";
import { mergeIntervals, calculateUniqueSeconds, isFullCoverage } from "../../services/intervalService.js";
import { computeEffectiveAccess, assertStudentLessonAccess, assertStudentAssignmentAccess } from "../../services/contentAccessService.js";
import Assignment from "../../models/Assignment.js";
import AssignmentSubmission from "../../models/AssignmentSubmission.js";
import Notification from "../../models/Notification.js";
import { validateGoogleDriveLinks } from "../../utils/googleDriveValidator.js";
import { notifyTeacherOnSubmission } from "../../services/notificationService.js";

/**
 * Get authenticated student's own profile (F01)
 */
export async function getProfile(req, res, next) {
    try {
        const user = await User.findById(req.session.user.id)
            .select("name email phone role isActive createdAt avatarVersion pendingEmail")
            .lean();
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        const profilePictureUrl = getStudentAvatarUrl(user._id, user.avatarVersion);

        return sendApiSuccess(res, 200, {
            profile: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone || "",
                role: user.role === "admin" ? "super_admin" : user.role,
                joinedAt: user.createdAt,
                profilePictureUrl,
                avatarVersion: user.avatarVersion || 0,
                pendingEmail: user.pendingEmail || null,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update authenticated student's permitted profile fields (F01)
 */
export async function updateProfile(req, res, next) {
    try {
        const { name, phone } = req.body;
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        if (name !== undefined) {
            const trimmedName = String(name).trim();
            if (trimmedName.length < 2) {
                return sendApiError(res, 400, "Full name must be at least 2 characters long.", "NAME_TOO_SHORT");
            }
            if (trimmedName.length > 70) {
                return sendApiError(res, 400, "Full name must not exceed 70 characters.", "NAME_TOO_LONG");
            }
            user.name = trimmedName;
        }

        if (phone !== undefined) {
            const trimmedPhone = String(phone).trim();
            // Allow standard domestic or international numbers (between 7 and 18 digits/plus symbols)
            const phoneRegex = /^[+]?[\d\s-]{7,18}$/;
            if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
                return sendApiError(res, 400, "Please enter a valid phone number (e.g. +91 9876543210).", "INVALID_PHONE");
            }
            user.phone = trimmedPhone;
        }

        await user.save();
        req.session.user.name = user.name;
        await new Promise((resolve) => req.session.save(resolve));

        const profilePictureUrl = getStudentAvatarUrl(user._id, user.avatarVersion);

        return sendApiSuccess(res, 200, {
            profile: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role === "admin" ? "super_admin" : user.role,
                joinedAt: user.createdAt,
                profilePictureUrl,
                avatarVersion: user.avatarVersion || 0,
                pendingEmail: user.pendingEmail || null,
            },
        }, "Profile updated successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Upload or replace student avatar using deterministic Cloudinary public ID (F01)
 */
export async function uploadAvatar(req, res, next) {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        // Check if file provided in multipart/form-data or Base64 payload
        let buffer = null;
        let mimeType = "";

        if (req.file && req.file.buffer) {
            buffer = req.file.buffer;
            mimeType = req.file.mimetype;
        } else if (req.body?.image) {
            const raw = String(req.body.image);
            const matches = raw.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                buffer = Buffer.from(matches[2], "base64");
            }
        }

        if (!buffer) {
            return sendApiError(res, 400, "No valid image file uploaded. Please upload a JPEG, PNG, or WebP image.", "MISSING_IMAGE");
        }

        // Validate allowed MIME types
        const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        if (mimeType && !allowedMimes.includes(mimeType.toLowerCase())) {
            return sendApiError(res, 400, "Unsupported image type. Only JPEG, PNG, and WebP are allowed.", "INVALID_MIME_TYPE");
        }

        // Validate actual magic bytes (file signature) to prevent polyglot / spoofed files
        const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
        const isJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const isWebp = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";

        if (!isPng && !isJpg && !isWebp) {
            return sendApiError(res, 400, "Invalid image file signature. File content is not a valid JPEG, PNG, or WebP image.", "INVALID_IMAGE_SIGNATURE");
        }

        // Validate max size: 4MB (strictly below Vercel's 4.5 MB request body limit)
        if (buffer.length > 4 * 1024 * 1024) {
            return sendApiError(res, 400, "Image size exceeds 4 MB limit.", "FILE_TOO_LARGE");
        }

        const deterministicPublicId = getStudentAvatarPublicId(userId);

        // Upload to Cloudinary using deterministic public ID and overwrite: true
        let uploadResult = null;
        if (process.env.NODE_ENV === "test" && !isCloudinaryConfigured()) {
            // Mocked upload for test mode without external network dependency
            uploadResult = {
                public_id: deterministicPublicId,
                version: Date.now(),
            };
        } else {
            if (!isCloudinaryConfigured()) {
                return sendApiError(res, 503, "Profile picture storage service is currently unconfigured. Please contact support.", "CLOUDINARY_UNCONFIGURED");
            }

            const client = getCloudinaryClient();
            uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = client.uploader.upload_stream(
                    {
                        public_id: deterministicPublicId,
                        overwrite: true,
                        invalidate: true,
                        resource_type: "image",
                        transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }],
                    },
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    }
                );
                uploadStream.end(buffer);
            });
        }

        // Update avatar version for cache-busting
        const newVersion = uploadResult.version || Date.now();
        user.avatarVersion = newVersion;
        await user.save();

        const profilePictureUrl = getStudentAvatarUrl(user._id, newVersion);

        return sendApiSuccess(res, 200, {
            profilePictureUrl,
            avatarVersion: newVersion,
        }, "Profile picture uploaded successfully");
    } catch (error) {
        console.error("[AvatarUpload] Error uploading avatar:", error.message);
        return sendApiError(res, 500, "Failed to upload profile picture. Please try again.", "UPLOAD_FAILED");
    }
}

/**
 * Remove student avatar (F01)
 */
export async function deleteAvatar(req, res, next) {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        if (user.avatarVersion > 0) {
            const deterministicPublicId = getStudentAvatarPublicId(userId);
            try {
                if (isCloudinaryConfigured()) {
                    const client = getCloudinaryClient();
                    await client.uploader.destroy(deterministicPublicId);
                }
            } catch (cloudErr) {
                console.warn("[AvatarDelete] Warning destroying Cloudinary asset:", cloudErr.message);
            }

            user.avatarVersion = 0;
            await user.save();
        }

        return sendApiSuccess(res, 200, {
            profilePictureUrl: null,
            avatarVersion: 0,
        }, "Profile picture removed successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Request email change: sends single-use verification token to proposed new email (F01)
 */
export async function requestEmailChange(req, res, next) {
    try {
        const userId = req.session.user.id;
        const newEmail = String(req.body.newEmail || "").trim().toLowerCase();

        if (!newEmail || !newEmail.includes("@") || newEmail.length < 5) {
            return sendApiError(res, 400, "Please provide a valid email address.", "INVALID_EMAIL");
        }

        const user = await User.findById(userId);
        if (!user) {
            return sendApiError(res, 404, "User not found.", "NOT_FOUND");
        }

        if (user.email === newEmail) {
            return sendApiError(res, 400, "New email must be different from your current email address.", "SAME_EMAIL");
        }

        // Check if new email is already in use by any other account
        const existing = await User.findOne({ email: newEmail });
        if (existing) {
            return sendApiError(res, 409, "This email address is already registered to another account.", "EMAIL_ALREADY_REGISTERED");
        }

        // Generate 32-byte cryptographically secure verification token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        // 1 hour expiry
        user.pendingEmail = newEmail;
        user.emailVerifyTokenHash = tokenHash;
        user.emailVerifyExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        // Send verification email to the proposed address and await result
        const emailResult = await sendEmailChangeVerificationEmail({
            user,
            newEmail,
            verifyToken: rawToken,
            baseUrl,
        });

        if (!emailResult || !emailResult.success) {
            // Helper to mask recipient address for safe diagnostics
            const maskedRecipient = newEmail.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
                return `${first}${"*".repeat(Math.max(1, Math.min(middle.length, 5)))}${domain}`;
            });

            console.error(
                `[EmailChange] Verification email delivery failed for recipient ${maskedRecipient}:`,
                emailResult?.error || "Unknown mail transport error"
            );

            // Safely clear pending fields ONLY if they still match this specific request
            // (prevents wiping out a newer concurrent request)
            await User.updateOne(
                { _id: userId, emailVerifyTokenHash: tokenHash },
                {
                    $set: { pendingEmail: null },
                    $unset: {
                        emailVerifyTokenHash: 1,
                        emailVerifyExpires: 1,
                    },
                }
            );

            return sendApiError(
                res,
                502,
                "Unable to send verification email. Please verify the address and try again later.",
                "EMAIL_SEND_FAILED"
            );
        }

        return sendApiSuccess(res, 200, {
            pendingEmail: newEmail,
        }, `Verification email sent to ${newEmail}. Please confirm the link to update your email address.`);
    } catch (error) {
        next(error);
    }
}

/**
 * Verify and finalize email change (F01)
 */
export async function verifyEmailChange(req, res, next) {
    try {
        const userId = req.session.user.id;
        const rawToken = String(req.body.token || req.query.token || "").trim();

        if (!rawToken) {
            return sendApiError(res, 400, "Verification token is required.", "MISSING_TOKEN");
        }

        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        const user = await User.findOne({
            _id: userId,
            emailVerifyTokenHash: tokenHash,
            emailVerifyExpires: { $gt: new Date() },
        }).select("+emailVerifyTokenHash");

        if (!user || !user.pendingEmail) {
            return sendApiError(res, 400, "Invalid, expired, or already-used verification link.", "INVALID_TOKEN");
        }

        const oldEmail = user.email;
        const verifiedEmail = user.pendingEmail;

        // Re-check uniqueness in case another account registered it in the interim
        const duplicate = await User.findOne({ email: verifiedEmail, _id: { $ne: user._id } });
        if (duplicate) {
            user.pendingEmail = null;
            user.emailVerifyTokenHash = undefined;
            user.emailVerifyExpires = undefined;
            await user.save();
            return sendApiError(res, 409, "This email address was registered by another account.", "EMAIL_ALREADY_REGISTERED");
        }

        // Apply new email and invalidate verification token
        user.email = verifiedEmail;
        user.pendingEmail = null;
        user.emailVerifyTokenHash = undefined;
        user.emailVerifyExpires = undefined;
        await user.save();

        // Update session
        req.session.user.email = verifiedEmail;
        await new Promise((resolve) => req.session.save(resolve));

        // Dispatch security notification to the old email address
        sendEmailAddressChangedNotice({
            user,
            oldEmail,
            newEmail: verifiedEmail,
        }).catch((err) => {
            console.error("[EmailChange] Error dispatching old-email security alert:", err.message);
        });

        return sendApiSuccess(res, 200, {
            email: verifiedEmail,
        }, "Email address updated and verified successfully.");
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

        // Compute teacher-controlled content access permissions
        let effectiveAccess = null;
        if (!isAdmin) {
            effectiveAccess = await computeEffectiveAccess(course._id, userId);
        }

        const syllabus = lessons.map((l) => {
            const prog = progressMap.get(l._id.toString());
            const lessonAccess = effectiveAccess?.lessons?.[l._id.toString()];
            const isModuleUnlocked = isAdmin ? true : (lessonAccess ? lessonAccess.isModuleUnlocked : true);
            const isLessonDirectlyUnlocked = isAdmin ? true : (lessonAccess ? lessonAccess.isLessonDirectlyUnlocked : true);
            const isEffectivelyUnlocked = isAdmin ? true : (lessonAccess ? lessonAccess.isEffectivelyUnlocked : true);

            return {
                id: l._id.toString(),
                title: l.title,
                description: l.description || "",
                moduleName: l.moduleName || "General",
                order: l.order,
                durationMinutes: l.durationMinutes || (l.durationSeconds ? Math.round(l.durationSeconds / 60) : 0),
                durationSeconds: l.durationSeconds || (l.durationMinutes ? l.durationMinutes * 60 : 0),
                isFreePreview: Boolean(l.isFreePreview),
                isModuleUnlocked,
                isLessonUnlocked: isLessonDirectlyUnlocked,
                isUnlocked: isEffectivelyUnlocked,
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

        // Validate teacher-controlled content access permissions
        if (!isAdmin) {
            const accessCheck = await assertStudentLessonAccess(course._id, userId, lesson._id, lesson.isFreePreview);
            if (!accessCheck.authorized) {
                return sendApiError(res, 403, accessCheck.message, accessCheck.code, {
                    moduleName: accessCheck.moduleName,
                    lessonTitle: accessCheck.lessonTitle,
                });
            }
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

        // Validate teacher-controlled content access permissions
        if (!isAdmin) {
            const accessCheck = await assertStudentLessonAccess(course._id, userId, lesson._id, lesson.isFreePreview);
            if (!accessCheck.authorized) {
                return sendApiError(res, 403, accessCheck.message, accessCheck.code, {
                    moduleName: accessCheck.moduleName,
                    lessonTitle: accessCheck.lessonTitle,
                });
            }
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

        // Dispatch security notification to student email
        const user = await User.findById(userId);
        if (user) {
            sendDeviceRevokedEmail({ user, device }).catch((err) => {
                console.error("[DeviceRevoke] Error dispatching security email:", err.message);
            });
        }

        return sendApiSuccess(res, 200, {
            revokedDeviceId: device._id.toString(),
        }, "Device removed successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * =========================================================================
 * HOMEWORK & ASSIGNMENT SUBMISSION (STUDENT)
 * =========================================================================
 */

/**
 * List assignments for an enrolled course respecting content unlocking permissions
 */
export async function listCourseAssignments(req, res, next) {
    try {
        const { courseId } = req.params;
        const studentId = req.session.user.id;

        if (!mongoose.isValidObjectId(courseId)) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const course = await Course.findById(courseId).select("_id title isPublished");
        if (!course) {
            return sendApiError(res, 404, "Course not found.", "NOT_FOUND");
        }

        const isAdmin = req.session.user.role === "super_admin" || req.session.user.role === "admin";
        const enrollment = await Enrollment.findOne({ userId: studentId, courseId: course._id, status: "active" }).lean();

        if (!enrollment && !isAdmin) {
            return sendApiError(res, 403, "You must be actively enrolled in this course to view assignments.", "NOT_ENROLLED");
        }

        // Fetch only ENABLED assignments
        const assignments = await Assignment.find({
            courseId: course._id,
            isEnabled: true,
        })
            .populate("lessonId", "title order moduleName")
            .sort({ createdAt: -1 })
            .lean();

        // Get student's submissions for these assignments
        const assignmentIds = assignments.map((a) => a._id);
        const mySubmissions = await AssignmentSubmission.find({
            assignmentId: { $in: assignmentIds },
            studentId,
        })
            .populate("reviewedBy", "name")
            .sort({ version: -1 })
            .lean();

        const submissionsByAssignment = new Map();
        for (const sub of mySubmissions) {
            const aid = sub.assignmentId.toString();
            if (!submissionsByAssignment.has(aid)) {
                submissionsByAssignment.set(aid, []);
            }
            submissionsByAssignment.get(aid).push(sub);
        }

        // Filter assignments based on content unlocking permissions
        const accessibleAssignments = [];
        for (const assignment of assignments) {
            if (!isAdmin) {
                const access = await assertStudentAssignmentAccess(assignment, studentId);
                if (!access.authorized) {
                    continue; // Locked by module/lesson or disabled
                }
            }

            const studentSubs = submissionsByAssignment.get(assignment._id.toString()) || [];
            const latest = studentSubs[0] || null;

            accessibleAssignments.push({
                id: assignment._id.toString(),
                title: assignment.title,
                description: assignment.description,
                scope: assignment.scope,
                moduleName: assignment.moduleName,
                lessonId: assignment.lessonId?._id?.toString() || null,
                lesson: assignment.lessonId
                    ? { id: assignment.lessonId._id.toString(), title: assignment.lessonId.title, order: assignment.lessonId.order }
                    : null,
                resourceLinks: assignment.resourceLinks || [],
                status: latest ? latest.status : "not_submitted",
                hasSubmitted: Boolean(latest),
                isReviewed: latest?.status === "reviewed",
                latestSubmission: latest
                    ? {
                        id: latest._id.toString(),
                        version: latest.version,
                        driveLinks: latest.driveLinks,
                        textAnswer: latest.textAnswer,
                        status: latest.status,
                        submittedAt: latest.submittedAt,
                        reviewedAt: latest.reviewedAt,
                        reviewedBy: latest.reviewedBy?.name || null,
                    }
                    : null,
                totalVersions: studentSubs.length,
                createdAt: assignment.createdAt,
            });
        }

        return sendApiSuccess(res, 200, {
            courseId: course._id.toString(),
            courseTitle: course.title,
            assignments: accessibleAssignments,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get details of a single assignment for a student
 */
export async function getStudentAssignment(req, res, next) {
    try {
        const { assignmentId } = req.params;
        const studentId = req.session.user.id;

        if (!mongoose.isValidObjectId(assignmentId)) {
            return sendApiError(res, 404, "Assignment not found.", "NOT_FOUND");
        }

        const assignment = await Assignment.findById(assignmentId)
            .populate("courseId", "title isPublished")
            .populate("lessonId", "title order moduleName");

        if (!assignment || !assignment.isEnabled) {
            return sendApiError(res, 404, "Assignment not found or is currently disabled.", "NOT_FOUND");
        }

        const isAdmin = req.session.user.role === "super_admin" || req.session.user.role === "admin";
        const enrollment = await Enrollment.findOne({
            userId: studentId,
            courseId: assignment.courseId._id,
            status: "active",
        }).lean();

        if (!enrollment && !isAdmin) {
            return sendApiError(res, 403, "You must be actively enrolled to view this assignment.", "NOT_ENROLLED");
        }

        // Validate content access (Module / Lesson unlocked)
        if (!isAdmin) {
            const access = await assertStudentAssignmentAccess(assignment, studentId);
            if (!access.authorized) {
                return sendApiError(res, 403, access.message, access.code, {
                    moduleName: access.moduleName,
                    lessonTitle: access.lessonTitle,
                });
            }
        }

        // Get complete submission history for this student
        const submissions = await AssignmentSubmission.find({
            assignmentId: assignment._id,
            studentId,
        })
            .populate("reviewedBy", "name")
            .sort({ version: -1 })
            .lean();

        const latest = submissions[0] || null;

        return sendApiSuccess(res, 200, {
            assignment: {
                id: assignment._id.toString(),
                courseId: assignment.courseId._id.toString(),
                courseTitle: assignment.courseId.title,
                title: assignment.title,
                description: assignment.description,
                scope: assignment.scope,
                moduleName: assignment.moduleName,
                lessonId: assignment.lessonId?._id?.toString() || null,
                lesson: assignment.lessonId
                    ? { id: assignment.lessonId._id.toString(), title: assignment.lessonId.title, order: assignment.lessonId.order }
                    : null,
                resourceLinks: assignment.resourceLinks || [],
                status: latest ? latest.status : "not_submitted",
                isReviewed: latest?.status === "reviewed",
                canResubmit: !latest || latest.status !== "reviewed",
                createdAt: assignment.createdAt,
            },
            submissions: submissions.map((s) => ({
                id: s._id.toString(),
                version: s.version,
                driveLinks: s.driveLinks || [],
                textAnswer: s.textAnswer || "",
                status: s.status,
                submittedAt: s.submittedAt,
                reviewedAt: s.reviewedAt,
                reviewedBy: s.reviewedBy?.name || null,
            })),
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Submit or resubmit an assignment
 */
export async function submitAssignment(req, res, next) {
    try {
        const { assignmentId } = req.params;
        const studentId = req.session.user.id;
        const { driveLinks, textAnswer } = req.body;

        if (!mongoose.isValidObjectId(assignmentId)) {
            return sendApiError(res, 404, "Assignment not found.", "NOT_FOUND");
        }

        const assignment = await Assignment.findById(assignmentId).populate("courseId", "title ownerId isPublished");
        if (!assignment || !assignment.isEnabled) {
            return sendApiError(res, 404, "Assignment not found or is currently disabled by instructor.", "NOT_FOUND");
        }

        const isAdmin = req.session.user.role === "super_admin" || req.session.user.role === "admin";
        const enrollment = await Enrollment.findOne({
            userId: studentId,
            courseId: assignment.courseId._id,
            status: "active",
        }).lean();

        if (!enrollment && !isAdmin) {
            return sendApiError(res, 403, "You must be actively enrolled in this course to submit assignments.", "NOT_ENROLLED");
        }

        // Validate content access (Module / Lesson unlocked)
        if (!isAdmin) {
            const access = await assertStudentAssignmentAccess(assignment, studentId);
            if (!access.authorized) {
                return sendApiError(res, 403, access.message, access.code, {
                    moduleName: access.moduleName,
                    lessonTitle: access.lessonTitle,
                });
            }
        }

        // Check latest submission to enforce resubmission lock if Reviewed
        const latestSubmission = await AssignmentSubmission.findOne({
            assignmentId: assignment._id,
            studentId,
        })
            .sort({ version: -1 })
            .lean();

        if (latestSubmission && latestSubmission.status === "reviewed") {
            return sendApiError(
                res,
                403,
                "This assignment has already been marked as Reviewed by your instructor and cannot be resubmitted.",
                "SUBMISSION_LOCKED"
            );
        }

        // Validate submission inputs:
        // Must provide at least one valid Google Drive link OR non-empty text answer
        const cleanText = typeof textAnswer === "string" ? textAnswer.trim() : "";
        let cleanDriveLinks = [];

        if (driveLinks && Array.isArray(driveLinks) && driveLinks.length > 0) {
            const linkValidation = validateGoogleDriveLinks(driveLinks);
            if (!linkValidation.valid) {
                return sendApiError(res, 400, linkValidation.error, "INVALID_GOOGLE_DRIVE_LINK");
            }
            cleanDriveLinks = linkValidation.sanitizedLinks;
        }

        if (cleanDriveLinks.length === 0 && !cleanText) {
            return sendApiError(
                res,
                400,
                "Please provide at least one valid Google Drive link or a non-empty text answer.",
                "EMPTY_SUBMISSION"
            );
        }

        // Determine version number (incremented for resubmission)
        const nextVersion = latestSubmission ? (latestSubmission.version || 1) + 1 : 1;

        const submission = await AssignmentSubmission.create({
            assignmentId: assignment._id,
            courseId: assignment.courseId._id,
            studentId,
            version: nextVersion,
            driveLinks: cleanDriveLinks,
            textAnswer: cleanText,
            status: "submitted",
            submittedAt: new Date(),
        });

        // Notify course teacher via in-app notification
        await notifyTeacherOnSubmission({
            teacherId: assignment.courseId.ownerId,
            student: req.session.user,
            assignment,
            course: assignment.courseId,
            isResubmission: nextVersion > 1,
        }).catch((err) => {
            console.error("[AssignmentSubmit] Error dispatching in-app teacher notification:", err.message);
        });

        return sendApiSuccess(res, 201, {
            submission: {
                id: submission._id.toString(),
                version: submission.version,
                driveLinks: submission.driveLinks,
                textAnswer: submission.textAnswer,
                status: submission.status,
                submittedAt: submission.submittedAt,
            },
            message: nextVersion > 1
                ? `Assignment resubmitted successfully (Version ${nextVersion}).`
                : "Assignment submitted successfully.",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get in-app notifications for authenticated user
 */
export async function getNotifications(req, res, next) {
    try {
        const userId = req.session.user.id;
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const unreadCount = notifications.filter((n) => !n.isRead).length;

        return sendApiSuccess(res, 200, {
            notifications: notifications.map((n) => ({
                id: n._id.toString(),
                title: n.title,
                message: n.message,
                type: n.type,
                data: n.data || {},
                isRead: n.isRead,
                createdAt: n.createdAt,
            })),
            unreadCount,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Mark in-app notifications as read
 */
export async function markNotificationAsRead(req, res, next) {
    try {
        const userId = req.session.user.id;
        const { notificationId } = req.params;

        if (notificationId === "all") {
            await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
            return sendApiSuccess(res, 200, { markedAll: true }, "All notifications marked as read.");
        }

        if (!mongoose.isValidObjectId(notificationId)) {
            return sendApiError(res, 400, "Invalid notification ID.", "INVALID_ID");
        }

        const notif = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { isRead: true } },
            { returnDocument: "after" }
        );

        if (!notif) {
            return sendApiError(res, 404, "Notification not found.", "NOT_FOUND");
        }

        return sendApiSuccess(res, 200, { id: notif._id.toString(), isRead: true });
    } catch (error) {
        next(error);
    }
}
