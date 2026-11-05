import React from "react";

/**
 * LessonInfo
 * Current lesson title, chapter/module info, duration, and completion badge.
 */
export default function LessonInfo({ lesson }) {
  if (!lesson) return null;

  const isCompleted = Boolean(lesson.progress?.completed);

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
          {lesson.moduleName || "General Chapter"} • Lesson #{lesson.order}
        </span>
        <div className="flex items-center gap-2">
          {lesson.isFreePreview && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-[#CA8A04] border border-[#CA8A04]/30">
              Free Preview
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="text-emerald-600 font-extrabold">✓</span>
              Completed
            </span>
          )}
        </div>
      </div>

      <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight leading-snug">
        {lesson.title}
      </h1>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span>{lesson.durationMinutes || Math.round((lesson.durationSeconds || 0) / 60)} min duration</span>
        {lesson.progress?.watchedSeconds > 0 && !isCompleted && (
          <>
            <span>•</span>
            <span className="text-neutral-600 font-medium">
              Watched {Math.floor(lesson.progress.watchedSeconds / 60)}m
            </span>
          </>
        )}
      </div>
    </div>
  );
}

