import React from "react";

/**
 * LessonDescription
 * Displays the current lesson description cleanly formatted.
 */
export default function LessonDescription({ description }) {
  if (!description || !description.trim()) {
    return (
      <div className="bg-neutral-50/60 border border-neutral-200/80 rounded-xl p-4 text-xs text-neutral-500 italic">
        No written description provided for this lesson.
      </div>
    );
  }

  return (
    <section aria-label="Lesson Description" className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
        About this lesson
      </h2>
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 sm:p-5 text-xs sm:text-sm text-neutral-800 leading-relaxed whitespace-pre-line">
        {description}
      </div>
    </section>
  );
}

