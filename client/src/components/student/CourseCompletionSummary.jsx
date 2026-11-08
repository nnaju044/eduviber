import React from "react";
import { Link } from "react-router-dom";

/**
 * CourseCompletionSummary
 * Appears when course progress reaches 100% or all lessons are completed.
 * Features celebration summary, stats breakdown, and dashboard review CTA.
 */
export default function CourseCompletionSummary({ stats, courseTitle, onRevisitFirstLesson }) {
  const total = stats?.totalLessons || 0;

  return (
    <div
      role="region"
      aria-label="Course Completion Celebration"
      className="bg-neutral-50 border-2 border-[#CA8A04]/40 rounded-2xl p-5 sm:p-7 text-center space-y-4 shadow-sm"
    >
      <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-300 text-[#CA8A04] flex items-center justify-center font-black text-2xl mx-auto shadow-xs">
        🏆
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#CA8A04]">
          Congratulations!
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
          Course Completed
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
          You have successfully finished all <strong className="text-neutral-900">{total} lessons</strong> of{" "}
          <strong className="text-neutral-900">{courseTitle}</strong>.
        </p>
      </div>

      {/* Progress Metric Badge */}
      <div className="inline-flex items-center gap-3 bg-white border border-neutral-200 px-4 py-2 rounded-xl text-xs font-semibold text-neutral-800">
        <span className="text-emerald-600 font-bold">✓ 100% Curriculum Completed</span>
        <span className="text-neutral-300">•</span>
        <span>{total} of {total} Lessons Finished</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          to="/app/student"
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs"
        >
          Return to Student Dashboard
        </Link>
        {onRevisitFirstLesson && (
          <button
            type="button"
            onClick={onRevisitFirstLesson}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all cursor-pointer"
          >
            Review Course From Beginning
          </button>
        )}
      </div>
    </div>
  );
}

