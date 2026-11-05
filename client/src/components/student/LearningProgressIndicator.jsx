import React from "react";

/**
 * LearningProgressIndicator
 * Displays actual course learning progress percentage and lesson counters.
 * Minimal, clean design with gold accent (#CA8A04).
 */
export default function LearningProgressIndicator({ stats }) {
  const total = stats?.totalLessons || 0;
  const completed = stats?.completedLessons || 0;
  const percentage = stats?.completionPercentage ?? (total > 0 ? Math.round((completed / total) * 100) : 0);

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#CA8A04]" />
          <span>Course Progress</span>
        </span>
        <span>
          <strong className="text-neutral-900">{completed}</strong> of {total} completed ({percentage}%)
        </span>
      </div>

      <div
        className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          className="bg-[#CA8A04] h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

