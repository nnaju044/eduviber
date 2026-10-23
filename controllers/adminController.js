import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Progress from "../models/Progress.js";
import {
    sendWelcomeSetupEmail,
    sendPaymentApprovedEmail,
    sendPaymentRejectedEmail,
    sendEnrollmentActivatedEmail,
} from "../services/emailService.js";

export async function dashboard(req, res, next) {
    try {
        const [
            totalStudents,
            totalCourses,
            totalLessons,
            activeEnrollments,
            pendingPayments,
            recentCourses,
        ] = await Promise.all([
            User.countDocuments({ role: "student" }),
            Course.countDocuments(),
            Lesson.countDocuments(),
            Enrollment.countDocuments({ status: "active" }),
            Payment.countDocuments({ status: "pending" }),
            Course.find().sort({ createdAt: -1 }).limit(5).lean(),
        ]);

        res.render("admin/dashboard", {
            admin: req.session.user,
            stats: {
                totalStudents,
                totalCourses,
                totalLessons,
                activeEnrollments,
                pendingPayments,
            },
            recentCourses,
        });
    } catch (error) {
        next(error);
    }
}

export async function listCourses(req, res, next) {
    try {
        const courses = await Course.find()
            .sort({ createdAt: -1 })
            .lean();

        const courseIds = courses.map((course) => course._id);

        const lessonCounts = await Lesson.aggregate([
            { $match: { courseId: { $in: courseIds } } },
            { $group: { _id: "$courseId", count: { $sum: 1 } } },
        ]);

        const countMap = new Map(
            lessonCounts.map((item) => [item._id.toString(), item.count])
        );

        res.render("admin/courses/index", {
            courses: courses.map((course) => ({
                ...course,
                lessonCount: countMap.get(course._id.toString()) || 0,
            })),
        });
    } catch (error) {
        next(error);
    }
}

export function showCreateCourse(req, res) {
    res.render("admin/courses/new", { error: null, values: {} });
}

export async function createCourse(req, res, next) {
    try {
        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim();
        const instructor = String(req.body.instructor || "").trim();
        const thumbnail = String(req.body.thumbnail || "").trim();
        const rawPrice = String(req.body.price ?? "").trim();
        const price = Number(rawPrice);

        const values = { title, description, instructor, thumbnail, price: rawPrice };

        if (!title || !description || !rawPrice || !Number.isFinite(price) || price < 0) {
            return res.status(400).render("admin/courses/new", {
                error: "Enter a title, description and valid non-negative price.",
                values,
            });
        }

        const slug = title
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        if (!slug) {
            return res.status(400).render("admin/courses/new", {
                error: "Please use a title that can form a URL.",
                values,
            });
        }

        const existing = await Course.findOne({ slug }).lean();

        if (existing) {
            return res.status(409).render("admin/courses/new", {
                error: "A course with a similar URL already exists. Change the title.",
                values,
            });
        }

        await Course.create({
            title,
            slug,
            description,
            instructor,
            thumbnail,
            price,
            isPublished: false,
        });

        res.redirect("/admin/courses");
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).render("admin/courses/new", {
                error: "This course URL already exists. Change the title and try again.",
                values: req.body,
            });
        }

        next(error);
    }
}

export async function toggleCoursePublication(req, res, next) {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).send("Course not found.");
        }

        course.isPublished = !course.isPublished;
        await course.save();

        res.redirect("/admin/courses");
    } catch (error) {
        next(error);
    }
}

