import React, { useMemo, useState, useEffect } from "react";
import ChapterSection from "./ChapterSection.jsx";

/**
 * CourseCurriculum
 * Groups syllabus lessons by chapter / moduleName with expandable/collapsible accordions.
 * - Current chapter containing activeLessonId is expanded by default.
 * - Supports collapsing and expanding chapters.
 * - Displays chapter-level completion progress.
 */
export default function CourseCurriculum({
  syllabus = [],
  activeLessonId,
  onSelectLesson,
  isEnrolled = true,
}) {
  // Group lessons by moduleName preserving order
  const groupedModules = useMemo(() => {
    const modules = [];
    const moduleMap = new Map();

    for (const item of syllabus) {
      const moduleName = item.moduleName || "Course Content";
      if (!moduleMap.has(moduleName)) {
        const newModule = { title: moduleName, lessons: [] };
        moduleMap.set(moduleName, newModule);
        modules.push(newModule);
      }
      moduleMap.get(moduleName).lessons.push(item);
    }
    return modules;
  }, [syllabus]);

  // Keep track of which chapter accordions are expanded (default: current active chapter open)
  const [expandedMap, setExpandedMap] = useState({});

  useEffect(() => {
    if (!activeLessonId || groupedModules.length === 0) return;

    // Find module containing the active lesson
    const targetModule = groupedModules.find((m) =>
      m.lessons.some((l) => l.id === activeLessonId)
    );

    if (targetModule) {
      setExpandedMap((prev) => ({
        ...prev,
        [targetModule.title]: true,
      }));
    } else {
      // Default open first module
      setExpandedMap((prev) => ({
        ...prev,
        [groupedModules[0].title]: true,
      }));
    }
  }, [activeLessonId, groupedModules]);

  const toggleModule = (moduleTitle) => {
    setExpandedMap((prev) => ({
      ...prev,
      [moduleTitle]: !prev[moduleTitle],
    }));
  };

  return (
    <aside
      aria-label="Course Curriculum"
      className="bg-white border border-neutral-200 rounded-xl sm:rounded-2xl overflow-hidden shadow-xs"
    >
      <div className="p-4 sm:p-4.5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-800">
            Course Curriculum
          </h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {groupedModules.length} {groupedModules.length === 1 ? "chapter" : "chapters"} • {syllabus.length}{" "}
            {syllabus.length === 1 ? "lesson" : "lessons"}
          </p>
        </div>
      </div>

      <div className="divide-y divide-neutral-200 max-h-[70vh] lg:max-h-[calc(100vh-14rem)] overflow-y-auto">
        {groupedModules.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400 italic">
            No published lessons in this course yet.
          </div>
        ) : (
          groupedModules.map((module) => (
            <ChapterSection
              key={module.title}
              module={module}
              isExpanded={Boolean(expandedMap[module.title])}
              onToggle={() => toggleModule(module.title)}
              activeLessonId={activeLessonId}
              onSelectLesson={onSelectLesson}
              isEnrolled={isEnrolled}
            />
          ))
        )}
      </div>
    </aside>
  );
}
