import mongoose from "mongoose";
import ContentAccess from "../models/ContentAccess.js";
import Lesson from "../models/Lesson.js";

/**
 * Returns ordered list of unique module names for a course based on published lessons.
 */
export async function getCourseModules(courseId, session = null) {
    const query = Lesson.find({ courseId, isPublished: true }).sort({ order: 1 }).select("moduleName order");
    if (session) query.session(session);
    const lessons = await query.lean();

    const modules = [];
    const seen = new Set();
    for (const l of lessons) {
        const mod = l.moduleName || "General";
        if (!seen.has(mod)) {
            seen.add(mod);
            modules.push(mod);
        }
    }
    return modules;
}

/**
 * Initializes default content access for a newly enrolled student:
 * - First module: Unlocked
 * - Every lesson in the first module: Unlocked
 * - All remaining modules: Locked
 * - Every lesson in locked modules: Locked
 *
 * Idempotent: does not overwrite if an access record already exists.
 */
export async function initializeStudentEnrollmentAccess(courseId, studentId, session = null) {
    if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(studentId)) {
        return null;
    }

    const existingQuery = ContentAccess.findOne({
        courseId,
        scope: "student",
        userId: studentId,
    });
    if (session) existingQuery.session(session);
    const existing = await existingQuery;
    if (existing) {
        return existing;
    }

    // Determine first module and its lessons
    const lessonsQuery = Lesson.find({ courseId, isPublished: true }).sort({ order: 1 });
    if (session) lessonsQuery.session(session);
    const lessons = await lessonsQuery.lean();

    if (!lessons.length) {
        const record = new ContentAccess({
            courseId,
            scope: "student",
            userId: studentId,
            unlockedModules: ["General"],
            unlockedLessons: [],
        });
        if (session) await record.save({ session });
        else await record.save();
        return record;
    }

    const firstModuleName = lessons[0].moduleName || "General";
    const firstModuleLessonIds = lessons
        .filter((l) => (l.moduleName || "General") === firstModuleName)
        .map((l) => l._id);

    const record = new ContentAccess({
        courseId,
        scope: "student",
        userId: studentId,
        unlockedModules: [firstModuleName],
        unlockedLessons: firstModuleLessonIds,
    });

    if (session) await record.save({ session });
    else await record.save();

    return record;
}

/**
 * Gets or creates the course-wide baseline access record.
 * Default for course baseline: first module and its lessons unlocked; remaining locked.
 */
export async function getOrCreateCourseBaselineAccess(courseId, session = null) {
    const existingQuery = ContentAccess.findOne({ courseId, scope: "course", userId: null });
    if (session) existingQuery.session(session);
    let record = await existingQuery;
    if (record) return record;

    const lessonsQuery = Lesson.find({ courseId, isPublished: true }).sort({ order: 1 });
    if (session) lessonsQuery.session(session);
    const lessons = await lessonsQuery.lean();

    const firstModuleName = lessons.length > 0 ? (lessons[0].moduleName || "General") : "General";
    const firstModuleLessonIds = lessons
        .filter((l) => (l.moduleName || "General") === firstModuleName)
        .map((l) => l._id);

    record = new ContentAccess({
        courseId,
        scope: "course",
        userId: null,
        unlockedModules: [firstModuleName],
        unlockedLessons: firstModuleLessonIds,
    });

    try {
        if (session) await record.save({ session });
        else await record.save();
    } catch (err) {
        if (err.code === 11000) {
            record = await ContentAccess.findOne({ courseId, scope: "course", userId: null });
        } else {
            throw err;
        }
    }
    return record;
}

/**
 * Computes effective unlocked status for a student across all modules and lessons of a course.
 *
 * Precedence hierarchy:
 * 1. Individual student override record (if present)
 * 2. Course-level baseline record (if present)
 * 3. Fallback default: First module + first module's lessons unlocked.
 *
 * Enforcement rule:
 * - A module is unlocked if included in unlockedModules.
 * - A lesson is EFFECTIVELY unlocked if and only if:
 *     (a) Its parent module is unlocked, AND
 *     (b) Its lesson ID is included in unlockedLessons.
 */