export async function showEditCourse(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).send("Course not found.");
        }

        const course = await Course.findById(id).lean();
        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const [lessonCount, paymentCount, enrollmentCount] = await Promise.all([
            Lesson.countDocuments({ courseId: course._id }),
            Payment.countDocuments({ courseId: course._id }),
            Enrollment.countDocuments({ courseId: course._id }),
        ]);

        res.render("admin/courses/edit", {
            course,
            values: course,
            error: null,
            lessonCount,
            paymentCount,
            enrollmentCount,
            hasDependencies: paymentCount > 0 || enrollmentCount > 0,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateCourse(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).send("Course not found.");
        }

        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const [lessonCount, paymentCount, enrollmentCount] = await Promise.all([
            Lesson.countDocuments({ courseId: course._id }),
            Payment.countDocuments({ courseId: course._id }),
            Enrollment.countDocuments({ courseId: course._id }),
        ]);

        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim();
        const instructor = String(req.body.instructor || "").trim();
        const thumbnail = String(req.body.thumbnail || "").trim();
        const rawPrice = String(req.body.price ?? "").trim();
        const price = Number(rawPrice);
        const customSlug = String(req.body.slug || "").trim();

        const values = {
            ...course.toObject(),
            title,
            description,
            instructor,
            thumbnail,
            price: rawPrice,
            slug: customSlug || course.slug,
        };

        if (!title || !description || !rawPrice || !Number.isFinite(price) || price < 0) {
            return res.status(400).render("admin/courses/edit", {
                course: course.toObject(),
                values,
                error: "Please enter a valid title, description, and non-negative price.",
                lessonCount,
                paymentCount,
                enrollmentCount,
                hasDependencies: paymentCount > 0 || enrollmentCount > 0,
            });
        }

        let slug = customSlug
            ? customSlug
                  .toLowerCase()
                  .normalize("NFKD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
            : course.slug;

        if (!slug) {
            slug = title
                .toLowerCase()
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
        }

        const existingSlug = await Course.findOne({
            slug,
            _id: { $ne: course._id },
        }).lean();

        if (existingSlug) {
            return res.status(409).render("admin/courses/edit", {
                course: course.toObject(),
                values: { ...values, slug },
                error: `The URL slug "${slug}" is already in use by another course. Please choose a different slug or title.`,
                lessonCount,
                paymentCount,
                enrollmentCount,
                hasDependencies: paymentCount > 0 || enrollmentCount > 0,
            });
        }

        course.title = title;
        course.slug = slug;
        course.description = description;
        course.instructor = instructor;
        course.thumbnail = thumbnail;
        course.price = price;

        if (req.body.isPublished !== undefined) {
            course.isPublished = req.body.isPublished === "true" || req.body.isPublished === true;
        }

        await course.save();
        res.redirect("/admin/courses");
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).render("admin/courses/edit", {
                course: req.body,
                values: req.body,
                error: "A course with this URL slug already exists. Please choose a different title or slug.",
            });
        }
        next(error);
    }
}

export async function deleteCourse(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).send("Course not found.");
        }

        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).send("Course not found.");
        }

        // Integrity check: Financial records and student enrollments
        const [paymentCount, enrollmentCount] = await Promise.all([
            Payment.countDocuments({ courseId: course._id }),
            Enrollment.countDocuments({ courseId: course._id }),
        ]);

        if (paymentCount > 0) {
            return res.status(400).send(
                `Cannot delete course: ${paymentCount} financial payment record(s) exist for this course. Unpublish the course instead to preserve financial audit history.`
            );
        }

        if (enrollmentCount > 0) {
            return res.status(400).send(
                `Cannot delete course: ${enrollmentCount} student enrollment(s) are attached to this course. Unpublish the course instead to preserve student access history.`
            );
        }

        const confirmation = String(req.body.confirmTitle || req.body.confirm || "").trim();
        if (confirmation !== course.title && confirmation !== "DELETE") {
            return res.status(400).send(
                `To confirm deletion, you must type the exact course title "${course.title}".`
            );
        }

        // Safely clean up associated draft lessons and any orphaned progress
        const lessons = await Lesson.find({ courseId: course._id }).select("_id").lean();
        const lessonIds = lessons.map((l) => l._id);

        if (lessonIds.length > 0) {
            await Progress.deleteMany({ lessonId: { $in: lessonIds } });
            await Lesson.deleteMany({ courseId: course._id });
        }

        await Course.findByIdAndDelete(course._id);
        res.redirect("/admin/courses");
    } catch (error) {
        next(error);
    }
}

export async function listLessons(req, res, next) {
    try {
        const course = await Course.findById(req.params.courseId).lean();

        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const lessons = await Lesson.find({ courseId: course._id })
            .sort({ order: 1 })
            .lean();

        res.render("admin/lessons/index", { course, lessons });
    } catch (error) {
        next(error);
    }
}

