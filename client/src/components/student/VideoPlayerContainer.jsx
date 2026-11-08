import React from "react";
import EduVibeVideoPlayer from "./EduVibeVideoPlayer.jsx";

/**
 * VideoPlayerContainer
 * High-level player wrapper integrating EduVibeVideoPlayer.
 * Handles loading, device-limit errors, unauthorized playback, and player states.
 */
export default function VideoPlayerContainer({
  lesson,
  playbackData,
  courseId,
  playbackLoading = false,
  error = null,
  onProgressSaved,
  onLessonCompleted,
  onRetryPlayback,
}) {
  return (
    <section
      aria-label="Video Player Area"
      className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-md flex items-center justify-center select-none"
    >
      {/* Loading state while switching lessons or loading playback tokens */}
      {playbackLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 text-white p-4 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#CA8A04] animate-spin" />
          <p className="text-xs font-medium text-neutral-300">
            Authorizing video playback...
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2.5 text-white p-6 text-center max-w-md">
          <span className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-700 text-[#CA8A04] font-bold text-lg flex items-center justify-center">
            {error.code === "DEVICE_LIMIT_EXCEEDED" ? "📱" : (error.code === "MODULE_LOCKED" || error.code === "LESSON_LOCKED") ? "🔒" : "!"}
          </span>
          <p className="text-sm font-semibold text-white">
            {error.code === "DEVICE_LIMIT_EXCEEDED"
              ? "Device Limit Reached"
              : error.code === "MODULE_LOCKED"
              ? "Module Locked by Instructor"
              : error.code === "LESSON_LOCKED"
              ? "Lesson Locked by Instructor"
              : "Playback Unavailable"}
          </p>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {error.message || "Unable to authorize video playback for this lesson."}
          </p>
          {error.code === "DEVICE_LIMIT_EXCEEDED" ? (
            <a
              href="/app/student/settings"
              className="mt-2 px-4 py-1.5 rounded-lg bg-[#CA8A04] hover:bg-[#b07803] text-black font-bold text-xs transition-colors shadow-xs"
            >
              Manage Registered Devices
            </a>
          ) : (error.code === "MODULE_LOCKED" || error.code === "LESSON_LOCKED") ? (
            <p className="mt-2 text-[11px] text-[#CA8A04] font-medium">
              Please contact your course instructor or wait for them to unlock this content.
            </p>
          ) : (
            onRetryPlayback && (
              <button
                type="button"
                onClick={onRetryPlayback}
                className="mt-2 px-4 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Retry Playback
              </button>
            )
          )}
        </div>
      ) : playbackData?.playback?.embedUrl ? (
        <EduVibeVideoPlayer
          lesson={lesson}
          playbackData={playbackData}
          courseId={courseId}
          onProgressSaved={onProgressSaved}
          onLessonCompleted={onLessonCompleted}
        />
      ) : (
        /* Empty / No Video State */
        <div className="relative w-full h-full flex flex-col items-center justify-center text-white p-4">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-white">
              <span className="text-xl">📹</span>
            </div>
            <p className="text-xs font-semibold text-neutral-200">
              {lesson ? lesson.title : "Select a lesson to begin"}
            </p>
            <p className="text-[11px] text-neutral-400">
              No playable video attached to this lesson
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
