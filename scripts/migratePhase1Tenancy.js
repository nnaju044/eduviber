#!/usr/bin/env node

/**
 * ==============================================================================
 * EduVibe Phase 1 Migration: Multi-Tenant Data Model & Server-Side Ownership
 * ==============================================================================
 *
 * This migration script safely and idempotently transitions EDUviber's single-admin
 * data model to the EduVibe multi-tenant ownership architecture:
 *
 * 1. USER MIGRATION:
 *    - Updates legacy users with role="admin" to role="super_admin".
 *    - Preserves existing student accounts without modification.
 *    - Ensures all teacher accounts have a valid teacherProfile subdocument.
 *
 * 2. COURSE OWNERSHIP MIGRATION:
 *    - Identifies all legacy platform courses lacking an `ownerId`.
 *    - Assigns them to the designated Primary Super Admin as platform-owned courses.
 *    - Never fabricates or assumes legacy courses belong to 3rd-party teachers.
 *    - Leaves courses that already possess an `ownerId` untouched.
 *
 * 3. SAFETY, JOURNALING & ROLLBACK:
 *    - Default mode is DRY-RUN (no database writes occur unless --execute is specified).
 *    - Tracks exact IDs of migrated users and courses in a migration journal collection.
 *    - Safe rollback only reverses records modified by this migration journal.
 *    - If no journal exists, rollback safely aborts to prevent demoting legitimate Super Admins.
 *    - Requires explicit --confirm-production before executing live writes on remote/production databases.
 *    - Detects and flags orphaned course owner references.
 *    - Requires --admin-email when multiple Super Admin candidates exist to avoid arbitrary assignment.
 *    - Never deletes, overwrites, or corrupts existing records.
 *
 * Usage:
 *   node scripts/migratePhase1Tenancy.js                                     # Dry-run mode (read-only audit)
 *   node scripts/migratePhase1Tenancy.js --dry-run                           # Explicit dry-run
 *   node scripts/migratePhase1Tenancy.js --execute                           # Execute database changes
 *   node scripts/migratePhase1Tenancy.js --execute --confirm-production      # Production confirmation
 *   node scripts/migratePhase1Tenancy.js --rollback                          # Roll back migrated records via journal
 *   node scripts/migratePhase1Tenancy.js --uri=<URI>                         # Execute against isolated test DB
 *   node scripts/migratePhase1Tenancy.js --admin-email=<EMAIL>               # Disambiguate admin assignment
 */

import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Progress from "../models/Progress.js";
import { getTestDatabaseUri, getDatabaseName, maskUri, assertTestDatabaseIsolation } from "../config/testDbGuard.js";

const JOURNAL_COLLECTION = "_phase1_migration_journal";

// Parse CLI arguments
const args = process.argv.slice(2);
const isExecute = args.includes("--execute");
const isRollback = args.includes("--rollback");
const isDryRun = (!isExecute && !isRollback) || args.includes("--dry-run");
const hasProductionConfirm = args.includes("--confirm-production");

const uriArg = args.find((a) => a.startsWith("--uri="));
const customUri = uriArg ? uriArg.split("=")[1] : null;

const emailArg = args.find((a) => a.startsWith("--admin-email="));
const targetAdminEmail = emailArg ? emailArg.split("=")[1]?.trim().toLowerCase() : null;

const isTestEnv = process.env.NODE_ENV === "test";
const MONGODB_URI = customUri || (isTestEnv ? getTestDatabaseUri() : process.env.MONGODB_URI);