export async function showCreateLesson(req, res, next) {
    try {
        const course = await Course.findById(req.params.courseId).lean();

        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const lastLesson = await Lesson.findOne({ courseId: course._id })
            .sort({ order: -1 })
            .select("order")
            .lean();

        res.render("admin/lessons/new", {
            course,
            error: null,
            values: { order: (lastLesson?.order || 0) + 1 },
        });
    } catch (error) {
        next(error);
    }
}

export async function createLesson(req, res, next) {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim();
        const moduleName = String(req.body.moduleName || "Module 1").trim();
        const rawOrder = String(req.body.order ?? "").trim();
        const rawDuration = String(req.body.durationSeconds ?? "").trim();
        const bunnyVideoId = String(req.body.bunnyVideoId || "").trim();

        const order = Number(rawOrder);
        const durationSeconds = rawDuration === "" ? 0 : Number(rawDuration);

        const values = {
            title,
            description,
            moduleName,
            order: rawOrder,
            durationSeconds: rawDuration,
            bunnyVideoId,
        };

        if (
            !title ||
            title.length > 200 ||
            !moduleName ||
            moduleName.length > 100 ||
            !Number.isInteger(order) ||
            order < 1 ||
            order > 10000 ||
            !Number.isInteger(durationSeconds) ||
            durationSeconds < 0 ||
            durationSeconds > 86400 ||
            bunnyVideoId.length > 200
        ) {
            return res.status(400).render("admin/lessons/new", {
                course: course.toObject(),
                error: "Check the lesson title, module, order, duration and video ID.",
                values,
            });
        }

        const existingOrder = await Lesson.findOne({
            courseId: course._id,
            order,
        }).lean();

        if (existingOrder) {
            return res.status(409).render("admin/lessons/new", {
                course: course.toObject(),
                error: "This lesson order is already used. Choose another number.",
                values,
            });
        }

        await Lesson.create({
            courseId: course._id,
            title,
            description,
            moduleName,
            order,
            durationSeconds,
            bunnyVideoId,
            isPublished: false,
        });

        res.redirect(`/admin/courses/${course._id}/lessons`);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send(
                "That lesson order already exists. Return to the course and try another order."
            );
        }

        next(error);
    }
}

export async function toggleLessonPublication(req, res, next) {
    try {
        const lesson = await Lesson.findOne({
            _id: req.params.lessonId,
            courseId: req.params.courseId,
        });

        if (!lesson) {
            return res.status(404).send("Lesson not found.");
        }

        if (!lesson.isPublished) {
            const course = await Course.findById(lesson.courseId);

            if (!course?.isPublished) {
                return res.status(400).send(
                    "Publish the course before publishing its lessons."
                );
            }

            if (!lesson.bunnyVideoId) {
                return res.status(400).send(
                    "Attach a Bunny Stream video before publishing this lesson."
                );
            }
        }

        lesson.isPublished = !lesson.isPublished;
        await lesson.save();

        res.redirect(`/admin/courses/${lesson.courseId}/lessons`);
    } catch (error) {
        next(error);
    }
}

