import React from "react";
import LessonItem from "./LessonItem.jsx";

/**
 * ChapterSection
 * Expandable/collapsible chapter section within the course curriculum.
 * Displays chapter name, completion count/percentage, and accordion toggle.
 */
export default function ChapterSection({
  module,
  isExpanded,
  onToggle,
  activeLessonId,
  onSelectLesson,
  isEnrolled,
}) {
  const total = module.lessons.length;
  const completed = module.lessons.filter((l) => l.progress?.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasActiveLesson = module.lessons.some((l) => l.id === activeLessonId);
  const isModuleLocked = module.lessons.length > 0 && module.lessons.every((l) => l.isModuleUnlocked === false);

  return (
    <div className="bg-white border-b border-neutral-200 last:border-b-0">
      {/* Chapter Accordion Header */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
          hasActiveLesson
            ? "bg-neutral-100/90 font-bold"
            : "bg-neutral-50 hover:bg-neutral-100/70"
        }`}
        aria-expanded={isExpanded}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Chapter
            </span>
            {isModuleLocked && (
              <span className="text-neutral-500 text-[10px] font-medium px-1.5 py-0.2 bg-neutral-200 rounded border border-neutral-300">
                🔒 Module Locked
              </span>
            )}
            {completed === total && total > 0 && (
              <span className="text-emerald-600 text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 rounded border border-emerald-200">
                Completed
              </span>
            )}
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-neutral-800 truncate">
            {module.title}
          </h3>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-neutral-500 font-medium">
            {completed}/{total} ({percent}%)
          </span>
          <span
            className={`w-5 h-5 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-xs text-neutral-600 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
      </button>

      {/* Chapter Lessons List */}
      {isExpanded && (
        <ul className="divide-y divide-neutral-100 bg-white">
          {module.lessons.map((lesson) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              isActive={lesson.id === activeLessonId}
              isLocked={!isEnrolled && !lesson.isFreePreview}
              onSelectLesson={onSelectLesson}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

