import React, { useState, useEffect, useCallback, useMemo } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import TeacherStudentProgressModal from "../../components/teacher/TeacherStudentProgressModal.jsx";
import TeacherEnrollStudentModal from "../../components/teacher/TeacherEnrollStudentModal.jsx";

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  // Modals state
  const [activeProgressTarget, setActiveProgressTarget] = useState(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Fetch student directory and teacher courses
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentsData, coursesData] = await Promise.all([
        teacherApi.listStudents(),
        teacherApi.listCourses(),
      ]);
      setStudents(studentsData || []);
      setTeacherCourses(coursesData || []);
    } catch (err) {
      setError(err.message || "Failed to load student directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extract unique courses for filtering (combine owned courses with enrolled courses)
  const courseOptions = useMemo(() => {
    const map = new Map();
    teacherCourses.forEach((c) => {
      const id = c.id || c._id;
      if (id && c.title) map.set(id, c.title);
    });
    students.forEach((s) => {
      if (s.courseId && s.courseTitle) {
        map.set(s.courseId, s.courseTitle);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [teacherCourses, students]);

  // Handle Toggle Enrollment Status (Active <-> Suspended)
  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === "active" ? "suspended" : "active";
    const confirmMsg =
      nextStatus === "suspended"
        ? `Are you sure you want to suspend "${item.student?.name}" from "${item.courseTitle}"? The student will lose video playback access for this course.`
        : `Reactivate access for "${item.student?.name}" in "${item.courseTitle}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setProcessingId(item.enrollmentId);
      setActionSuccess("");
      await teacherApi.updateStudentEnrollmentStatus(item.courseId, item.student?.id, nextStatus);
      setActionSuccess(`Enrollment for ${item.student?.name} is now ${nextStatus}.`);
      setStudents((prev) =>
        prev.map((s) => (s.enrollmentId === item.enrollmentId ? { ...s, status: nextStatus } : s))
      );
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to update enrollment status.");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Remove Student from Course (Marks as Expired)
  const handleRemoveStudent = async (item) => {
    const confirmMsg = `Remove "${item.student?.name}" from "${item.courseTitle}"? Their enrollment will be marked expired, revoking course access while preserving their account and overall platform profile.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setProcessingId(item.enrollmentId);
      setActionSuccess("");
      await teacherApi.removeStudentFromCourse(item.courseId, item.student?.id);
      setActionSuccess(`Student ${item.student?.name} was removed from ${item.courseTitle}.`);
      setStudents((prev) =>
        prev.map((s) => (s.enrollmentId === item.enrollmentId ? { ...s, status: "expired" } : s))
      );
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to remove student from course.");
    } finally {
      setProcessingId(null);
    }
  };

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((item) => {
      // Course filter
      if (selectedCourseFilter !== "all" && item.courseId !== selectedCourseFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== "all" && item.status !== selectedStatusFilter) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const sName = item.student?.name?.toLowerCase() || "";
      const sEmail = item.student?.email?.toLowerCase() || "";
      const cTitle = item.courseTitle?.toLowerCase() || "";
      return sName.includes(q) || sEmail.includes(q) || cTitle.includes(q);
    });
  }, [students, searchQuery, selectedCourseFilter, selectedStatusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Class Management & Students
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
              {students.length} Enrollments
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enroll students into your classes, provision student accounts, inspect curriculum progress, and manage course access.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Enroll Student</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-2"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess("")} className="text-emerald-400 hover:text-emerald-200">✕</button>
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
            placeholder="Search by student name, email, or course..."
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Course Filter Dropdown */}
          {courseOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold whitespace-nowrap">Course:</label>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">All My Courses</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-semibold whitespace-nowrap">Status:</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending Approval</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && students.length === 0 ? (
        <div className="p-16 text-center">
          <LoadingSpinner size="lg" text="Loading student directory and class enrollments..." />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-rose-400 font-bold text-sm">Failed to load student directory</p>
          <p className="text-xs text-slate-400">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-16 rounded-2xl border border-dashed border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-white text-base">No Students Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery || selectedCourseFilter !== "all" || selectedStatusFilter !== "all"
              ? "No enrollments matched your search or filters. Try resetting filters."
              : "No students are enrolled in your courses yet. Click 'Enroll Student' to add an existing student or provision a new student account."}
          </p>
          {searchQuery || selectedCourseFilter !== "all" || selectedStatusFilter !== "all" ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCourseFilter("all");
                setSelectedStatusFilter("all");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
            >
              + Enroll First Student
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Course Enrolled</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Enrolled Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.map((item) => {
                  const isProcessing = processingId === item.enrollmentId;
                  const canToggle = item.status === "active" || item.status === "suspended";

                  return (
                    <tr
                      key={item.enrollmentId}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-700">
                            {item.student?.name?.charAt(0)?.toUpperCase() || "S"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                              {item.student?.name || "Student"}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {item.student?.email || "N/A"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Course */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-200">{item.courseTitle}</p>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge type="enrollment" status={item.status} />
                      </td>

                      {/* Enrolled Date */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {item.enrolledAt ? new Date(item.enrolledAt).toLocaleDateString() : "N/A"}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              setActiveProgressTarget({
                                courseId: item.courseId,
                                studentId: item.student?.id,
                                studentName: item.student?.name,
                                courseTitle: item.courseTitle,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 font-semibold text-[11px] transition-colors"
                            title="Inspect Student Progress"
                          >
                            Progress
                          </button>

                          {canToggle && (
                            <button
                              onClick={() => handleToggleStatus(item)}
                              disabled={isProcessing}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${item.status === "active"
                                  ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/25"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/25"
                                }`}
                              title={item.status === "active" ? "Suspend Access" : "Reactivate Access"}
                            >
                              {isProcessing ? "..." : item.status === "active" ? "Suspend" : "Activate"}
                            </button>
                          )}

                          {item.status !== "expired" && (
                            <button
                              onClick={() => handleRemoveStudent(item)}
                              disabled={isProcessing}
                              className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-[11px]"
                              title="Remove Student from Course"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      <TeacherEnrollStudentModal
        isOpen={isEnrollModalOpen}
        courses={teacherCourses}
        initialCourseId={selectedCourseFilter !== "all" ? selectedCourseFilter : ""}
        onClose={() => setIsEnrollModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* Student Learning Progress Modal */}
      {activeProgressTarget && (
        <TeacherStudentProgressModal
          isOpen={Boolean(activeProgressTarget)}
          courseId={activeProgressTarget.courseId}
          studentId={activeProgressTarget.studentId}
          studentName={activeProgressTarget.studentName}
          courseTitle={activeProgressTarget.courseTitle}
          onClose={() => setActiveProgressTarget(null)}
        />
      )}
    </div>
  );
}
