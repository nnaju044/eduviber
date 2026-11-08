import React, { useState, useEffect, useCallback } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import LoadingSpinner from "../LoadingSpinner.jsx";

/**
 * TeacherAssignmentManager
 * Complete management of homework/assignments for a course:
 * - Create assignment at course, module, or lesson scope
 * - Attach multiple Google Drive resource links
 * - Enable / disable toggles
 * - View student submissions and complete version history
 * - Mark as Reviewed action
 */
export default function TeacherAssignmentManager({ courseId, courseTitle, modules = [], lessons = [] }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Form states for creating / editing an assignment
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [submittingForm, setSubmittingForm] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formScope, setFormScope] = useState("course"); // 'course' | 'module' | 'lesson'
  const [formModuleName, setFormModuleName] = useState("");
  const [formLessonId, setFormLessonId] = useState("");
  const [formResourceLinks, setFormResourceLinks] = useState([{ title: "", url: "" }]);
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [formError, setFormError] = useState("");

  // Submissions inspection modal state
  const [inspectingAssignment, setInspectingAssignment] = useState(null);
  const [submissionsRoster, setSubmissionsRoster] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Student historical versions view
  const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await teacherApi.listAssignments(courseId);
      setAssignments(list);
    } catch (err) {
      setError(err.message || "Failed to load course assignments.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchAssignments();
  }, [courseId, fetchAssignments]);

  const openCreateModal = () => {
    setEditingAssignment(null);
    setFormTitle("");
    setFormDescription("");
    setFormScope("course");
    setFormModuleName(modules[0] || "");
    setFormLessonId(lessons[0]?.id || "");
    setFormResourceLinks([{ title: "", url: "" }]);
    setFormIsEnabled(true);
    setFormError("");
    setShowFormModal(true);
  };

  const openEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setFormTitle(assignment.title || "");
    setFormDescription(assignment.description || "");
    setFormScope(assignment.scope || "course");
    setFormModuleName(assignment.moduleName || modules[0] || "");
    setFormLessonId(assignment.lessonId || lessons[0]?.id || "");
    setFormResourceLinks(
      assignment.resourceLinks && assignment.resourceLinks.length > 0
        ? assignment.resourceLinks.map((l) => ({ title: l.title || "", url: l.url || "" }))
        : [{ title: "", url: "" }]
    );
    setFormIsEnabled(Boolean(assignment.isEnabled));
    setFormError("");
    setShowFormModal(true);
  };

  // Handle resource link field updates
  const handleLinkChange = (index, field, value) => {
    setFormResourceLinks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddLink = () => {
    setFormResourceLinks((prev) => [...prev, { title: "", url: "" }]);
  };

  const handleRemoveLink = (index) => {
    setFormResourceLinks((prev) => prev.filter((_, i) => i !== index));
  };

  // Client-side Google Drive validation check
  const validateClientDriveUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    try {
      const p = new URL(url.trim());
      if (p.protocol !== "https:") return false;
      const h = p.hostname.toLowerCase();
      return (
        h === "drive.google.com" ||
        h === "docs.google.com" ||
        h === "sheets.google.com" ||
        h === "slides.google.com"
      );
    } catch (_) {
      return false;
    }
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Assignment title is required.");
      return;
    }

    if (!formDescription.trim()) {
      setFormError("Assignment instructions are required.");
      return;
    }

    if (formScope === "module" && !formModuleName) {
      setFormError("Please select a module for this module-level assignment.");
      return;
    }

    if (formScope === "lesson" && !formLessonId) {
      setFormError("Please select a lesson for this lesson-level assignment.");
      return;
    }

    // Filter and validate resource links
    const filteredLinks = formResourceLinks.filter((l) => l.url && l.url.trim());
    for (let i = 0; i < filteredLinks.length; i++) {
      if (!validateClientDriveUrl(filteredLinks[i].url)) {
        setFormError(`Link #${i + 1} is not a valid Google Drive link. Only secure HTTPS Google Drive links are accepted.`);
        return;
      }
    }

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      scope: formScope,
      moduleName: formScope !== "course" ? formModuleName : "",
      lessonId: formScope === "lesson" ? formLessonId : null,
      resourceLinks: filteredLinks,
      isEnabled: formIsEnabled,
    };

    try {
      setSubmittingForm(true);
      if (editingAssignment) {
        await teacherApi.updateAssignment(editingAssignment.id, payload);
        setNotice({ type: "success", text: "Assignment updated successfully." });
      } else {
        await teacherApi.createAssignment(courseId, payload);
        setNotice({ type: "success", text: "Assignment created successfully." });
      }
      setShowFormModal(false);
      fetchAssignments();
    } catch (err) {
      setFormError(err.message || "Failed to save assignment.");
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleToggleStatus = async (assignment) => {
    try {
      const nextStatus = !assignment.isEnabled;
      await teacherApi.toggleAssignmentStatus(assignment.id, nextStatus);
      setNotice({
        type: "success",
        text: `Assignment "${assignment.title}" has been ${nextStatus ? "enabled" : "disabled"}.`,
      });
      fetchAssignments();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Failed to toggle status." });
    }
  };

  // Inspect submissions roster
  const handleInspectSubmissions = async (assignment) => {
    setInspectingAssignment(assignment);
    setSelectedStudentHistory(null);
    try {
      setSubmissionsLoading(true);
      const data = await teacherApi.listAssignmentSubmissions(assignment.id);
      setSubmissionsRoster(data?.roster || []);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Failed to load submissions." });
    } finally {
      setSubmissionsLoading(false);
    }
  };

  // View specific student's full submission history
  const handleViewHistory = async (studentId) => {
    if (!inspectingAssignment) return;
    try {
      setHistoryLoading(true);
      const data = await teacherApi.getStudentSubmissionHistory(inspectingAssignment.id, studentId);
      setSelectedStudentHistory(data);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Failed to load submission history." });
    } finally {
      setHistoryLoading(false);
    }
  };

  // Review submission
  const handleReviewSubmission = async (submissionId) => {
    if (!inspectingAssignment) return;
    try {
      setReviewingId(submissionId);
      await teacherApi.reviewSubmission(inspectingAssignment.id, submissionId);
      setNotice({ type: "success", text: "Submission marked as Reviewed." });
      // Refresh current rosters
      handleInspectSubmissions(inspectingAssignment);
      if (selectedStudentHistory) {
        handleViewHistory(selectedStudentHistory.student.id);
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Failed to review submission." });
    } finally {
      setReviewingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <LoadingSpinner text="Loading course homework & assignments..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Notice */}
      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            notice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white px-2 py-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>📝 Homework & Assignments</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-xs font-bold">
              {assignments.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Create course, module, or lesson assignments with Google Drive resources.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg bg-[#CA8A04] hover:bg-[#b07803] text-black font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span>+ Create Assignment</span>
        </button>
      </div>

      {/* Assignments List */}
      {assignments.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
          <span className="text-3xl block">📋</span>
          <p className="text-sm font-bold text-slate-300">No assignments created yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create homework tasks for your students. You can assign at course, module, or individual lesson level.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-[#CA8A04] hover:bg-[#b07803] text-black font-bold text-xs cursor-pointer"
          >
            Create First Assignment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className={`p-5 rounded-2xl border transition-all ${
                assignment.isEnabled
                  ? "bg-slate-900/40 border-slate-800"
                  : "bg-slate-950/70 border-slate-800/60 opacity-80"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        assignment.scope === "course"
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          : assignment.scope === "module"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {assignment.scope} level
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        assignment.isEnabled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                      }`}
                    >
                      {assignment.isEnabled ? "ENABLED" : "DISABLED"}
                    </span>

                    {assignment.scope === "module" && (
                      <span className="text-xs text-slate-400 font-medium">
                        Module: <strong className="text-slate-300">{assignment.moduleName}</strong>
                      </span>
                    )}
                    {assignment.scope === "lesson" && assignment.lesson && (
                      <span className="text-xs text-slate-400 font-medium">
                        Lesson #{assignment.lesson.order}: <strong className="text-slate-300">{assignment.lesson.title}</strong>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white mt-1.5 truncate">
                    {assignment.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {assignment.description}
                  </p>

                  {/* Resource Links Preview */}
                  {assignment.resourceLinks && assignment.resourceLinks.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      <span className="text-[11px] text-slate-500 font-medium">Resources:</span>
                      {assignment.resourceLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-800 text-[11px] text-amber-400 border border-slate-700 transition-colors flex items-center gap-1"
                        >
                          <span>📁</span>
                          <span>{link.title || `Resource ${idx + 1}`}</span>
                          <span className="text-[9px] text-slate-500 font-mono">↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions & Metrics */}
                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleInspectSubmissions(assignment)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[#CA8A04] border border-[#CA8A04]/40 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>👥 Submissions</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                      {assignment.reviewedCount}/{assignment.totalSubmissions}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(assignment)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                      assignment.isEnabled
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {assignment.isEnabled ? "Disable" : "Enable"}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(assignment)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT ASSIGNMENT MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingAssignment ? "Edit Assignment" : "Create New Assignment"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Course: {courseTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Assignment Title <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Chapter 1 Practice Problem Set"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Instructions / Description <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide detailed instructions for the assignment..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Assignment Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Assignment Scope
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="course">Course Level</option>
                    <option value="module">Module Level</option>
                    <option value="lesson">Lesson Level</option>
                  </select>
                </div>

                {formScope !== "course" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Associated Module <span className="text-amber-400">*</span>
                    </label>
                    <select
                      value={formModuleName}
                      onChange={(e) => setFormModuleName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {modules.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formScope === "lesson" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Associated Lesson <span className="text-amber-400">*</span>
                    </label>
                    <select
                      value={formLessonId}
                      onChange={(e) => setFormLessonId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {lessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          #{l.order} - {l.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Google Drive Teacher Resources */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Google Drive Learning Resources (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    + Add another link
                  </button>
                </div>

                {formResourceLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Title (e.g. Chapter 1 Worksheet PDF)"
                      value={link.title}
                      onChange={(e) => handleLinkChange(idx, "title", e.target.value)}
                      className="w-1/3 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={link.url}
                      onChange={(e) => handleLinkChange(idx, "url", e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                    {formResourceLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(idx)}
                        className="p-2 text-slate-500 hover:text-rose-400 text-xs rounded"
                        title="Remove link"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <p className="text-[11px] text-slate-500">
                  Accepted formats: drive.google.com, docs.google.com, sheets.google.com, slides.google.com.
                </p>
              </div>

              {/* Status Toggle */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabledCheckbox"
                  checked={formIsEnabled}
                  onChange={(e) => setFormIsEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-[#CA8A04] focus:ring-0"
                />
                <label htmlFor="isEnabledCheckbox" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Enable assignment immediately for eligible enrolled students
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-5 py-2 rounded-lg bg-[#CA8A04] hover:bg-[#b07803] text-black font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingForm && <LoadingSpinner size="sm" />}
                  <span>{editingAssignment ? "Save Changes" : "Create Assignment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBMISSION ROSTER MODAL */}
      {inspectingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    Submissions: {inspectingAssignment.title}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-[#CA8A04] border border-[#CA8A04]/30">
                    {inspectingAssignment.scope} level
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Course: {courseTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectingAssignment(null);
                  setSelectedStudentHistory(null);
                }}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {submissionsLoading ? (
                <div className="py-12 flex items-center justify-center">
                  <LoadingSpinner text="Loading enrolled student submissions..." />
                </div>
              ) : selectedStudentHistory ? (
                /* Detail / Historical Versions View */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Student: {selectedStudentHistory.student.name} ({selectedStudentHistory.student.email})
                      </h4>
                      <p className="text-xs text-slate-400">
                        Complete Submission History ({selectedStudentHistory.submissions.length} version{selectedStudentHistory.submissions.length === 1 ? "" : "s"})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentHistory(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      ← Back to Roster
                    </button>
                  </div>

                  {selectedStudentHistory.submissions.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className={`p-4 rounded-xl border space-y-3 ${
                        idx === 0
                          ? "bg-slate-950 border-amber-500/30"
                          : "bg-slate-950/60 border-slate-800/80 opacity-80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">Version #{sub.version}</span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#CA8A04]/20 text-[#CA8A04]">
                              Latest
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sub.status === "reviewed"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {sub.status.toUpperCase()}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          Submitted: {new Date(sub.submittedAt).toLocaleString()}
                        </span>
                      </div>

                      {/* Submitted Google Drive Links */}
                      {sub.driveLinks && sub.driveLinks.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Google Drive Links:
                          </p>
                          <div className="flex flex-col gap-1">
                            {sub.driveLinks.map((l, lIdx) => (
                              <a
                                key={lIdx}
                                href={l.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-amber-400 hover:underline flex items-center gap-1.5 font-medium"
                              >
                                <span>📁</span>
                                <span>{l.title || `Resource ${lIdx + 1}`}</span>
                                <span className="text-slate-500 text-[10px] font-mono">{l.url} ↗</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Submitted Written Text Answer */}
                      {sub.textAnswer && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Written Answer:
                          </p>
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {sub.textAnswer}
                          </div>
                        </div>
                      )}

                      {/* Review State / Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        {sub.status === "reviewed" ? (
                          <span className="text-[11px] text-emerald-400 font-medium">
                            ✓ Reviewed on {new Date(sub.reviewedAt).toLocaleString()} by {sub.reviewedBy || "Instructor"}
                          </span>
                        ) : (
                          <div className="flex items-center justify-end w-full">
                            <button
                              type="button"
                              disabled={reviewingId === sub.id}
                              onClick={() => handleReviewSubmission(sub.id)}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              {reviewingId === sub.id && <LoadingSpinner size="sm" />}
                              <span>✓ Mark as Reviewed</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : submissionsRoster.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No active students enrolled in this course yet.
                </div>
              ) : (
                /* Overall Roster Table */
                <div className="divide-y divide-slate-800">
                  <div className="pb-2 grid grid-cols-12 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span className="col-span-5">Enrolled Student</span>
                    <span className="col-span-3 text-center">Status</span>
                    <span className="col-span-4 text-right">Actions</span>
                  </div>

                  {submissionsRoster.map((item) => (
                    <div
                      key={item.student.id}
                      className="py-3.5 grid grid-cols-12 items-center text-xs gap-2"
                    >
                      <div className="col-span-5 min-w-0">
                        <p className="font-bold text-white truncate">{item.student.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{item.student.email}</p>
                      </div>

                      <div className="col-span-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === "reviewed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : item.status === "submitted"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {item.status === "not_submitted"
                            ? "NOT SUBMITTED"
                            : item.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="col-span-4 flex items-center justify-end gap-2">
                        {item.hasSubmitted ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleViewHistory(item.student.id)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 cursor-pointer"
                            >
                              Inspect ({item.totalVersions})
                            </button>

                            {item.status !== "reviewed" && item.latestSubmission && (
                              <button
                                type="button"
                                disabled={reviewingId === item.latestSubmission.id}
                                onClick={() => handleReviewSubmission(item.latestSubmission.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                              >
                                Review
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Awaiting work</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