export async function computeEffectiveAccess(courseId, studentId = null) {
    let accessRecord = null;

    if (studentId) {
        accessRecord = await ContentAccess.findOne({
            courseId,
            scope: "student",
            userId: studentId,
        }).lean();
    }

    if (!accessRecord) {
        accessRecord = await ContentAccess.findOne({
            courseId,
            scope: "course",
            userId: null,
        }).lean();
    }

    const lessons = await Lesson.find({ courseId, isPublished: true })
        .sort({ order: 1 })
        .select("_id title moduleName order durationMinutes durationSeconds isFreePreview")
        .lean();

    const modules = [];
    const seenModules = new Set();
    for (const l of lessons) {
        const mod = l.moduleName || "General";
        if (!seenModules.has(mod)) {
            seenModules.add(mod);
            modules.push(mod);
        }
    }

    // Determine unlocked modules set & unlocked lessons set
    let unlockedModuleSet = new Set();
    let unlockedLessonIdSet = new Set();

    if (accessRecord) {
        unlockedModuleSet = new Set(accessRecord.unlockedModules || []);
        unlockedLessonIdSet = new Set((accessRecord.unlockedLessons || []).map((id) => id.toString()));
    } else if (modules.length > 0) {
        // Safe default: first module and its lessons
        const firstMod = modules[0];
        unlockedModuleSet.add(firstMod);
        for (const l of lessons) {
            if ((l.moduleName || "General") === firstMod) {
                unlockedLessonIdSet.add(l._id.toString());
            }
        }
    }

    const moduleStatusMap = {};
    for (const mod of modules) {
        moduleStatusMap[mod] = {
            name: mod,
            isUnlocked: unlockedModuleSet.has(mod),
        };
    }

    const lessonStatusMap = {};
    for (const l of lessons) {
        const modName = l.moduleName || "General";
        const isModuleUnlocked = unlockedModuleSet.has(modName);
        const isLessonDirectlyUnlocked = unlockedLessonIdSet.has(l._id.toString());
        // Combined access rule: parent module MUST be unlocked AND lesson MUST be unlocked
        const isEffectivelyUnlocked = Boolean(isModuleUnlocked && isLessonDirectlyUnlocked);

        lessonStatusMap[l._id.toString()] = {
            id: l._id.toString(),
            title: l.title,
            moduleName: modName,
            isModuleUnlocked,
            isLessonDirectlyUnlocked,
            isEffectivelyUnlocked,
            isFreePreview: Boolean(l.isFreePreview),
        };
    }

    return {
        scope: accessRecord?.scope || (studentId ? "student_default" : "course_default"),
        userId: studentId,
        courseId: courseId.toString(),
        modules: moduleStatusMap,
        lessons: lessonStatusMap,
    };
}

/**
 * Checks whether a student has authorized access to stream or access a specific lesson.
 */
export async function assertStudentLessonAccess(courseId, studentId, lessonId, isFreePreview = false) {
    if (isFreePreview) {
        return { authorized: true, reason: "free_preview" };
    }

    const effective = await computeEffectiveAccess(courseId, studentId);
    const lessonInfo = effective.lessons[lessonId.toString()];

    if (!lessonInfo) {
        return { authorized: false, code: "LESSON_NOT_FOUND", message: "Lesson not found in course access roster." };
    }

    if (!lessonInfo.isModuleUnlocked) {
        return {
            authorized: false,
            code: "MODULE_LOCKED",
            message: `Module "${lessonInfo.moduleName}" is currently locked by the instructor.`,
            moduleName: lessonInfo.moduleName,
        };
    }

    if (!lessonInfo.isLessonDirectlyUnlocked || !lessonInfo.isEffectivelyUnlocked) {
        return {
            authorized: false,
            code: "LESSON_LOCKED",
            message: `Lesson "${lessonInfo.title}" is currently locked by the instructor.`,
            lessonTitle: lessonInfo.title,
        };
    }

    return { authorized: true, reason: "unlocked" };
}

/**
 * Checks whether an assignment is accessible to a student based on:
 * 1. Assignment isEnabled status (must be true)
 * 2. Assignment scope:
 *    - course: active enrollment
 *    - module: parent module must be unlocked in effectiveAccess
 *    - lesson: parent module AND lesson must be unlocked in effectiveAccess
 */
export async function assertStudentAssignmentAccess(assignment, studentId) {
    if (!assignment || !assignment.isEnabled) {
        return {
            authorized: false,
            code: "ASSIGNMENT_DISABLED",
            message: "This assignment is currently disabled by the instructor.",
        };
    }

    if (assignment.scope === "course") {
        return { authorized: true };
    }

    const effective = await computeEffectiveAccess(assignment.courseId, studentId);

    if (assignment.scope === "module") {
        const modName = assignment.moduleName || "General";
        const modStatus = effective.modules[modName];
        if (!modStatus || !modStatus.isUnlocked) {
            return {
                authorized: false,
                code: "MODULE_LOCKED",
                message: `Module "${modName}" is locked. Associated assignments are not accessible.`,
                moduleName: modName,
            };
        }
        return { authorized: true };
    }

    if (assignment.scope === "lesson") {
        if (!assignment.lessonId) {
            return { authorized: false, code: "LESSON_NOT_FOUND", message: "Lesson not found." };
        }
        const lessonTargetId = assignment.lessonId._id ? assignment.lessonId._id.toString() : assignment.lessonId.toString();
        const lessonInfo = effective.lessons[lessonTargetId];
        if (!lessonInfo) {
            return { authorized: false, code: "LESSON_NOT_FOUND", message: "Lesson not found in access roster." };
        }
        if (!lessonInfo.isModuleUnlocked) {
            return {
                authorized: false,
                code: "MODULE_LOCKED",
                message: `Module "${lessonInfo.moduleName}" is locked. Associated assignments are not accessible.`,
                moduleName: lessonInfo.moduleName,
            };
        }
        if (!lessonInfo.isLessonDirectlyUnlocked || !lessonInfo.isEffectivelyUnlocked) {
            return {
                authorized: false,
                code: "LESSON_LOCKED",
                message: `Lesson "${lessonInfo.title}" is locked. Associated assignments are not accessible.`,
                lessonTitle: lessonInfo.title,
            };
        }
        return { authorized: true };
    }

    return { authorized: true };
}