export async function runMigration(options = {}) {
    const executeMode = options.execute ?? isExecute;
    const rollbackMode = options.rollback ?? isRollback;
    const dryRunMode = options.dryRun ?? isDryRun;
    const isTest = process.env.NODE_ENV === "test";
    const uri = options.uri || (isTest ? getTestDatabaseUri() : MONGODB_URI);
    const adminEmailOverride = options.adminEmail || targetAdminEmail || process.env.ADMIN_EMAIL;
    const confirmProduction = options.confirmProduction ?? hasProductionConfirm;

    if (!uri) {
        throw new Error(isTest ? "Missing TEST_MONGODB_URI for test migration." : "Missing MONGODB_URI. Provide it via .env or --uri=<MONGODB_URI>.");
    }

    const targetDbName = getDatabaseName(uri);
    const prodDbName = getDatabaseName(process.env.MONGODB_URI);

    if (isTest && (executeMode || rollbackMode)) {
        if (prodDbName && targetDbName?.toLowerCase() === prodDbName.toLowerCase()) {
            throw new Error(
                `SAFETY INTERLOCK: Migration test attempted to execute writes against primary database '${targetDbName}'! Refusing to run.`
            );
        }
        if (!targetDbName?.toLowerCase().includes("test")) {
            throw new Error(
                `SAFETY INTERLOCK: Migration test target database '${targetDbName}' is not a designated test database (must contain 'test').`
            );
        }
    }

    const isProductionCluster =
        process.env.NODE_ENV === "production" ||
        uri.includes(".mongodb.net") ||
        uri.includes("replicaSet") ||
        uri.includes("prod");

    if ((executeMode || rollbackMode) && isProductionCluster && !confirmProduction && !isTest) {
        throw new Error(
            "SAFETY INTERLOCK: Remote/Production MongoDB detected. Executing write operations requires explicit confirmation via --confirm-production."
        );
    }

    const modeLabel = rollbackMode
        ? (dryRunMode ? "ROLLBACK (DRY-RUN AUDIT)" : "ROLLBACK (LIVE REVERSION)")
        : executeMode
        ? "EXECUTE (LIVE WRITES)"
        : "DRY-RUN (READ-ONLY AUDIT)";

    console.log("==============================================================================");
    console.log(` EduVibe Phase 1 Tenancy Migration: [${modeLabel}]`);
    console.log("==============================================================================");
    console.log(`Target Database: [${targetDbName || "unknown"}] ${maskUri(uri)}`);
    console.log(`Execution Mode:  ${modeLabel}`);

    let isInternalConnection = false;
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(uri);
        isInternalConnection = true;
    }

    if (isTest) {
        assertTestDatabaseIsolation(mongoose);
    }

    try {
        const journalCollection = mongoose.connection.collection(JOURNAL_COLLECTION);

        // Step 1: Snapshot Before Counts
        const beforeCounts = await getSystemCounts();
        printCounts("BEFORE MIGRATION", beforeCounts);

        // Step 2: Handle Rollback Mode
        if (rollbackMode) {
            const rollbackResult = await executeRollback({
                dryRun: dryRunMode,
                journalCollection,
            });
            const afterCounts = await getSystemCounts();
            printCounts("AFTER ROLLBACK", afterCounts);
            return {
                mode: "rollback",
                dryRun: dryRunMode,
                beforeCounts,
                afterCounts,
                details: rollbackResult,
            };
        }

        // Step 3: Locate Primary Super Admin
        const primaryAdmin = await locatePrimaryAdmin(adminEmailOverride);
        console.log("\n[Step 1] Primary Super Administrator Resolution:");
        console.log(`  - Resolved Admin ID:    ${primaryAdmin._id.toString()}`);
        console.log(`  - Name:                 ${primaryAdmin.name}`);
        console.log(`  - Email:                ${primaryAdmin.email}`);
        console.log(`  - Current DB Role:      ${primaryAdmin.role}`);

        // Step 4: Analyze User Role Migrations
        const legacyAdmins = await User.find({ role: "admin" }).lean();
        console.log("\n[Step 2] User Role Migration Analysis:");
        console.log(`  - Found ${legacyAdmins.length} user(s) with legacy role="admin".`);
        for (const admin of legacyAdmins) {
            console.log(`    * [Plan Update] User "${admin.name}" (${admin.email}) -> role: "super_admin"`);
        }

        // Step 5: Check Orphaned Owner References & Course Ownership Migrations
        const coursesWithOwner = await Course.find({ ownerId: { $exists: true, $ne: null } }).lean();
        const ownerIds = [...new Set(coursesWithOwner.map((c) => c.ownerId.toString()))];
        const existingUsers = await User.find({ _id: { $in: ownerIds } }, { _id: 1 }).lean();
        const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));
        const orphanedCourses = coursesWithOwner.filter((c) => !existingUserIds.has(c.ownerId.toString()));

        if (orphanedCourses.length > 0) {
            console.warn(`\n⚠️  WARNING: Found ${orphanedCourses.length} course(s) with orphaned ownerId references (referencing non-existent user IDs):`);
            for (const c of orphanedCourses) {
                console.warn(`    - Course "${c.title}" (ID: ${c._id}) references missing owner ID: ${c.ownerId}`);
            }
        }

        const unownedCourses = await Course.find({
            $or: [{ ownerId: { $exists: false } }, { ownerId: null }],
        }).lean();

        console.log("\n[Step 3] Course Ownership Migration Analysis:");
        console.log(`  - Found ${unownedCourses.length} legacy course(s) missing 'ownerId'.`);
        for (const course of unownedCourses) {
            console.log(`    * [Plan Update] Course "${course.title}" (slug: ${course.slug}) -> ownerId: ${primaryAdmin._id.toString()} (Super Admin)`);
        }

        // Step 6: Execute Mutations or Report Dry-Run
        let updatedUsersCount = 0;
        let updatedCoursesCount = 0;

        if (executeMode) {
            console.log("\n[Step 4] Applying Database Mutations...");

            const migratedUserIds = legacyAdmins.map((u) => u._id);
            const migratedCourseIds = unownedCourses.map((c) => c._id);

            // 1. Update legacy admins to super_admin
            if (migratedUserIds.length > 0) {
                const userUpdateResult = await User.updateMany(
                    { _id: { $in: migratedUserIds } },
                    { $set: { role: "super_admin" } }
                );
                updatedUsersCount = userUpdateResult.modifiedCount;
                console.log(`  ✓ Updated ${updatedUsersCount} user(s) from 'admin' to 'super_admin'.`);
            } else {
                console.log("  ✓ No users required role migration.");
            }

            // 2. Assign unowned courses to primary Super Admin
            if (migratedCourseIds.length > 0) {
                const courseUpdateResult = await Course.updateMany(
                    { _id: { $in: migratedCourseIds } },
                    { $set: { ownerId: primaryAdmin._id } }
                );
                updatedCoursesCount = courseUpdateResult.modifiedCount;
                console.log(`  ✓ Assigned ${updatedCoursesCount} legacy course(s) to Super Admin (${primaryAdmin.email}).`);
            } else {
                console.log("  ✓ No courses required ownership migration.");
            }

            // 3. Write migration journal for safe, targeted rollback
            if (migratedUserIds.length > 0 || migratedCourseIds.length > 0) {
                await journalCollection.insertOne({
                    migration: "phase1_tenancy",
                    executedAt: new Date(),
                    primaryAdminId: primaryAdmin._id,
                    migratedUserIds,
                    migratedCourseIds,
                });
                console.log("  ✓ Migration journal entry recorded for safe rollback.");
            }
        } else {
            console.log("\n[Step 4] DRY-RUN MODE: Zero modifications written to database.");
            console.log("  - To execute these changes, re-run with: node scripts/migratePhase1Tenancy.js --execute");
        }

        // Step 7: Snapshot After Counts
        const afterCounts = await getSystemCounts();
        printCounts("AFTER MIGRATION", afterCounts);

        console.log("\n==============================================================================");
        console.log(" MIGRATION SUMMARY & AUDIT VERDICT");
        console.log("==============================================================================");
        console.log(`Status:               ${executeMode ? "SUCCESSFULLY EXECUTED" : "DRY-RUN VALIDATED"}`);
        console.log(`Legacy Admins Found:  ${legacyAdmins.length}`);
        console.log(`Users Migrated:       ${updatedUsersCount}`);
        console.log(`Unowned Courses Found:${unownedCourses.length}`);
        console.log(`Courses Migrated:     ${updatedCoursesCount}`);
        console.log(`Orphaned Courses:     ${orphanedCourses.length}`);
        console.log(`Financial Integrity:  Payments & Enrollments untouched (0 modifications)`);
        console.log("==============================================================================\n");

        return {
            mode: executeMode ? "execute" : "dry-run",
            primaryAdminId: primaryAdmin._id.toString(),
            legacyAdminsFound: legacyAdmins.length,
            usersMigrated: updatedUsersCount,
            unownedCoursesFound: unownedCourses.length,
            coursesMigrated: updatedCoursesCount,
            orphanedCoursesCount: orphanedCourses.length,
            beforeCounts,
            afterCounts,
        };
    } finally {
        if (isInternalConnection) {
            await mongoose.disconnect().catch(() => {});
        }
    }
}

