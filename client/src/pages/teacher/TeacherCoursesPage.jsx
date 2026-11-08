import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../../api/teacherApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import ConfirmModal from "../../components/admin/ConfirmModal.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import TeacherCourseCreateModal from "../../components/teacher/TeacherCourseCreateModal.jsx";

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'published', 'draft'

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'toggle-pub' | 'delete', course: obj }
  const [actionInProgress, setActionInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch teacher courses
  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherApi.listCourses();
      setCourses(data || []);
    } catch (err) {
      setError(err.message || "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Handle Toggle Publication
  const handleTogglePublication = async () => {
    if (!confirmAction || confirmAction.type !== "toggle-pub") return;
    const { course } = confirmAction;
    const willPublish = !course.isPublished;
    try {
      setActionInProgress(true);
      await teacherApi.toggleCoursePublication(course.id);
      setToastMessage({
        type: "success",
        text: `Course "${course.title}" ${willPublish ? "published to storefront" : "converted to draft"}.`,
      });
      setConfirmAction(null);
      await fetchCourses();
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to update publication status." });
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle Delete Course
  const handleDeleteCourse = async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    const { course } = confirmAction;
    try {
      setActionInProgress(true);
      await teacherApi.deleteCourse(course.id);
      setToastMessage({
        type: "success",
        text: `Course "${course.title}" deleted successfully.`,
      });
      setConfirmAction(null);
      await fetchCourses();
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to delete course. It may have existing enrollments or payments.",
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (statusFilter === "published" && !c.isPublished) return false;
      if (statusFilter === "draft" && c.isPublished) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    });
  }, [courses, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              My Courses
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
              {courses.length} Courses
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Author curriculum, upload video chapters via Bunny Stream, and control storefront availability
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create New Course</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            toastMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or slug..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Courses" },
            { id: "published", label: "Published (Live)" },
            { id: "draft", label: "Drafts" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / State View */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-slate-900/20 rounded-2xl border border-slate-800">
          <LoadingSpinner size="lg" text="Loading course catalog..." />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm font-bold text-rose-400">Failed to load courses</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchCourses}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/20 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-300">No courses found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "No course matches your active search or filter criteria. Try resetting filters."
              : "You haven't authored any courses yet. Create your first course to get started."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Author New Course
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Course Details</th>
                  <th className="py-3.5 px-4 text-center">Storefront Price</th>
                  <th className="py-3.5 px-4 text-center">Lessons</th>
                  <th className="py-3.5 px-4 text-center">Active Learners</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCourses.map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Title & Slug */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {course.thumbnail ? (
                          <img
                            src={course.thumbnail}
                            alt=""
                            className="w-10 h-7 rounded object-cover border border-slate-800 flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-10 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-500 font-bold flex-shrink-0">
                            EV
                          </div>
                        )}
                        <div>
                          <Link
                            to={`/app/teacher/courses/${course.id}`}
                            className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors"
                          >
                            {course.title}
                          </Link>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">/{course.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-200">
                      ₹{course.price}
                    </td>

                    {/* Lessons */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {course.lessonCount}
                      </span>
                    </td>

                    {/* Active Learners */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold text-[11px]">
                        {course.activeStudentCount}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge
                        type="publication"
                        status={course.isPublished ? "published" : "draft"}
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Course Editor & Lessons */}
                        <Link
                          to={`/app/teacher/courses/${course.id}`}
                          className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 font-semibold text-[11px] transition-colors"
                          title="Edit syllabus, modules, and Bunny Stream videos"
                        >
                          Curriculum Editor
                        </Link>

                        {/* Toggle Publication Button */}
                        <button
                          onClick={() => setConfirmAction({ type: "toggle-pub", course })}
                          className={`px-2.5 py-1 rounded border font-semibold text-[11px] transition-colors ${
                            course.isPublished
                              ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                              : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30"
                          }`}
                          title={course.isPublished ? "Unpublish course (hide from storefront)" : "Publish course (make visible)"}
                        >
                          {course.isPublished ? "Unpublish" : "Publish"}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setConfirmAction({ type: "delete", course })}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-semibold text-[11px] transition-colors"
                          title="Permanently remove course (protected if active enrollments or payments exist)"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Course Create Modal */}
      {showCreateModal && (
        <TeacherCourseCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(created) => {
            setShowCreateModal(false);
            setToastMessage({
              type: "success",
              text: `Course "${created.title}" successfully created.`,
            });
            fetchCourses();
          }}
        />
      )}

      {/* Confirmation Modal: Toggle Publication */}
      {confirmAction?.type === "toggle-pub" && (
        <ConfirmModal
          isOpen={true}
          title={confirmAction.course.isPublished ? "Unpublish Course" : "Publish Course to Storefront"}
          message={
            confirmAction.course.isPublished
              ? `Are you sure you want to unpublish "${confirmAction.course.title}"? It will no longer be visible on the public catalog, but existing enrolled students retain access.`
              : `Are you sure you want to publish "${confirmAction.course.title}"? It will become visible and purchasable in the public storefront.`
          }
          confirmText={confirmAction.course.isPublished ? "Unpublish Course" : "Publish Now"}
          confirmVariant={confirmAction.course.isPublished ? "amber" : "emerald"}
          loading={actionInProgress}
          onConfirm={handleTogglePublication}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Confirmation Modal: Delete Course */}
      {confirmAction?.type === "delete" && (
        <ConfirmModal
          isOpen={true}
          title="Permanently Delete Course"
          message={`Are you sure you want to delete "${confirmAction.course.title}"? This will delete the course and all associated lessons. Note: If students have enrolled or payments have been recorded, deletion will be blocked by system safeguards.`}
          confirmText="Delete Course"
          confirmVariant="rose"
          loading={actionInProgress}
          onConfirm={handleDeleteCourse}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
