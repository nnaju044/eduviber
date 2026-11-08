import React, { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "../../api/adminApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import ConfirmModal from "../../components/admin/ConfirmModal.jsx";
import CourseCreateModal from "../../components/admin/CourseCreateModal.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [pubFilter, setPubFilter] = useState("all"); // 'all', 'published', 'draft'
  const [ownershipFilter, setOwnershipFilter] = useState("all"); // 'all', 'platform', 'teacher'

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null); // for inspection drawer

  // Confirmation modals state
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'toggle-pub' | 'delete', course: obj }
  const [actionInProgress, setActionInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch courses and teachers list for creator modal
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [coursesData, teachersData] = await Promise.all([
        adminApi.listCourses(),
        adminApi.listTeachers(),
      ]);
      setCourses(coursesData);
      setTeachers(teachersData);
    } catch (err) {
      setError(err.message || "Failed to load course catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle Course Publication
  const handleTogglePublication = async () => {
    if (!confirmAction || confirmAction.type !== "toggle-pub") return;
    const { course } = confirmAction;
    const willPublish = !course.isPublished;
    try {
      setActionInProgress(true);
      await adminApi.toggleCoursePublication(course.id);
      setToastMessage({
        type: "success",
        text: `Course "${course.title}" ${willPublish ? "published to storefront" : "converted to draft"}.`,
      });
      setConfirmAction(null);
      await fetchData();
      if (selectedCourse && selectedCourse.id === course.id) {
        setSelectedCourse((prev) => ({ ...prev, isPublished: willPublish }));
      }
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to update publication status." });
    } finally {
      setActionInProgress(false);
    }
  };

  // Delete Course
  const handleDeleteCourse = async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    const { course } = confirmAction;
    try {
      setActionInProgress(true);
      await adminApi.deleteCourse(course.id);
      setToastMessage({
        type: "success",
        text: `Course "${course.title}" permanently deleted.`,
      });
      setConfirmAction(null);
      if (selectedCourse && selectedCourse.id === course.id) {
        setSelectedCourse(null);
      }
      await fetchData();
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to delete course. It may have existing payments or enrollments.",
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // Publication filter
      if (pubFilter === "published" && !c.isPublished) return false;
      if (pubFilter === "draft" && c.isPublished) return false;

      // Ownership filter
      const isTeacherOwned = Boolean(c.owner && c.owner.role === "teacher");
      if (ownershipFilter === "platform" && isTeacherOwned) return false;
      if (ownershipFilter === "teacher" && !isTeacherOwned) return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const ownerName = c.owner ? c.owner.name.toLowerCase() : "platform";
      return (
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.instructor && c.instructor.toLowerCase().includes(q)) ||
        ownerName.includes(q)
      );
    });
  }, [courses, searchQuery, pubFilter, ownershipFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Course Catalog Governance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
              {courses.length} Courses
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Platform-wide curriculum inspection, ownership verification, and publishing controls
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
            placeholder="Search by title, slug, or instructor..."
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Ownership Filter */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setOwnershipFilter("all")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                ownershipFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Owners
            </button>
            <button
              onClick={() => setOwnershipFilter("platform")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                ownershipFilter === "platform" ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Platform
            </button>
            <button
              onClick={() => setOwnershipFilter("teacher")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                ownershipFilter === "teacher" ? "bg-purple-500/20 text-purple-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Teacher
            </button>
          </div>

          {/* Publication Filter */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setPubFilter("all")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                pubFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setPubFilter("published")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                pubFilter === "published" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Live
            </button>
            <button
              onClick={() => setPubFilter("draft")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                pubFilter === "draft" ? "bg-slate-800 text-slate-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Draft
            </button>
          </div>
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
            onClick={fetchData}
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
          <p className="text-sm font-bold text-slate-300">No courses match filters</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || pubFilter !== "all" || ownershipFilter !== "all"
              ? "Try adjusting your search criteria or resetting filters."
              : "No courses currently exist in the platform catalog."}
          </p>
          {(searchQuery || pubFilter !== "all" || ownershipFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPubFilter("all");
                setOwnershipFilter("all");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Course Info</th>
                  <th className="py-3.5 px-4">Ownership</th>
                  <th className="py-3.5 px-4 text-center">Price</th>
                  <th className="py-3.5 px-4 text-center">Lessons</th>
                  <th className="py-3.5 px-4 text-center">Students</th>
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
                          <p className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                            {course.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono text-slate-500">/{course.slug}</span>
                            {course.instructor && (
                              <span>• by {course.instructor}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Ownership distinction */}
                    <td className="py-3.5 px-4">
                      <StatusBadge type="ownership" owner={course.owner} />
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-200">
                      ₹{course.price}
                    </td>

                    {/* Lessons Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {course.lessonCount}
                      </span>
                    </td>

                    {/* Active Students */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
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
                        {/* Inspect Drawer */}
                        <button
                          onClick={() => setSelectedCourse(course)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition-colors"
                          title="Inspect course details"
                        >
                          Details
                        </button>

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

                        {/* Delete Button (safe with checks) */}
                        <button
                          onClick={() => setConfirmAction({ type: "delete", course })}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-semibold text-[11px] transition-colors"
                          title="Permanently remove course (protected if payments exist)"
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

      {/* Course Detail Drawer Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 min-h-screen p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Course Dossier</h2>
                  <p className="text-xs text-slate-400">Curriculum governance & metrics</p>
                </div>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Course Info Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                {selectedCourse.thumbnail && (
                  <img
                    src={selectedCourse.thumbnail}
                    alt=""
                    className="w-full h-40 object-cover rounded-lg border border-slate-800"
                  />
                )}

                <div>
                  <h3 className="text-base font-bold text-white">{selectedCourse.title}</h3>
                  <p className="text-xs font-mono text-amber-400 mt-0.5">/{selectedCourse.slug}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Ownership</span>
                    <div className="mt-1">
                      <StatusBadge type="ownership" owner={selectedCourse.owner} />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Storefront Status</span>
                    <div className="mt-1">
                      <StatusBadge
                        type="publication"
                        status={selectedCourse.isPublished ? "published" : "draft"}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Course Price</span>
                    <span className="font-mono font-bold text-slate-200 mt-1 block">
                      ₹{selectedCourse.price}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Instructor Label</span>
                    <span className="text-slate-200 font-semibold mt-1 block">
                      {selectedCourse.instructor || "Platform"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Lessons</span>
                    <span className="font-mono font-bold text-slate-200 mt-1 block">
                      {selectedCourse.lessonCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Active Enrollments</span>
                    <span className="font-mono font-bold text-emerald-400 mt-1 block">
                      {selectedCourse.activeStudentCount}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <a
                    href={`/courses/${selectedCourse.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    <span>View Public Storefront Page</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedCourse(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Close Dossier
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmAction({ type: "toggle-pub", course: selectedCourse })}
                  className={`px-3.5 py-2 rounded-lg font-bold text-xs ${
                    selectedCourse.isPublished
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                  }`}
                >
                  {selectedCourse.isPublished ? "Unpublish" : "Publish Course"}
                </button>
                <button
                  onClick={() => setConfirmAction({ type: "delete", course: selectedCourse })}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                >
                  Delete Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course Create Modal */}
      {showCreateModal && (
        <CourseCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          teachers={teachers}
          onSuccess={(created) => {
            setShowCreateModal(false);
            setToastMessage({
              type: "success",
              text: `Course "${created?.title || "New Course"}" successfully created.`,
            });
            try {
              fetchData();
            } catch (refreshErr) {
              console.warn("[CoursesPage] Error refreshing course catalog:", refreshErr);
            }
          }}
        />
      )}

      {/* Confirmation Modal: Toggle Publication */}
      {confirmAction?.type === "toggle-pub" && (
        <ConfirmModal
          isOpen={true}
          title={confirmAction.course.isPublished ? "Unpublish Course" : "Publish Course"}
          message={
            confirmAction.course.isPublished
              ? `Are you sure you want to unpublish "${confirmAction.course.title}"? It will be removed from the public course catalog, but existing enrolled students will retain access.`
              : `Are you sure you want to publish "${confirmAction.course.title}"? It will become visible and purchasable in the public catalog.`
          }
          confirmText={confirmAction.course.isPublished ? "Unpublish" : "Publish Now"}
          confirmVariant={confirmAction.course.isPublished ? "amber" : "emerald"}
          loading={actionInProgress}
          onConfirm={handleTogglePublication}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Confirmation Modal: Delete */}
      {confirmAction?.type === "delete" && (
        <ConfirmModal
          isOpen={true}
          title="Permanently Delete Course"
          message={`Are you sure you want to delete "${confirmAction.course.title}"? This will delete the course and all its lessons. If students have enrolled or made payments for this course, deletion will be blocked by system safeguards.`}
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
