import React from "react";
import { Link } from "react-router-dom";

/**
 * CourseHeader
 * Mobile-first header with back navigation and course branding.
 * Approved colors: White (#FFFFFF), Black (#000000), Gold (#CA8A04)
 */
export default function CourseHeader({ courseTitle }) {
  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <Link
          to="/app/student"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-black transition-colors group"
          aria-label="Back to Student Dashboard"
        >
          <span className="w-6 h-6 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-600 group-hover:border-neutral-400 group-hover:text-black transition-colors" aria-hidden="true">
            ←
          </span>
          <span className="font-medium">Dashboard</span>
        </Link>

        <div className="flex items-center gap-2 min-w-0 text-right">
          {courseTitle && (
            <span className="text-xs font-semibold text-neutral-900 truncate max-w-[180px] sm:max-w-xs md:max-w-md hidden xs:inline-block">
              {courseTitle}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#CA8A04]/30 bg-amber-50 text-[10px] font-bold tracking-wider text-[#CA8A04] uppercase shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#CA8A04]" />
            Learning
          </span>
        </div>
      </div>
    </header>
  );
}

