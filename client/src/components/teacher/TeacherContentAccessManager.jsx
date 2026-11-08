import React, { useState, useEffect, useCallback } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import ConfirmModal from "../admin/ConfirmModal.jsx";
import LoadingSpinner from "../LoadingSpinner.jsx";

/**
 * TeacherContentAccessManager
 * Provides granular module & lesson unlock/lock toggles, bulk "Unlock All" / "Lock All" controls,
 * and per-student access inspection/customization.
 */
export default function TeacherContentAccessManager({ courseId, courseTitle }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessData, setAccessData] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentAccessData, setStudentAccessData] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);

  // Bulk confirmation modal states
  const [bulkAction, setBulkAction] = useState(null); // 'unlock' | 'lock' | null
  const [bulkLoading, setBulkLoading] = useState(false);

  // Action status toast
  const [actionNotice, setActionNotice] = useState(null);

  // Load course content access overview
  const fetchAccessData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherApi.getCourseContentAccess(courseId);
      setAccessData(data);
    } catch (err) {
      setError(err.message || "Failed to load content access settings.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchAccessData();
  }, [courseId, fetchAccessData]);

  // Load specific student's access when chosen
  const fetchStudentAccess = useCallback(async (studentId) => {
    if (!studentId) {
      setStudentAccessData(null);
      return;
    }
    try {
      setStudentLoading(true);
      const data = await teacherApi.getStudentContentAccess(courseId, studentId);
      setStudentAccessData(data);
    } catch (err) {
      setActionNotice({ type: "error", text: err.message || "Failed to load student access." });
    } finally {
      setStudentLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentAccess(selectedStudentId);
    } else {
      setStudentAccessData(null);
    }
  }, [selectedStudentId, fetchStudentAccess]);

  // Handle module toggle
  const handleToggleModule = async (moduleName, currentUnlocked) => {
    try {
      const nextUnlocked = !currentUnlocked;
      await teacherApi.updateModuleAccess(courseId, {
        moduleName,
        unlocked: nextUnlocked,
        studentId: selectedStudentId || null,
      });

      setActionNotice({
        type: "success",
        text: `Module "${moduleName}" ${nextUnlocked ? "unlocked" : "locked"} successfully.`,
      });

      if (selectedStudentId) {
        fetchStudentAccess(selectedStudentId);
      } else {
        fetchAccessData();
      }
    } catch (err) {
      setActionNotice({ type: "error", text: err.message || "Failed to update module access." });
    }
  };

  // Handle lesson toggle
  const handleToggleLesson = async (lessonId, currentUnlocked, lessonTitle) => {
    try {
      const nextUnlocked = !currentUnlocked;
      await teacherApi.updateLessonAccess(courseId, lessonId, {
        unlocked: nextUnlocked,
        studentId: selectedStudentId || null,
      });

      setActionNotice({
        type: "success",
        text: `Lesson "${lessonTitle}" ${nextUnlocked ? "unlocked" : "locked"} successfully.`,
      });

      if (selectedStudentId) {
        fetchStudentAccess(selectedStudentId);
      } else {
        fetchAccessData();
      }
    } catch (err) {
      setActionNotice({ type: "error", text: err.message || "Failed to update lesson access." });
    }
  };

  // Handle Bulk Unlock All
  const handleConfirmBulkUnlock = async () => {
    try {
      setBulkLoading(true);
      await teacherApi.bulkUnlockAll(courseId);
      setActionNotice({
        type: "success",
        text: "All modules and lessons have been unlocked for all students.",
      });
      setBulkAction(null);
      setSelectedStudentId("");
      fetchAccessData();
    } catch (err) {
      setActionNotice({ type: "error", text: err.message || "Failed to perform bulk unlock." });
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle Bulk Lock All
  const handleConfirmBulkLock = async () => {
    try {
      setBulkLoading(true);
      await teacherApi.bulkLockAll(courseId);
      setActionNotice({
        type: "success",
        text: "All modules and lessons have been locked for all students.",
      });
      setBulkAction(null);
      setSelectedStudentId("");
      fetchAccessData();
    } catch (err) {
      setActionNotice({ type: "error", text: err.message || "Failed to perform bulk lock." });
    } finally {
      setBulkLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <LoadingSpinner text="Loading content access control..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
        <p className="font-bold">Error loading content access:</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  const { modules = [], lessons = [], baseline, students = [] } = accessData || {};
  const isStudentScope = Boolean(selectedStudentId && studentAccessData);

  // Determine current active unlock status map based on scope
  const activeModules = isStudentScope ? studentAccessData.modules : {};
  const activeLessons = isStudentScope ? studentAccessData.lessons : {};

  // Group lessons by module
  const lessonsByModule = {};
  for (const mod of modules) {
    lessonsByModule[mod] = lessons.filter((l) => (l.moduleName || "General") === mod);
  }

  return (
    <div className="space-y-6">
      {/* Action Notice */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            actionNotice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{actionNotice.text}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Scope Selector & Bulk Actions Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Access Management Scope
          </label>
          <div className="flex items-center gap-3">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 w-full sm:w-80"
            >
              <option value="">Course Baseline (Default for all enrolled students)</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.email}) {st.hasCustomAccess ? "★ [Custom Override]" : ""}
                </option>
              ))}
            </select>
            {isStudentScope && (
              <button
                type="button"
                onClick={() => setSelectedStudentId("")}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-medium transition-colors"
              >
                Reset to Baseline
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isStudentScope
              ? `Configuring custom access override for: ${studentAccessData?.student?.name}`
              : "Changes to baseline apply to all enrolled students without custom overrides."}
          </p>
        </div>

        {/* Bulk Action Buttons (Course Scope) */}
        {!isStudentScope && (
          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setBulkAction("unlock")}
              className="px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[#CA8A04] border border-[#CA8A04]/40 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔓</span> Unlock All Content
            </button>
            <button
              type="button"
              onClick={() => setBulkAction("lock")}
              className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔒</span> Lock All Content
            </button>
          </div>
        )}
      </div>

      {/* Modules and Lessons Hierarchy Accordion / List */}
      <div className="space-y-4">
        {modules.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/30 border border-slate-800 rounded-xl text-slate-400 text-xs">
            No published lessons or modules found in this course. Add lessons to manage content access.
          </div>
        ) : (
          modules.map((moduleName, modIdx) => {
            const moduleLessons = lessonsByModule[moduleName] || [];
            const isModUnlocked = isStudentScope
              ? Boolean(activeModules[moduleName]?.isUnlocked)
              : baseline.unlockedModules.includes(moduleName);

            return (
              <div
                key={moduleName}
                className={`rounded-2xl border transition-all ${
                  isModUnlocked
                    ? "bg-slate-900/40 border-slate-800"
                    : "bg-slate-950/60 border-slate-800/80 opacity-90"
                }`}
              >
                {/* Module Header Bar */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-900/50 rounded-t-2xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isModUnlocked
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {isModUnlocked ? "M" + (modIdx + 1) : "🔒"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Module {modIdx + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isModUnlocked
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isModUnlocked ? "UNLOCKED" : "LOCKED"}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate mt-0.5">
                        {moduleName}
                      </h3>
                      {!isModUnlocked && (
                        <p className="text-[11px] text-rose-400/90 font-medium mt-0.5">
                          ⚠️ Module is locked: all lessons inside this module are strictly blocked for students.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Module Toggle Switch */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleModule(moduleName, isModUnlocked)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        isModUnlocked
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                          : "bg-[#CA8A04] hover:bg-[#b07803] text-black border border-[#CA8A04]"
                      }`}
                    >
                      {isModUnlocked ? "Lock Module" : "Unlock Module"}
                    </button>
                  </div>
                </div>

                {/* Lessons in Module */}
                <div className="p-4 sm:p-5 divide-y divide-slate-800/60">
                  {moduleLessons.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">No published lessons in this module.</p>
                  ) : (
                    moduleLessons.map((l) => {
                      const lessonIdStr = l.id.toString();
                      const isDirectlyUnlocked = isStudentScope
                        ? Boolean(activeLessons[lessonIdStr]?.isLessonDirectlyUnlocked)
                        : baseline.unlockedLessons.includes(lessonIdStr);

                      const isEffectivelyUnlocked = isModUnlocked && isDirectlyUnlocked;

                      return (
                        <div
                          key={l.id}
                          className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isEffectivelyUnlocked
                                  ? "bg-slate-800 text-slate-300 border border-slate-700"
                                  : "bg-rose-950/40 text-rose-400 border border-rose-800/60"
                              }`}
                            >
                              {isEffectivelyUnlocked ? l.order : "🔒"}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-200 truncate">
                                  {l.title}
                                </span>
                                {l.isFreePreview && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    Free Preview
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span>{l.durationMinutes || 0}m</span>
                                <span>•</span>
                                <span
                                  className={
                                    isEffectivelyUnlocked
                                      ? "text-emerald-400 font-medium"
                                      : "text-rose-400 font-medium"
                                  }
                                >
                                  {isEffectivelyUnlocked
                                    ? "Student Accessible"
                                    : !isModUnlocked
                                    ? "Locked (Blocked by parent module)"
                                    : "Locked (Lesson directly locked)"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Lesson Unlock/Lock Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleLesson(l.id, isDirectlyUnlocked, l.title)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                              isDirectlyUnlocked
                                ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {isDirectlyUnlocked ? "Lock Lesson" : "Unlock Lesson"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal for Bulk Unlock All */}
      {bulkAction === "unlock" && (
        <ConfirmModal
          isOpen={true}
          title="Unlock All Course Content"
          message={`Are you sure you want to unlock all ${modules.length} modules and ${lessons.length} lessons for ALL enrolled students in "${courseTitle}"? This will make the entire course curriculum accessible immediately.`}
          confirmText="Unlock All Content"
          confirmVariant="amber"
          loading={bulkLoading}
          onConfirm={handleConfirmBulkUnlock}
          onCancel={() => setBulkAction(null)}
        />
      )}

      {/* Confirmation Modal for Bulk Lock All */}
      {bulkAction === "lock" && (
        <ConfirmModal
          isOpen={true}
          title="Lock All Course Content"
          message={`Are you sure you want to lock all modules and lessons for ALL enrolled students in "${courseTitle}"? Students will not be able to watch any lessons until unlocked.`}
          confirmText="Lock All Content"
          confirmVariant="rose"
          loading={bulkLoading}
          onConfirm={handleConfirmBulkLock}
          onCancel={() => setBulkAction(null)}
        />
      )}
    </div>
  );
}
