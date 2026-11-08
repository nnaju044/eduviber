import React, { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../api/adminApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import StudentDetailModal from "../../components/admin/StudentDetailModal.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Student details modal state
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch student directory
  const fetchStudents = useCallback(async (page = 1, query = "") => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.listStudents({ page, limit: 20, q: query });
      setStudents(data.students || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (err) {
      setError(err.message || "Failed to load student directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents(1, debouncedQuery);
  }, [debouncedQuery, fetchStudents]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchStudents(newPage, debouncedQuery);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Student Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
              {pagination.total} Learners
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Student community directory, enrollment histories, and authorization status overrides
          </p>
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

      {/* Search Bar Toolbar */}
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
            placeholder="Search by student name, email, or phone..."
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

        <div className="text-xs text-slate-400">
          Showing page <span className="text-white font-semibold">{pagination.page}</span> of{" "}
          <span className="text-white font-semibold">{pagination.totalPages || 1}</span>
        </div>
      </div>

      {/* Main Table / State View */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-slate-900/20 rounded-2xl border border-slate-800">
          <LoadingSpinner size="lg" text="Loading student directory..." />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm font-bold text-rose-400">Failed to load student directory</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchStudents(pagination.page, debouncedQuery)}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/20 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-300">No students found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {debouncedQuery
              ? "No student records matched your search query. Try clearing the search term."
              : "No students have registered on the platform yet."}
          </p>
          {debouncedQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4 text-center">Active Enrollments</th>
                    <th className="py-3.5 px-4 text-center">Account Status</th>
                    <th className="py-3.5 px-4">Registration Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-700">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                              {student.name}
                            </p>
                            <span className="text-[11px] text-slate-500 font-mono">ID: {student.id.slice(-6)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <p className="text-slate-300 font-mono text-[11px]">{student.email}</p>
                        {student.phone && (
                          <p className="text-slate-500 text-[11px]">{student.phone}</p>
                        )}
                      </td>

                      {/* Active Enrollments */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono font-bold text-[11px] border border-emerald-500/20">
                          {student.activeEnrollmentCount} Active
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge type="active" status={student.isActive ? "active" : "suspended"} />
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "N/A"}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedStudentId(student.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition-colors"
                          title="Inspect student enrollments and update access"
                        >
                          Dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
              <span className="text-slate-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-semibold transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-semibold transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudentId && (
        <StudentDetailModal
          isOpen={Boolean(selectedStudentId)}
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          onEnrollmentUpdated={(enrollmentId, newStatus) => {
            setToastMessage({
              type: "success",
              text: `Enrollment status updated to "${newStatus}".`,
            });
            fetchStudents(pagination.page, debouncedQuery);
          }}
        />
      )}
    </div>
  );
}