export async function showEditLesson(req, res, next) {
    try {
        const { courseId, lessonId } = req.params;
        if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
            return res.status(404).send("Course or lesson not found.");
        }

        const course = await Course.findById(courseId).lean();
        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const lesson = await Lesson.findOne({ _id: lessonId, courseId: course._id }).lean();
        if (!lesson) {
            return res.status(404).send("Lesson not found in this course.");
        }

        const progressCount = await Progress.countDocuments({ lessonId: lesson._id });

        res.render("admin/lessons/edit", {
            course,
            lesson,
            values: lesson,
            error: null,
            progressCount,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateLesson(req, res, next) {
    try {
        const { courseId, lessonId } = req.params;
        if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
            return res.status(404).send("Course or lesson not found.");
        }

        const course = await Course.findById(courseId).lean();
        if (!course) {
            return res.status(404).send("Course not found.");
        }

        const lesson = await Lesson.findOne({ _id: lessonId, courseId: course._id });
        if (!lesson) {
            return res.status(404).send("Lesson not found in this course.");
        }

        const progressCount = await Progress.countDocuments({ lessonId: lesson._id });

        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim();
        const moduleName = String(req.body.moduleName || "Module 1").trim();
        const rawOrder = String(req.body.order ?? "").trim();
        const rawDuration = String(req.body.durationSeconds ?? "").trim();
        const bunnyVideoId = String(req.body.bunnyVideoId || "").trim();
        const isPublished = req.body.isPublished === "true" || req.body.isPublished === true;

        const order = Number(rawOrder);
        const durationSeconds = rawDuration === "" ? 0 : Number(rawDuration);

        const values = {
            ...lesson.toObject(),
            title,
            description,
            moduleName,
            order: rawOrder,
            durationSeconds: rawDuration,
            bunnyVideoId,
            isPublished,
        };

        if (
            !title ||
            title.length > 200 ||
            !moduleName ||
            moduleName.length > 100 ||
            !Number.isInteger(order) ||
            order < 1 ||
            order > 10000 ||
            !Number.isInteger(durationSeconds) ||
            durationSeconds < 0 ||
            durationSeconds > 86400 ||
            bunnyVideoId.length > 200
        ) {
            return res.status(400).render("admin/lessons/edit", {
                course,
                lesson: lesson.toObject(),
                values,
                error: "Check the lesson title, module, order, duration, and video ID.",
                progressCount,
            });
        }

        // Check order conflict with other lessons in this course
        const existingOrder = await Lesson.findOne({
            courseId: course._id,
            order,
            _id: { $ne: lesson._id },
        }).lean();

        if (existingOrder) {
            return res.status(409).render("admin/lessons/edit", {
                course,
                lesson: lesson.toObject(),
                values,
                error: `Lesson order ${order} is already used by another lesson in this course. Please choose a different order number.`,
                progressCount,
            });
        }

        // Publication guard: A lesson cannot be published unless the parent course is published AND a valid video ID is attached
        if (isPublished) {
            if (!course.isPublished) {
                return res.status(400).render("admin/lessons/edit", {
                    course,
                    lesson: lesson.toObject(),
                    values,
                    error: "Cannot publish lesson: Parent course is currently in draft. Publish the course before publishing its lessons.",
                    progressCount,
                });
            }

            if (!bunnyVideoId) {
                return res.status(400).render("admin/lessons/edit", {
                    course,
                    lesson: lesson.toObject(),
                    values,
                    error: "Cannot publish lesson: A valid Bunny Stream video ID is required before publishing.",
                    progressCount,
                });
            }
        }

        lesson.title = title;
        lesson.description = description;
        lesson.moduleName = moduleName;
        lesson.order = order;
        lesson.durationSeconds = durationSeconds;
        lesson.bunnyVideoId = bunnyVideoId;
        if (req.body.isPublished !== undefined) {
            lesson.isPublished = isPublished;
        }

        await lesson.save();
        res.redirect(`/admin/courses/${course._id}/lessons`);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send(
                "That lesson order already exists. Return to the course and choose another order."
            );
        }
        next(error);
    }
}

export async function deleteLesson(req, res, next) {
    try {
        const { courseId, lessonId } = req.params;
        if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
            return res.status(404).send("Course or lesson not found.");
        }

        const lesson = await Lesson.findOne({ _id: lessonId, courseId });
        if (!lesson) {
            return res.status(404).send("Lesson not found in this course.");
        }

        const progressCount = await Progress.countDocuments({ lessonId: lesson._id });

        if (progressCount > 0) {
            const confirmation = String(req.body.confirm || "").trim();
            if (confirmation !== "DELETE") {
                return res.status(400).send(
                    `Cannot delete lesson: ${progressCount} student progress record(s) exist for this lesson. Unpublish the lesson instead to preserve student progress, or confirm deletion with confirm=DELETE.`
                );
            }
            await Progress.deleteMany({ lessonId: lesson._id });
        }

        await Lesson.findByIdAndDelete(lesson._id);
        res.redirect(`/admin/courses/${courseId}/lessons`);
    } catch (error) {
        next(error);
    }
}

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function listStudents(req, res, next) {
    try {
        const rawSearch = String(req.query.search || "").trim();
        const rawPage = parseInt(req.query.page, 10);
        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit = 15;
        const skip = (page - 1) * limit;

        const query = { role: "student" };
        if (rawSearch) {
            const escaped = escapeRegex(rawSearch);
            query.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { email: { $regex: escaped, $options: "i" } },
                { phone: { $regex: escaped, $options: "i" } },
            ];
        }

        const [totalCount, students] = await Promise.all([
            User.countDocuments(query),
            User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ]);

        const studentIds = students.map((s) => s._id);
        const enrollmentCounts = await Enrollment.aggregate([
            { $match: { userId: { $in: studentIds } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
        ]);

        const countMap = new Map(
            enrollmentCounts.map((item) => [item._id.toString(), item.count])
        );

        const enrichedStudents = students.map((s) => ({
            ...s,
            enrollmentCount: countMap.get(s._id.toString()) || 0,
        }));

        const totalPages = Math.ceil(totalCount / limit) || 1;

        res.render("admin/students/index", {
            students: enrichedStudents,
            search: rawSearch,
            page,
            totalPages,
            totalCount,
        });
    } catch (error) {
        next(error);
    }
}

export function showCreateStudent(req, res) {
    res.render("admin/students/new", { error: null, values: {} });
}

export async function createStudent(req, res, next) {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const phone = String(req.body.phone || "").trim();
        const password = String(req.body.password || "");
        const isActive = req.body.isActive !== "false" && req.body.isActive !== false;

        const values = { name, email, phone };

        if (!name || name.length > 100) {
            return res.status(400).render("admin/students/new", {
                error: "Please enter a valid student name (up to 100 characters).",
                values,
            });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).render("admin/students/new", {
                error: "Please enter a valid email address.",
                values,
            });
        }

        if (!phone || phone.length < 7 || phone.length > 20) {
            return res.status(400).render("admin/students/new", {
                error: "Please enter a valid phone number (7 to 20 digits).",
                values,
            });
        }

        if (!password || password.length < 8) {
            return res.status(400).render("admin/students/new", {
                error: "Temporary password must be at least 8 characters.",
                values,
            });
        }

        const existingUser = await User.findOne({ email }).lean();
        if (existingUser) {
            return res.status(409).render("admin/students/new", {
                error: "An account with this email address already exists.",
                values,
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const resetToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

        const newStudent = await User.create({
            name,
            email,
            phone,
            passwordHash,
            role: "student",
            mustChangePassword: true,
            isActive,
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days for initial account setup
        });

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        sendWelcomeSetupEmail({ user: newStudent, resetToken, baseUrl }).catch((err) => {
            console.error("[Student] Error sending welcome email:", err.message);
        });

        res.redirect(`/admin/students/${newStudent._id}`);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).render("admin/students/new", {
                error: "An account with this email address already exists.",
                values: req.body,
            });
        }
        next(error);
    }
}

