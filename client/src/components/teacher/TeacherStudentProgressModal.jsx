import React, { useState, useEffect } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import LoadingSpinner from "../LoadingSpinner.jsx";
import StatusBadge from "../admin/StatusBadge.jsx";

export default function TeacherStudentProgressModal({
  isOpen,
  courseId,
  studentId,
  studentName,
  courseTitle,
  onClose,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !courseId || !studentId) return;

    let mounted = true;
    async function fetchProgress() {
      try {
        setLoading(true);
        setError(null);
        const res = await teacherApi.getStudentProgress(courseId, studentId);
        if (mounted) setData(res);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load student progress.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchProgress();
    return () => {
      mounted = false;
    };
  }, [isOpen, courseId, studentId]);

  if (!isOpen) return null;

  function formatSeconds(secs) {
    if (!secs || secs <= 0) return "0:00";
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = Math.floor(secs % 60);
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  }

  const stats = data?.stats || { totalLessons: 0, completedLessons: 0, completionPercentage: 0 };
  const lessons = data?.lessons || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Student Learning Dossier</h2>
              {data?.enrollmentStatus && (
                <StatusBadge type="enrollment" status={data.enrollmentStatus} />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="text-amber-400 font-semibold">{studentName || "Student"}</span> enrolled in{" "}
              <span className="text-slate-300 font-semibold">{data?.course?.title || courseTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content View */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <LoadingSpinner size="lg" text="Loading student learning progress..." />
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs text-center space-y-2">
            <p className="font-bold">Failed to load progress</p>
            <p className="text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Completion Overview Card */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400">Course Completion</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {stats.completionPercentage}% Completed
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-300 h-2.5 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, stats.completionPercentage))}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Total Lessons</span>
                  <span className="font-mono font-bold text-white text-sm">{stats.totalLessons}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Completed</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{stats.completedLessons}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Remaining</span>
                  <span className="font-mono font-bold text-slate-400 text-sm">
                    {Math.max(0, stats.totalLessons - stats.completedLessons)}
                  </span>
                </div>
              </div>
            </div>

            {/* Per-Lesson Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Lesson Progress Details ({lessons.length} Lessons)
              </h4>

              {lessons.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-4 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  No lessons found in this course.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/60 text-xs">
                  {lessons.map((lesson) => (
                    <div
                      key={lesson.lessonId}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-500">#{lesson.order}</span>
                          <span className="font-semibold text-slate-200">{lesson.lessonTitle}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {lesson.moduleName || "General"}
                          {lesson.lastWatchedAt && (
                            <span> • Last active {new Date(lesson.lastWatchedAt).toLocaleDateString()}</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <span className="font-mono font-semibold text-slate-300 block text-[11px]">
                            {formatSeconds(lesson.progressSeconds)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {lesson.progressPercentage}% watched
                          </span>
                        </div>
                        {lesson.completed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
