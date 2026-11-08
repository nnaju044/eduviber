import React from "react";

/**
 * LessonItem
 * Individual lesson row in the curriculum list.
 */
export default function LessonItem({
  lesson,
  isActive,
  isLocked,
  onSelectLesson,
}) {
  const isCompleted = Boolean(lesson.progress?.completed);
  const effectivelyLocked = isLocked || (lesson.isUnlocked === false && !lesson.isFreePreview);

  const handleClick = (e) => {
    if (effectivelyLocked) {
      e.preventDefault();
      return;
    }
    onSelectLesson(lesson.id);
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        disabled={effectivelyLocked}
        className={`w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 transition-colors ${effectivelyLocked
            ? "bg-neutral-50/60 opacity-75 cursor-not-allowed border-l-4 border-transparent"
            : isActive
              ? "bg-amber-50/70 border-l-4 border-[#CA8A04] cursor-pointer"
              : "hover:bg-neutral-50 border-l-4 border-transparent cursor-pointer"
          }`}
        aria-current={isActive ? "true" : undefined}
        title={effectivelyLocked ? "Locked by instructor" : lesson.title}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${isCompleted
                ? "bg-emerald-600 text-white"
                : isActive
                  ? "bg-black text-[#CA8A04]"
                  : effectivelyLocked
                    ? "bg-neutral-200 text-neutral-500"
                    : "bg-neutral-100 text-neutral-600 border border-neutral-200"
              }`}
          >
            {isCompleted ? "✓" : effectivelyLocked ? "🔒" : lesson.order}
          </span>

          <div className="min-w-0">
            <p
              className={`text-xs sm:text-sm leading-snug line-clamp-2 ${isActive
                  ? "font-bold text-neutral-900"
                  : effectivelyLocked
                    ? "font-normal text-neutral-500"
                    : "font-medium text-neutral-800"
                }`}
            >
              {lesson.title}
            </p>

            <div className="flex items-center gap-2 mt-1">
              {lesson.isFreePreview && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-[#CA8A04] border border-amber-200">
                  Preview
                </span>
              )}
              {effectivelyLocked && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-neutral-200 text-neutral-600 border border-neutral-300 flex items-center gap-1">
                  <span>🔒</span> Locked
                </span>
              )}
              <span className="text-[11px] text-neutral-500">
                {lesson.durationMinutes || Math.round((lesson.durationSeconds || 0) / 60)}m
              </span>
              {lesson.progress?.watchedSeconds > 0 && !isCompleted && !effectivelyLocked && (
                <span className="text-[10px] text-neutral-400">
                  ({lesson.progress.percentage || 0}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Indicator */}
        <div className="shrink-0 text-right">
          {isActive ? (
            <span className="inline-block w-2 h-2 rounded-full bg-[#CA8A04]" />
          ) : isCompleted ? (
            <span className="text-emerald-600 text-xs font-bold">Done</span>
          ) : effectivelyLocked ? (
            <span className="text-neutral-400 text-xs">🔒</span>
          ) : (
            <span className="text-neutral-400 text-xs">›</span>
          )}
        </div>
      </button>
    </li>
  );
}

