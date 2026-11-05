import React from "react";

/**
 * LessonResources
 * Displays available lesson resources or minimal empty state.
 */
export default function LessonResources({ resources = [] }) {
  if (!resources || resources.length === 0) {
    return (
      <section aria-label="Lesson Resources" className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
          Lesson Resources
        </h2>
        <div className="bg-neutral-50/60 border border-neutral-200/80 rounded-xl p-4 text-xs text-neutral-500 italic">
          No external attachments or resources attached to this lesson.
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Lesson Resources" className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
        Lesson Resources ({resources.length})
      </h2>
      <div className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
        {resources.map((res, index) => (
          <a
            key={res.id || index}
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50 transition-colors text-xs text-neutral-800 font-medium group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-6 h-6 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-500 group-hover:text-black shrink-0">
                📄
              </span>
              <span className="truncate">{res.title || res.name || "Resource Attachment"}</span>
            </div>
            <span className="text-[#CA8A04] text-[11px] font-semibold shrink-0 group-hover:underline">
              Download ↗
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