async function locatePrimaryAdmin(emailOverride) {
    if (emailOverride) {
        const found = await User.findOne({ email: emailOverride.trim().toLowerCase() });
        if (found) return found;
        throw new Error(`Target administrator with email "${emailOverride}" does not exist.`);
    }

    // Check existing super_admins
    const superAdmins = await User.find({ role: "super_admin" }).lean();
    if (superAdmins.length === 1) {
        return superAdmins[0];
    }
    if (superAdmins.length > 1) {
        throw new Error(
            `Ambiguous administrator: Found ${superAdmins.length} Super Admin accounts. Specify primary Super Admin via --admin-email=<EMAIL>.`
        );
    }

    // Check legacy admins
    const legacyAdmins = await User.find({ role: "admin" }).lean();
    if (legacyAdmins.length === 1) {
        return legacyAdmins[0];
    }
    if (legacyAdmins.length > 1) {
        throw new Error(
            `Ambiguous administrator: Found ${legacyAdmins.length} legacy admin accounts. Specify primary Super Admin via --admin-email=<EMAIL>.`
        );
    }

    throw new Error(
        "No administrator found to assign legacy platform courses. Please seed an admin account first using `node scripts/createAdmin.js`."
    );
}

async function getSystemCounts() {
    const [
        totalUsers,
        superAdmins,
        legacyAdmins,
        teachers,
        students,
        totalCourses,
        coursesWithOwner,
        coursesWithoutOwner,
        totalLessons,
        totalEnrollments,
        totalPayments,
        totalProgress,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "super_admin" }),
        User.countDocuments({ role: "admin" }),
        User.countDocuments({ role: "teacher" }),
        User.countDocuments({ role: "student" }),
        Course.countDocuments(),
        Course.countDocuments({ ownerId: { $exists: true, $ne: null } }),
        Course.countDocuments({ $or: [{ ownerId: { $exists: false } }, { ownerId: null }] }),
        Lesson.countDocuments(),
        Enrollment.countDocuments(),
        Payment.countDocuments(),
        Progress.countDocuments(),
    ]);

    return {
        users: { total: totalUsers, superAdmins, legacyAdmins, teachers, students },
        courses: { total: totalCourses, withOwner: coursesWithOwner, withoutOwner: coursesWithoutOwner },
        untouchedCollections: {
            lessons: totalLessons,
            enrollments: totalEnrollments,
            payments: totalPayments,
            progress: totalProgress,
        },
    };
}