export async function showStudentDetail(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).send("Student not found.");
        }

        const student = await User.findOne({ _id: id, role: "student" }).lean();
        if (!student) {
            return res.status(404).send("Student not found.");
        }

        const [enrollments, publishedCourses] = await Promise.all([
            Enrollment.find({ userId: student._id })
                .populate("courseId")
                .sort({ createdAt: -1 })
                .lean(),
            Course.find({ isPublished: true }).sort({ title: 1 }).lean(),
        ]);

        const enrolledCourseIds = new Set(
            enrollments
                .filter((e) => e.courseId)
                .map((e) => e.courseId._id.toString())
        );

        const availableCourses = publishedCourses.filter(
            (c) => !enrolledCourseIds.has(c._id.toString())
        );

        res.render("admin/students/show", {
            student,
            enrollments,
            availableCourses,
            error: req.query.error || null,
            success: req.query.success || null,
        });
    } catch (error) {
        next(error);
    }
}

export async function listEnrollments(req, res, next) {
    try {
        const rawStatus = String(req.query.status || "").trim().toLowerCase();
        const rawPage = parseInt(req.query.page, 10);
        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const query = {};
        const validStatuses = ["pending", "active", "suspended", "expired"];
        if (validStatuses.includes(rawStatus)) {
            query.status = rawStatus;
        }

        const [totalCount, enrollments, publishedCourses, students] = await Promise.all([
            Enrollment.countDocuments(query),
            Enrollment.find(query)
                .populate("userId", "name email phone isActive")
                .populate("courseId", "title slug price isPublished")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Course.find({ isPublished: true }).sort({ title: 1 }).lean(),
            User.find({ role: "student", isActive: true }).select("name email").sort({ name: 1 }).lean(),
        ]);

        const totalPages = Math.ceil(totalCount / limit) || 1;

        res.render("admin/enrollments/index", {
            enrollments,
            publishedCourses,
            students,
            currentStatus: rawStatus,
            page,
            totalPages,
            totalCount,
            error: req.query.error || null,
            success: req.query.success || null,
        });
    } catch (error) {
        next(error);
    }
}

