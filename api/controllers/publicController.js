import mongoose from "mongoose";
import Course from "../../models/Course.js";
import Lesson from "../../models/Lesson.js";
import User from "../../models/User.js";
import { sendApiError, sendApiSuccess } from "../middleware/apiAuth.js";

/**
 * Lists published courses for storefront discovery
 */
export async function listCourses(req, res, next) {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
        const skip = (page - 1) * limit;
        const search = String(req.query.q || "").trim();
        const teacherId = req.query.teacherId;

        const filter = { isPublished: true };

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { instructor: { $regex: search, $options: "i" } },
            ];
        }

        if (teacherId && mongoose.isValidObjectId(teacherId)) {
            filter.ownerId = teacherId;
        }

        const [courses, total] = await Promise.all([
            Course.find(filter)
                .select("title slug description price thumbnail instructor ownerId createdAt")
                .populate("ownerId", "name teacherProfile.headline")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Course.countDocuments(filter),
        ]);

        const sanitizedCourses = courses.map((c) => ({
            id: c._id.toString(),
            title: c.title,
            slug: c.slug,
            description: c.description,
            price: c.price,
            thumbnail: c.thumbnail,
            instructor: c.instructor,
            teacher: c.ownerId
                ? {
                    id: c.ownerId._id.toString(),
                    name: c.ownerId.name,
                    headline: c.ownerId.teacherProfile?.headline || "",
                }
                : null,
            createdAt: c.createdAt,
        }));

        return sendApiSuccess(res, 200, {
            courses: sanitizedCourses,
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
 * Returns public course details and public syllabus (hiding video IDs and draft lessons)
 */
export async function getCourseDetails(req, res, next) {
    try {
        const { slug } = req.params;

        const course = await Course.findOne({ slug, isPublished: true })
            .select("title slug description price thumbnail instructor ownerId createdAt")
            .populate("ownerId", "name teacherProfile.headline teacherProfile.bio")
            .lean();

        if (!course) {
            return sendApiError(res, 404, "Course not found or is currently unpublished.", "NOT_FOUND");
        }

        // Only fetch published lessons; NEVER leak bunnyVideoId or private content
        const lessons = await Lesson.find({ courseId: course._id, isPublished: true })
            .select("title moduleName order durationMinutes durationSeconds isFreePreview")
            .sort({ order: 1 })
            .lean();

        const syllabus = lessons.map((l) => ({
            id: l._id.toString(),
            title: l.title,
            moduleName: l.moduleName || "General",
            order: l.order,
            durationMinutes: l.durationMinutes || (l.durationSeconds ? Math.round(l.durationSeconds / 60) : 0),
            durationSeconds: l.durationSeconds || (l.durationMinutes ? l.durationMinutes * 60 : 0),
            isFreePreview: Boolean(l.isFreePreview),
        }));

        return sendApiSuccess(res, 200, {
            course: {
                id: course._id.toString(),
                title: course.title,
                slug: course.slug,
                description: course.description,
                price: course.price,
                thumbnail: course.thumbnail,
                instructor: course.instructor,
                teacher: course.ownerId
                    ? {
                        id: course.ownerId._id.toString(),
                        name: course.ownerId.name,
                        headline: course.ownerId.teacherProfile?.headline || "",
                        bio: course.ownerId.teacherProfile?.bio || "",
                    }
                    : null,
                createdAt: course.createdAt,
            },
            syllabus,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Lists public profiles of approved and active teachers
 */
export async function listTeachers(req, res, next) {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
        const skip = (page - 1) * limit;
        const search = String(req.query.q || "").trim();

        const filter = {
            role: "teacher",
            isActive: true,
            "teacherProfile.isApproved": true,
        };

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { "teacherProfile.headline": { $regex: search, $options: "i" } },
                { "teacherProfile.bio": { $regex: search, $options: "i" } },
            ];
        }

        const [teachers, total] = await Promise.all([
            User.find(filter)
                .select("name teacherProfile.headline teacherProfile.bio createdAt")
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        const sanitized = teachers.map((t) => ({
            id: t._id.toString(),
            name: t.name,
            headline: t.teacherProfile?.headline || "",
            bio: t.teacherProfile?.bio || "",
            joinedAt: t.createdAt,
        }));

        return sendApiSuccess(res, 200, {
            teachers: sanitized,
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
 * Returns public profile of a teacher and their published courses
 */
export async function getTeacherProfile(req, res, next) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return sendApiError(res, 404, "Teacher not found", "NOT_FOUND");
        }

        const teacher = await User.findOne({
            _id: id,
            role: "teacher",
            isActive: true,
            "teacherProfile.isApproved": true,
        })
            .select("name teacherProfile.headline teacherProfile.bio createdAt")
            .lean();

        if (!teacher) {
            return sendApiError(res, 404, "Teacher profile not found or is currently unavailable.", "NOT_FOUND");
        }

        const courses = await Course.find({ ownerId: teacher._id, isPublished: true })
            .select("title slug description price thumbnail createdAt")
            .sort({ createdAt: -1 })
            .lean();

        return sendApiSuccess(res, 200, {
            teacher: {
                id: teacher._id.toString(),
                name: teacher.name,
                headline: teacher.teacherProfile?.headline || "",
                bio: teacher.teacherProfile?.bio || "",
                joinedAt: teacher.createdAt,
            },
            courses: courses.map((c) => ({
                id: c._id.toString(),
                title: c.title,
                slug: c.slug,
                description: c.description,
                price: c.price,
                thumbnail: c.thumbnail,
                createdAt: c.createdAt,
            })),
        });
    } catch (error) {
        next(error);
    }
}