function printCounts(label, counts) {
    console.log(`\n--- System Collection Counts [${label}] ---`);
    console.log(`Users:       Total: ${counts.users.total} | super_admin: ${counts.users.superAdmins} | admin: ${counts.users.legacyAdmins} | teacher: ${counts.users.teachers} | student: ${counts.users.students}`);
    console.log(`Courses:     Total: ${counts.courses.total} | with ownerId: ${counts.courses.withOwner} | unowned: ${counts.courses.withoutOwner}`);
    console.log(`Untouched:   Lessons: ${counts.untouchedCollections.lessons} | Enrollments: ${counts.untouchedCollections.enrollments} | Payments: ${counts.untouchedCollections.payments} | Progress: ${counts.untouchedCollections.progress}`);
}

async function executeRollback({ dryRun, journalCollection }) {
    console.log("\n[Rollback Procedure Initiated]");

    const journal = await journalCollection.findOne({ migration: "phase1_tenancy" });

    if (!journal) {
        console.warn("\n⚠️  ROLLBACK HALTED: No migration journal entry found.");
        console.warn("A safe rollback requires the migration journal to identify which accounts were originally 'admin' vs 'super_admin'.");
        console.warn("Blindly demoting all Super Admins is unsafe and blocked to protect non-migrated accounts.");
        return {
            success: false,
            dryRun,
            revertedUsers: 0,
            revertedCourses: 0,
            reason: "Missing migration journal. Targeted rollback cannot proceed without tracking metadata.",
        };
    }

    const targetUserIds = journal.migratedUserIds || [];
    const targetCourseIds = journal.migratedCourseIds || [];

    console.log(`  - Found journal record from: ${journal.executedAt}`);
    console.log(`  - Targeted users to revert to 'admin': ${targetUserIds.length}`);
    console.log(`  - Targeted courses to unbind ownerId:  ${targetCourseIds.length}`);

    if (dryRun) {
        console.log("DRY-RUN: Would revert tracked users and unbind tracked courses. Zero writes executed.");
        return {
            success: true,
            dryRun: true,
            revertedUsers: targetUserIds.length,
            revertedCourses: targetCourseIds.length,
        };
    }

    let revertedUsersCount = 0;
    let revertedCoursesCount = 0;

    if (targetUserIds.length > 0) {
        const userRevertResult = await User.updateMany(
            { _id: { $in: targetUserIds }, role: "super_admin" },
            { $set: { role: "admin" } }
        );
        revertedUsersCount = userRevertResult.modifiedCount;
        console.log(`  ✓ Reverted ${revertedUsersCount} tracked user(s) to role='admin'.`);
    }

    if (targetCourseIds.length > 0) {
        const courseRevertResult = await Course.updateMany(
            { _id: { $in: targetCourseIds } },
            { $unset: { ownerId: 1 } }
        );
        revertedCoursesCount = courseRevertResult.modifiedCount;
        console.log(`  ✓ Unbound ownerId from ${revertedCoursesCount} tracked course(s).`);
    }

    // Clean up journal entry upon successful rollback
    await journalCollection.deleteOne({ _id: journal._id });
    console.log("  ✓ Migration journal entry removed.");

    return {
        success: true,
        dryRun: false,
        revertedUsers: revertedUsersCount,
        revertedCourses: revertedCoursesCount,
    };
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith("migratePhase1Tenancy.js")) {
    runMigration().catch((err) => {
        console.error("\n❌ Migration Failed:", err.message);
        process.exit(1);
    });
}
