import React, { useState, useEffect, useCallback, useMemo } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import TeacherStudentProgressModal from "../../components/teacher/TeacherStudentProgressModal.jsx";

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");

  // Progress Modal state
  const [activeProgressTarget, setActiveProgressTarget] = useState(null);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherApi.listStudents();
      setStudents(data || []);
    } catch (err) {
      setError(err.message || "Failed to load student directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Extract unique courses for filtering
  const courseOptions = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      if (s.courseId && s.courseTitle) {
        map.set(s.courseId, s.courseTitle);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [students]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((item) => {
      // Course filter
      if (selectedCourseFilter !== "all" && item.courseId !== selectedCourseFilter) {
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
  }, [students, searchQuery, selectedCourseFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Enrolled Students
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
              {students.length} Enrollments
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Students enrolled in your courses, enrollment verification statuses, and lesson completion rates
          </p>
        </div>

        <button
          onClick={fetchStudents}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-2 self-start sm:self-auto"
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

        {/* Course Filter Dropdown */}
        {courseOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-semibold whitespace-nowrap">Filter Course:</label>
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
      </div>

      {/* Main Table / State View */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-slate-900/20 rounded-2xl border border-slate-800">
          <LoadingSpinner size="lg" text="Loading student directory..." />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm font-bold text-rose-400">Failed to load enrolled students</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchStudents}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/20 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-300">No student enrollments found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedCourseFilter !== "all"
              ? "No enrollments matched your search or course filter. Try clearing filters."
              : "When students purchase your courses, their verified enrollments and progress will appear here."}
          </p>
          {(searchQuery || selectedCourseFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCourseFilter("all");
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
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Course Enrolled</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Enrolled Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.map((item) => (
                  <tr
                    key={item.enrollmentId}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Student */}
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
                      <button
                        onClick={() =>
                          setActiveProgressTarget({
                            courseId: item.courseId,
                            studentId: item.student?.id,
                            studentName: item.student?.name,
                            courseTitle: item.courseTitle,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 font-semibold text-[11px] transition-colors"
                      >
                        Inspect Progress
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
