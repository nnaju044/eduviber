import mongoose from "mongoose";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";
import Payment from "../models/Payment.js";
import { verifyBunnyVideo, createSignedEmbedUrl } from "../config/bunny.js";

export async function watchLesson(req, res, next) {
    try {
        const { courseId, lessonId } = req.params;

        if (
            !mongoose.isValidObjectId(courseId) ||
            !mongoose.isValidObjectId(lessonId)
        ) {
            return res.status(404).send("Lesson not found.");
        }

        const course = await Course.findOne({
            _id: courseId,
            isPublished: true,
        }).lean();

        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const enrollment = await Enrollment.findOne({
            userId: req.session.user.id,
            courseId: course._id,
            status: "active",
        }).lean();

        if (!enrollment && req.session.user.role !== "admin") {
            return res.status(403).send("You do not have access to this course.");
        }

        const lesson = await Lesson.findOne({
            _id: lessonId,
            courseId: course._id,
            isPublished: true,
        }).lean();

        if (!lesson) {
            return res.status(404).send("Lesson not found or not published.");
        }

        if (!lesson.bunnyVideoId) {
            return res.status(404).send("This lesson has no video attached.");
        }

        const video = await verifyBunnyVideo(lesson.bunnyVideoId);

        if (!video.exists) {
            return res.status(503).send("The lesson video is currently unavailable.");
        }

        const progress = await Progress.findOne({
            userId: req.session.user.id,
            lessonId: lesson._id,
        }).lean();

        // Query all published lessons in this course to compute prev & next navigation
        const allLessons = await Lesson.find({
            courseId: course._id,
            isPublished: true,
        })
            .sort({ order: 1 })
            .select("_id title order moduleName")
            .lean();

        const currentIndex = allLessons.findIndex(
            (l) => l._id.toString() === lesson._id.toString()
        );
        const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
        const nextLesson =
            currentIndex >= 0 && currentIndex < allLessons.length - 1
                ? allLessons[currentIndex + 1]
                : null;

        res.set("Cache-Control", "no-store, private");

        res.render("student/lesson", {
            course,
            lesson,
            videoUrl: createSignedEmbedUrl(lesson.bunnyVideoId),
            studentEmail: req.session.user.email,
            lastPositionSeconds: progress?.lastPositionSeconds || 0,
            isCompleted: Boolean(progress?.completed),
            prevLesson,
            nextLesson,
            currentIndex,
            totalLessonsCount: allLessons.length,
        });
    } catch (error) {
        next(error);
    }
}

export async function saveLessonProgress(req, res, next) {
    try {
        const { courseId, lessonId } = req.params;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Authentication required." });
        }

        if (
            !mongoose.isValidObjectId(courseId) ||
            !mongoose.isValidObjectId(lessonId)
        ) {
            return res.status(404).json({ error: "Lesson not found." });
        }

        const course = await Course.findOne({
            _id: courseId,
            isPublished: true,
        }).select("_id").lean();

        if (!course) {
            return res.status(404).json({ error: "Course not found." });
        }

        const enrollment = await Enrollment.findOne({
            userId,
            courseId: course._id,
            status: "active",
        }).select("_id").lean();

        if (!enrollment && req.session.user.role !== "admin") {
            return res.status(403).json({ error: "Access denied." });
        }

        const lesson = await Lesson.findOne({
            _id: lessonId,
            courseId: course._id,
            isPublished: true,
        }).select("_id durationSeconds").lean();

        if (!lesson) {
            return res.status(404).json({ error: "Lesson not found." });
        }

        const rawPosition = req.body.position;
        const position = Number(rawPosition);
        const completed = req.body.completed === true;

        if (!Number.isFinite(position) || position < 0) {
            return res.status(400).json({ error: "Invalid position." });
        }

        // Allow a small tolerance for player duration rounding.
        if (
            lesson.durationSeconds > 0 &&
            position > lesson.durationSeconds + 10
        ) {
            return res.status(400).json({ error: "Position exceeds lesson duration." });
        }

        const safePosition = Math.floor(position);

        const updateOps = {
            $set: {
                lastPositionSeconds: completed ? 0 : safePosition,
                lastWatchedAt: new Date(),
            },
            $setOnInsert: {
                userId,
                lessonId: lesson._id,
            },
        };

        if (completed) {
            updateOps.$set.completed = true;
        }

        const updatedProgress = await Progress.findOneAndUpdate(
            { userId, lessonId: lesson._id },
            updateOps,
            { upsert: true, returnDocument: "after", runValidators: true }
        );

        return res.json({
            success: true,
            lastPositionSeconds: updatedProgress.lastPositionSeconds,
            completed: updatedProgress.completed,
        });
    } catch (error) {
        next(error);
    }
}

