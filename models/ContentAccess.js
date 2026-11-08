import mongoose from "mongoose";

/**
 * ContentAccess
 * Dedicated access control model for teacher-controlled module and lesson unlocking.
 *
 * Supported scopes:
 * - course: Course-wide baseline permissions set by the teacher (applies to all enrolled students unless overridden).
 * - student: Individual student permission overrides set by the teacher.
 *
 * Precedence / Hierarchy:
 * 1. An individual student record (scope: "student", userId: <studentId>) overrides the course baseline.
 * 2. If no student override exists, the course baseline (scope: "course", userId: null) is used.
 * 3. If neither exists (e.g. legacy courses or brand new enrollments without overrides), safe defaults apply:
 *    - For student: first module and its lessons are unlocked; remaining modules/lessons locked.
 *    - For course baseline: first module and its lessons are unlocked; remaining modules/lessons locked.
 * 4. Combined Access Rule: A lesson is accessible if and only if:
 *    - Student has active enrollment
 *    - Parent module is unlocked
 *    - Individual lesson is unlocked
 *    (Parent module lock strictly blocks all child lessons, regardless of lesson-level unlock).
 */
const contentAccessSchema = new mongoose.Schema(
    {
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },
        scope: {
            type: String,
            enum: ["course", "student"],
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        // Unlocked module names (e.g. ["Module 1", "Introduction"])
        unlockedModules: {
            type: [String],
            default: [],
        },
        // Unlocked lesson ObjectIds
        unlockedLessons: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Lesson",
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Unique compound index: only 1 course-level document per course, and 1 student-level document per (course, student)
contentAccessSchema.index(
    { courseId: 1, scope: 1, userId: 1 },
    { unique: true }
);

export default mongoose.model("ContentAccess", contentAccessSchema);