export async function createEnrollment(req, res, next) {
    try {
        const userId = String(req.body.userId || "").trim();
        const courseId = String(req.body.courseId || "").trim();
        const status = String(req.body.status || "active").trim().toLowerCase();
        const redirectUrl = String(req.body.redirectUrl || "/admin/enrollments");

        const validStatuses = ["pending", "active", "suspended", "expired"];
        if (!validStatuses.includes(status)) {
            return res.status(400).send("Invalid enrollment status.");
        }

        if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(courseId)) {
            return res.status(400).send("Invalid student or course ID.");
        }

        const [student, course] = await Promise.all([
            User.findOne({ _id: userId, role: "student" }).lean(),
            Course.findById(courseId).lean(),
        ]);

        if (!student) {
            return res.status(404).send("Student not found.");
        }

        if (!course) {
            return res.status(404).send("Course not found.");
        }

        if (!course.isPublished) {
            return res.status(400).send("Cannot enroll students in an unpublished draft course.");
        }

        const existing = await Enrollment.findOne({ userId, courseId }).lean();
        if (existing) {
            return res.status(409).send("Student is already enrolled in this course.");
        }

        await Enrollment.create({
            userId,
            courseId,
            status,
            approvedAt: status === "active" ? new Date() : null,
        });

        if (status === "active") {
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            sendEnrollmentActivatedEmail({ user: student, course, baseUrl }).catch((err) => {
                console.error("[Enrollment] Error sending activated email:", err.message);
            });
        }

        res.redirect(redirectUrl);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send("Student is already enrolled in this course.");
        }
        next(error);
    }
}

export async function updateEnrollmentStatus(req, res, next) {
    try {
        const { id } = req.params;
        const newStatus = String(req.body.status || "").trim().toLowerCase();
        const redirectUrl = String(req.body.redirectUrl || "/admin/enrollments");

        const validStatuses = ["pending", "active", "suspended", "expired"];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).send("Invalid enrollment status transition.");
        }

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).send("Enrollment not found.");
        }

        const enrollment = await Enrollment.findById(id);
        if (!enrollment) {
            return res.status(404).send("Enrollment not found.");
        }

        enrollment.status = newStatus;
        if (newStatus === "active" && !enrollment.approvedAt) {
            enrollment.approvedAt = new Date();
        }

        await enrollment.save();

        res.redirect(redirectUrl);
    } catch (error) {
        next(error);
    }
}

