import React, { useState, useEffect, useCallback } from "react";
import { studentApi } from "../../api/studentApi.js";
import LoadingSpinner from "../LoadingSpinner.jsx";

/**
 * StudentAssignmentSection
 * Displays homework and assignments accessible to the student for this course,
 * supports multiple Google Drive links submission + optional written answer,
 * shows historical versions, and locks resubmissions once Reviewed.
 */
export default function StudentAssignmentSection({ courseId, activeLessonId, currentModuleName }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active submission modal state
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [driveLinks, setDriveLinks] = useState([{ title: "", url: "" }]);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState(null);

  // View submission history modal state
  const [historyAssignment, setHistoryAssignment] = useState(null);
  const [historySubmissions, setHistorySubmissions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchAssignments = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await studentApi.listCourseAssignments(courseId);
      setAssignments(data?.assignments || []);
    } catch (err) {
      setError(err.message || "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const openSubmitModal = (assignment) => {
    setActiveAssignment(assignment);
    setDriveLinks([{ title: "", url: "" }]);
    setTextAnswer("");
    setSubmitError("");
    setSubmitNotice(null);
  };

  const handleLinkChange = (index, field, value) => {
    setDriveLinks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddLink = () => {
    setDriveLinks((prev) => [...prev, { title: "", url: "" }]);
  };

  const handleRemoveLink = (index) => {
    setDriveLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const validateDriveUrl = (url) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    const cleanText = textAnswer.trim();
    const cleanLinks = driveLinks.filter((l) => l.url && l.url.trim());

    if (cleanLinks.length === 0 && !cleanText) {
      setSubmitError("Please provide at least one valid Google Drive link or a non-empty text answer.");
      return;
    }

    for (let i = 0; i < cleanLinks.length; i++) {
      if (!validateDriveUrl(cleanLinks[i].url)) {
        setSubmitError(`Link #${i + 1} is not a valid Google Drive link. Please enter a valid Google Drive link.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      await studentApi.submitAssignment(activeAssignment.id, {
        driveLinks: cleanLinks,
        textAnswer: cleanText,
      });

      setSubmitNotice("Your assignment was successfully submitted!");
      setTimeout(() => {
        setActiveAssignment(null);
        fetchAssignments();
      }, 1200);
    } catch (err) {
      setSubmitError(err.message || "Failed to submit assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openHistoryModal = async (assignment) => {
    setHistoryAssignment(assignment);
    try {
      setHistoryLoading(true);
      const data = await studentApi.getStudentAssignment(assignment.id);
      setHistorySubmissions(data?.submissions || []);
    } catch (_) {
      setHistorySubmissions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-center text-xs text-neutral-500">
        Loading assignments...
      </div>
    );
  }

  if (assignments.length === 0) {
    return null; // Keep learning interface minimal if no assignments exist for this course
  }

  // Filter assignments relevant to currently active lesson or module, plus course-wide assignments
  const relevantAssignments = assignments.filter((a) => {
    if (a.scope === "lesson") {
      return a.lessonId === activeLessonId;
    }
    if (a.scope === "module") {
      return a.moduleName === currentModuleName;
    }
    if (a.scope === "course") {
      return true;
    }
    return false;
  });

  // Do not render empty panel if no assignment applies to this lesson / module / course context
  if (relevantAssignments.length === 0) {
    return null;
  }

  // Count how many are specific to this lesson vs module/course
  const lessonSpecificCount = relevantAssignments.filter((a) => a.scope === "lesson").length;

  return (
    <section
      aria-label="Course Homework & Assignments"
      className="p-5 bg-white border border-neutral-200 rounded-xl sm:rounded-2xl shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div>
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
            <span>📝 Homework & Assignments</span>
            <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold">
              {relevantAssignments.length}
            </span>
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Submit homework solutions via Google Drive links and optional written answers.
          </p>
        </div>
      </div>

      <div className="divide-y divide-neutral-100 space-y-3">
        {relevantAssignments.map((assignment) => (
          <div key={assignment.id} className="pt-3 first:pt-0 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${assignment.scope === "course"
                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                        : assignment.scope === "module"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-amber-50 text-[#CA8A04] border border-amber-200"
                      }`}
                  >
                    {assignment.scope} assignment
                  </span>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${assignment.status === "reviewed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : assignment.status === "submitted"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                      }`}
                  >
                    {assignment.status === "not_submitted"
                      ? "Not Submitted"
                      : assignment.status === "reviewed"
                        ? "✓ Reviewed"
                        : "Submitted"}
                  </span>
                </div>

                <h4 className="text-xs sm:text-sm font-bold text-neutral-900 mt-1">
                  {assignment.title}
                </h4>
                <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed whitespace-pre-wrap">
                  {assignment.description}
                </p>

                {/* Scope context details, submission date & review info */}
                <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1.5 flex-wrap">
                  {assignment.latestSubmission?.submittedAt && (
                    <span>
                      <strong className="text-neutral-700">Last submitted:</strong>{" "}
                      {new Date(assignment.latestSubmission.submittedAt).toLocaleDateString()}{" "}
                      (v{assignment.latestSubmission.version})
                    </span>
                  )}
                  {assignment.isReviewed && assignment.latestSubmission?.reviewedAt && (
                    <span className="text-emerald-700 font-medium">
                      ✓ Reviewed by {assignment.latestSubmission.reviewedBy || "Instructor"} on{" "}
                      {new Date(assignment.latestSubmission.reviewedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Teacher Resource Links */}
                {assignment.resourceLinks && assignment.resourceLinks.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Resources:
                    </span>
                    {assignment.resourceLinks.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-neutral-50 hover:bg-neutral-100 text-[11px] text-[#CA8A04] font-medium border border-neutral-200 transition-colors flex items-center gap-1"
                      >
                        <span>📁</span>
                        <span>{link.title || `Resource ${idx + 1}`}</span>
                        <span className="text-[9px] font-mono text-neutral-400">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {assignment.hasSubmitted && (
                  <button
                    type="button"
                    onClick={() => openHistoryModal(assignment)}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    History ({assignment.totalVersions})
                  </button>
                )}

                {assignment.isReviewed ? (
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    Reviewed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSubmitModal(assignment)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#CA8A04] hover:bg-[#b07803] text-black font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    {assignment.hasSubmitted ? "Resubmit Answer" : "Submit Answer"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SUBMISSION MODAL */}
      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                  Submit: {activeAssignment.title}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {activeAssignment.hasSubmitted
                    ? "Resubmission: Previous versions are preserved."
                    : "First submission for this assignment."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveAssignment(null)}
                className="text-neutral-400 hover:text-neutral-700 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {submitError}
                </div>
              )}
              {submitNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-medium">
                  {submitNotice}
                </div>
              )}

              {/* Multiple Google Drive Links */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Google Drive Submission Links
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="text-xs font-bold text-[#CA8A04] hover:underline"
                  >
                    + Add another link
                  </button>
                </div>

                {driveLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Title (e.g. Maths HW Q1-5)"
                      value={link.title}
                      onChange={(e) => handleLinkChange(idx, "title", e.target.value)}
                      className="w-1/3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#CA8A04]"
                    />
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={link.url}
                      onChange={(e) => handleLinkChange(idx, "url", e.target.value)}
                      className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#CA8A04]"
                    />
                    {driveLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(idx)}
                        className="p-2 text-neutral-400 hover:text-rose-500 text-xs rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Optional Text Answer */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1">
                  Written Answer (Optional)
                </label>
                <textarea
                  rows={4}
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Provide any written commentary, answers, or notes..."
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#CA8A04] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setActiveAssignment(null)}
                  className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-[#CA8A04] hover:bg-[#b07803] text-black font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting && <LoadingSpinner size="sm" />}
                  <span>{activeAssignment.hasSubmitted ? "Confirm Resubmission" : "Submit Assignment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBMISSION HISTORY MODAL */}
      {historyAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                  Submission History: {historyAssignment.title}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {historySubmissions.length} historical version{historySubmissions.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAssignment(null)}
                className="text-neutral-400 hover:text-neutral-700 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {historyLoading ? (
                <div className="py-8 text-center text-xs text-neutral-500">Loading history...</div>
              ) : historySubmissions.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">No submissions found.</div>
              ) : (
                historySubmissions.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className={`p-3.5 rounded-xl border space-y-2 ${idx === 0
                        ? "bg-amber-50/40 border-amber-200"
                        : "bg-neutral-50 border-neutral-200 opacity-80"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-900">Version #{sub.version}</span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#CA8A04] text-black">
                            Latest
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${sub.status === "reviewed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {sub.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    {/* Google Drive links */}
                    {sub.driveLinks && sub.driveLinks.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">Submitted Links:</p>
                        {sub.driveLinks.map((l, lIdx) => (
                          <a
                            key={lIdx}
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#CA8A04] hover:underline flex items-center gap-1 font-medium"
                          >
                            <span>📁</span>
                            <span>{l.title || `Resource ${lIdx + 1}`} ↗</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Written text answer */}
                    {sub.textAnswer && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">Written Answer:</p>
                        <p className="p-2.5 rounded bg-white border border-neutral-200 text-xs text-neutral-700 whitespace-pre-wrap">
                          {sub.textAnswer}
                        </p>
                      </div>
                    )}

                    {sub.status === "reviewed" && (
                      <p className="text-[10px] text-emerald-700 font-semibold pt-1">
                        ✓ Reviewed by Instructor on {new Date(sub.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