export async function studentDashboard(req, res, next) {
    try {
        const user = req.session.user;

        // Ensure administrators keep their admin dashboard
        if (user.role === "admin") {
            return res.redirect("/admin");
        }

        const userId = user.id;

        // 1. Query active enrollments for this student
        const enrollments = await Enrollment.find({
            userId,
            status: "active",
        }).lean();

        const enrolledCourseIds = enrollments.map((e) => e.courseId);

        // 2. Query published courses
        const courses = await Course.find({
            _id: { $in: enrolledCourseIds },
            isPublished: true,
        }).lean();

        const publishedCourseIds = courses.map((c) => c._id);

        // 3. Query published lessons for these courses in order
        const lessons = await Lesson.find({
            courseId: { $in: publishedCourseIds },
            isPublished: true,
        })
            .sort({ order: 1 })
            .lean();

        // 4. Query progress records for this student and these lessons
        const lessonIds = lessons.map((l) => l._id);
        const progressRecords = await Progress.find({
            userId,
            lessonId: { $in: lessonIds },
        }).lean();

        const progressMap = new Map();
        for (const p of progressRecords) {
            progressMap.set(p.lessonId.toString(), p);
        }

        // 5. Structure course progress, lesson modules, and next action
        const coursesWithData = courses.map((course) => {
            const courseLessons = lessons.filter(
                (l) => l.courseId.toString() === course._id.toString()
            );

            let completedCount = 0;
            const enrichedLessons = courseLessons.map((lesson) => {
                const prog = progressMap.get(lesson._id.toString());
                const isCompleted = Boolean(prog?.completed);
                if (isCompleted) completedCount++;

                return {
                    ...lesson,
                    isCompleted,
                    lastPositionSeconds: prog?.lastPositionSeconds || 0,
                };
            });

            // Group lessons by moduleName preserving lesson order
            const modulesMap = new Map();
            for (const lesson of enrichedLessons) {
                const modName = lesson.moduleName || "General";
                if (!modulesMap.has(modName)) {
                    modulesMap.set(modName, []);
                }
                modulesMap.get(modName).push(lesson);
            }

            const modules = Array.from(modulesMap.entries()).map(([name, modLessons]) => ({
                name,
                lessons: modLessons,
            }));

            const totalLessons = courseLessons.length;
            const progressPercent =
                totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

            const nextLesson =
                enrichedLessons.find((l) => !l.isCompleted) || enrichedLessons[0] || null;

            return {
                ...course,
                lessons: enrichedLessons,
                modules,
                totalLessons,
                completedLessons: completedCount,
                progressPercent,
                nextLesson,
            };
        });

        // 6. Overall stats across active enrolled courses
        const totalCourses = coursesWithData.length;
        let totalCompletedLessons = 0;
        let totalPublishedLessons = 0;

        for (const c of coursesWithData) {
            totalCompletedLessons += c.completedLessons;
            totalPublishedLessons += c.totalLessons;
        }

        const overallProgressPercent =
            totalPublishedLessons > 0
                ? Math.round((totalCompletedLessons / totalPublishedLessons) * 100)
                : 0;

        // 7. Query student's payment submissions for verification history
        const payments = await Payment.find({ userId })
            .populate("courseId", "title slug price")
            .sort({ createdAt: -1 })
            .lean();

        res.render("student/dashboard", {
            student: user,
            courses: coursesWithData,
            payments,
            stats: {
                totalCourses,
                totalCompletedLessons,
                totalPublishedLessons,
                overallProgressPercent,
            },
        });
    } catch (error) {
        next(error);
    }
}