export async function listPayments(req, res, next) {
    try {
        const rawStatus = String(req.query.status || "pending").trim().toLowerCase();
        const rawPage = parseInt(req.query.page, 10);
        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const query = {};
        const validStatuses = ["pending", "approved", "rejected"];
        if (validStatuses.includes(rawStatus)) {
            query.status = rawStatus;
        }

        const [
            pendingCount,
            approvedCount,
            rejectedCount,
            totalCount,
            payments,
        ] = await Promise.all([
            Payment.countDocuments({ status: "pending" }),
            Payment.countDocuments({ status: "approved" }),
            Payment.countDocuments({ status: "rejected" }),
            Payment.countDocuments(query),
            Payment.find(query)
                .populate("userId", "name email phone isActive")
                .populate("courseId", "title slug price isPublished")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const totalPages = Math.ceil(totalCount / limit) || 1;

        res.render("admin/payments/index", {
            payments,
            counts: {
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount,
                all: pendingCount + approvedCount + rejectedCount,
            },
            currentStatus: rawStatus,
            page,
            totalPages,
            totalCount,
            error: req.query.error || null,
            success: req.query.success || null,
        });
    } catch (error) {
        next(error);
    }
}

export async function approvePayment(req, res, next) {
    const session = await mongoose.startSession().catch(() => null);
    try {
        const { id } = req.params;
        const redirectUrl = String(req.body.redirectUrl || "/admin/payments?status=pending");

        if (!mongoose.isValidObjectId(id)) {
            if (session) session.endSession();
            return res.status(404).send("Payment record not found.");
        }

        if (session) {
            try {
                session.startTransaction();

                const payment = await Payment.findById(id).session(session);
                if (!payment) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).send("Payment record not found.");
                }

                // If already approved, return without duplicating side effects
                if (payment.status === "approved") {
                    await session.commitTransaction();
                    session.endSession();
                    return res.redirect(redirectUrl);
                }

                payment.status = "approved";
                payment.reviewedAt = new Date();
                payment.rejectionReason = "";
                await payment.save({ session });

                // Activate or create enrollment
                await Enrollment.findOneAndUpdate(
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

                // Non-blocking approval notification
                notifyPaymentApproval(req, payment);

                return res.redirect(redirectUrl);
            } catch (txErr) {
                await session.abortTransaction().catch(() => {});
                session.endSession();
                throw txErr;
            }
        } else {
            // Conditional fallback without session
            const payment = await Payment.findById(id);
            if (!payment) {
                return res.status(404).send("Payment record not found.");
            }

            if (payment.status === "approved") {
                return res.redirect(redirectUrl);
            }

            payment.status = "approved";
            payment.reviewedAt = new Date();
            payment.rejectionReason = "";
            await payment.save();

            await Enrollment.findOneAndUpdate(
                { userId: payment.userId, courseId: payment.courseId },
                {
                    $set: {
                        status: "active",
                        approvedAt: new Date(),
                    },
                },
                { upsert: true, returnDocument: "after" }
            );

            // Non-blocking approval notification
            notifyPaymentApproval(req, payment);

            return res.redirect(redirectUrl);
        }
    } catch (error) {
        next(error);
    }
}

async function notifyPaymentApproval(req, payment) {
    try {
        const [payUser, payCourse] = await Promise.all([
            User.findById(payment.userId).lean(),
            Course.findById(payment.courseId).lean(),
        ]);
        if (payUser && payCourse) {
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            await sendPaymentApprovedEmail({
                user: payUser,
                course: payCourse,
                payment,
                baseUrl,
            });
        }
    } catch (notifyErr) {
        console.error("[Payment] Notification error on approve:", notifyErr.message);
    }
}

export async function rejectPayment(req, res, next) {
    try {
        const { id } = req.params;
        const rejectionReason = String(req.body.rejectionReason || "").trim();
        const redirectUrl = String(req.body.redirectUrl || "/admin/payments?status=pending");

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).send("Payment record not found.");
        }

        if (!rejectionReason || rejectionReason.length < 3) {
            return res.status(400).send("A clear rejection reason is required (at least 3 characters).");
        }

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).send("Payment record not found.");
        }

        payment.status = "rejected";
        payment.reviewedAt = new Date();
        payment.rejectionReason = rejectionReason;
        await payment.save();

        // Non-blocking rejection notification
        (async () => {
            try {
                const [payUser, payCourse] = await Promise.all([
                    User.findById(payment.userId).lean(),
                    Course.findById(payment.courseId).lean(),
                ]);
                if (payUser && payCourse) {
                    const baseUrl = `${req.protocol}://${req.get("host")}`;
                    await sendPaymentRejectedEmail({
                        user: payUser,
                        course: payCourse,
                        payment,
                        rejectionReason,
                        baseUrl,
                    });
                }
            } catch (notifyErr) {
                console.error("[Payment] Notification error on reject:", notifyErr.message);
            }
        })();

        res.redirect(redirectUrl);
    } catch (error) {
        next(error);
    }
}