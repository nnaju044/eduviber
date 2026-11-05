import React from "react";

/**
 * LessonControls
 * Previous and Next lesson controls with course finish state.
 * Fully accessible and responsive.
 */
export default function LessonControls({
  prevLesson,
  nextLesson,
  onSelectLesson,
  onFinishCourse,
  currentIndex,
  totalLessons,
}) {
  return (
    <nav
      aria-label="Lesson Navigation Controls"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs"
    >
      {/* Previous Lesson Button */}
      <div className="w-full sm:w-auto">
        {prevLesson ? (
          <button
            type="button"
            onClick={() => onSelectLesson(prevLesson.id)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-800 text-xs sm:text-sm font-semibold transition-colors shadow-2xs group cursor-pointer"
            title={`Previous: ${prevLesson.title}`}
          >
            <span aria-hidden="true" className="group-hover:-translate-x-0.5 transition-transform">
              ←
            </span>
            <span>Previous Lesson</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-400 text-xs sm:text-sm font-medium cursor-not-allowed"
          >
            <span aria-hidden="true">←</span>
            <span>Previous Lesson</span>
          </button>
        )}
      </div>

      {/* Index indicator */}
      {currentIndex && totalLessons ? (
        <div className="text-xs text-neutral-500 font-medium order-first sm:order-none">
          Lesson <span className="font-bold text-neutral-900">{currentIndex}</span> of{" "}
          <span className="font-bold text-neutral-900">{totalLessons}</span>
        </div>
      ) : null}

      {/* Next Lesson or Finish Button */}
      <div className="w-full sm:w-auto flex justify-end">
        {nextLesson ? (
          <button
            type="button"
            onClick={() => onSelectLesson(nextLesson.id)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-black active:bg-neutral-950 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs group cursor-pointer"
            title={`Next: ${nextLesson.title}`}
          >
            <span>Next Lesson</span>
            <span aria-hidden="true" className="group-hover:translate-x-0.5 transition-transform text-[#CA8A04]">
              →
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onFinishCourse}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-black text-[#CA8A04] border border-[#CA8A04]/40 text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer"
          >
            <span>Finish Course</span>
            <span aria-hidden="true">✓</span>
          </button>
        )}
      </div>
    </nav>
  );
}

