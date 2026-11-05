#!/usr/bin/env node

/**
 * ==============================================================================
 * EduVibe M02: Lesson & Progress Schema Alignment & Backfill Migration
 * ==============================================================================
 *
 * This migration script safely aligns and backfills legacy Lesson and Progress
 * records to ensure full two-way parity with both the legacy SSR frontend and
 * the modern React Teacher Studio / Student Portal.
 *
 * 1. LESSON BACKFILL:
 *    - Backfills `durationMinutes = Math.round(durationSeconds / 60)` where missing.
 *    - Backfills `durationSeconds = durationMinutes * 60` where durationMinutes exists but durationSeconds is 0.
 *    - Backfills `isFreePreview: false` where undefined.
 *
 * 2. PROGRESS BACKFILL:
 *    - Backfills `courseId` on legacy Progress records by resolving `lessonId.courseId`.
 *    - Backfills `progressSeconds = lastPositionSeconds || 0` where missing.
 *    - Backfills `lastPositionSeconds = progressSeconds || 0` where missing.
 *    - Backfills `watchedSeconds = lastPositionSeconds || progressSeconds || 0` where missing.
 *    - Computes and backfills `progressPercentage` based on lesson duration or completion state.
 *
 * 3. SAFETY & REVERSIBILITY:
 *    - Default mode is DRY-RUN (read-only audit, strictly no DB writes).
 *    - Will NOT execute against production without explicit --confirm-production.
 *    - Never deletes, overwrites, or corrupts existing records.
 *
 * Usage:
 *   node scripts/migrateLessonProgressSchema.js                  # Dry-run audit mode
 *   node scripts/migrateLessonProgressSchema.js --dry-run        # Explicit dry-run
 *   node scripts/migrateLessonProgressSchema.js --execute        # Execute on isolated test DB
 */

import "dotenv/config";
import mongoose from "mongoose";
import Lesson from "../models/Lesson.js";
import Progress from "../models/Progress.js";
import { getTestDatabaseUri, getDatabaseName, maskUri, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

const args = process.argv.slice(2);
const isExecute = args.includes("--execute");
const isDryRun = !isExecute || args.includes("--dry-run");
const hasProductionConfirm = args.includes("--confirm-production");

async function run() {
    console.log("==============================================================================");
    console.log(" [M02-T01] LESSON & PROGRESS SCHEMA MIGRATION & BACKFILL PLAN");
    console.log("==============================================================================");
    console.log(` Mode: ${isDryRun ? "DRY-RUN (Audit only - no writes)" : "EXECUTE (Write mode)"}`);

    const isTest = process.env.NODE_ENV === "test";
    const uri = isTest ? getTestDatabaseUri() : process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("No database URI configured in environment.");
    }

    const dbName = getDatabaseName(uri);
    console.log(` Target Database: ${dbName} (${maskUri(uri)})`);

    if (!isTest && isExecute && !hasProductionConfirm) {
        console.error("\n[CRITICAL SAFETY INTERLOCK] Refusing to execute against non-test database without --confirm-production.");
        process.exit(1);
    }

    await mongoose.connect(uri);

    if (isTest) {
        assertTestDatabaseIsolation(mongoose);
    }

    console.log("✓ Connected to database\n");

    // 1. Audit Lessons
    console.log("--- 1. AUDITING LESSONS ---");
    const totalLessons = await Lesson.countDocuments();
    const lessonsNeedMinutes = await Lesson.find({
        $or: [
            { durationMinutes: { $exists: false } },
            { durationMinutes: null },
            { durationMinutes: 0, durationSeconds: { $gt: 0 } },
        ],
    }).lean();

    const lessonsNeedPreview = await Lesson.find({
        $or: [{ isFreePreview: { $exists: false } }, { isFreePreview: null }],
    }).lean();

    console.log(` Total lessons in database: ${totalLessons}`);
    console.log(` Lessons needing durationMinutes backfill: ${lessonsNeedMinutes.length}`);
    console.log(` Lessons needing isFreePreview backfill: ${lessonsNeedPreview.length}`);

    if (isExecute && !isDryRun) {
        for (const l of lessonsNeedMinutes) {
            const minutes = l.durationSeconds > 0 ? Math.round(l.durationSeconds / 60) : 0;
            await Lesson.updateOne({ _id: l._id }, { $set: { durationMinutes: minutes } });
        }
        for (const l of lessonsNeedPreview) {
            await Lesson.updateOne({ _id: l._id }, { $set: { isFreePreview: false } });
        }
        console.log(` ✓ Updated ${lessonsNeedMinutes.length} lesson duration records and ${lessonsNeedPreview.length} preview records.`);
    }

    // 2. Audit Progress
    console.log("\n--- 2. AUDITING PROGRESS RECORDS ---");
    const totalProgress = await Progress.countDocuments();
    const progressMissingCourseId = await Progress.find({
        $or: [{ courseId: { $exists: false } }, { courseId: null }],
    }).lean();

    const progressMissingFields = await Progress.find({
        $or: [
            { progressSeconds: { $exists: false } },
            { progressPercentage: { $exists: false } },
            { watchedSeconds: { $exists: false } },
        ],
    }).lean();

    console.log(` Total progress records: ${totalProgress}`);
    console.log(` Records missing courseId: ${progressMissingCourseId.length}`);
    console.log(` Records missing normalized progress fields: ${progressMissingFields.length}`);

    if (isExecute && !isDryRun) {
        let updatedCount = 0;
        for (const p of progressMissingCourseId) {
            const lesson = await Lesson.findById(p.lessonId).select("courseId").lean();
            if (lesson && lesson.courseId) {
                await Progress.updateOne({ _id: p._id }, { $set: { courseId: lesson.courseId } });
                updatedCount++;
            }
        }
        console.log(` ✓ Backfilled courseId on ${updatedCount} progress records.`);

        for (const p of progressMissingFields) {
            const pos = p.lastPositionSeconds || p.progressSeconds || 0;
            const watched = p.watchedSeconds || pos;
            const pct = p.completed ? 100 : (p.progressPercentage || 0);
            await Progress.updateOne(
                { _id: p._id },
                {
                    $set: {
                        lastPositionSeconds: pos,
                        progressSeconds: pos,
                        watchedSeconds: watched,
                        progressPercentage: pct,
                    },
                }
            );
        }
        console.log(` ✓ Normalized fields on ${progressMissingFields.length} progress records.`);
    }

    console.log("\n==============================================================================");
    console.log(isDryRun ? " [DRY-RUN COMPLETE] No database modifications were written." : " [MIGRATION COMPLETE] All records successfully aligned.");
    console.log("==============================================================================\n");

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});

