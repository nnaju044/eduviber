import React, { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "../../api/adminApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import ConfirmModal from "../../components/admin/ConfirmModal.jsx";
import TeacherCreateModal from "../../components/admin/TeacherCreateModal.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'approved', 'pending', 'active', 'suspended'

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null); // for details drawer
  const [teacherDetailsLoading, setTeacherDetailsLoading] = useState(false);
  const [teacherCourses, setTeacherCourses] = useState([]);

  // Confirmation modals state
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve' | 'toggle-status', teacher: obj }
  const [actionInProgress, setActionInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch teacher list
  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.listTeachers();
      setTeachers(data);
    } catch (err) {
      setError(err.message || "Failed to load instructor accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // View teacher details drawer
  const handleViewDetails = async (teacher) => {
    setSelectedTeacher(teacher);
    setTeacherCourses([]);
    setTeacherDetailsLoading(true);
    try {
      const data = await adminApi.getTeacher(teacher.id);
      if (data) {
        setSelectedTeacher(data.teacher);
        setTeacherCourses(data.courses || []);
      }
    } catch (err) {
      console.error("Failed to load teacher details:", err);
    } finally {
      setTeacherDetailsLoading(false);
    }
  };

  // Close drawer
  const closeDetails = () => {
    setSelectedTeacher(null);
    setTeacherCourses([]);
  };

  // Handle Approve action
  const handleApprove = async () => {
    if (!confirmAction || confirmAction.type !== "approve") return;
    const { teacher } = confirmAction;
    try {
      setActionInProgress(true);
      await adminApi.approveTeacher(teacher.id);
      setToastMessage({ type: "success", text: `Teacher "${teacher.name}" approved successfully.` });
      setConfirmAction(null);
      await fetchTeachers();
      if (selectedTeacher && selectedTeacher.id === teacher.id) {
        setSelectedTeacher((prev) => ({ ...prev, isApproved: true }));
      }
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to approve teacher." });
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle Toggle Status (suspend / reactivate)
  const handleToggleStatus = async () => {
    if (!confirmAction || confirmAction.type !== "toggle-status") return;
    const { teacher } = confirmAction;
    const willSuspend = teacher.isActive;
    try {
      setActionInProgress(true);
      await adminApi.toggleTeacherStatus(teacher.id);
      setToastMessage({
        type: "success",
        text: `Teacher "${teacher.name}" ${willSuspend ? "suspended" : "reactivated"} successfully.`,
      });
      setConfirmAction(null);
      await fetchTeachers();
      if (selectedTeacher && selectedTeacher.id === teacher.id) {
        setSelectedTeacher((prev) => ({ ...prev, isActive: !willSuspend }));
      }
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to update teacher status." });
    } finally {
      setActionInProgress(false);
    }
  };

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // Status filter
      if (statusFilter === "approved" && !t.isApproved) return false;
      if (statusFilter === "pending" && t.isApproved) return false;
      if (statusFilter === "active" && !t.isActive) return false;
      if (statusFilter === "suspended" && t.isActive) return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.phone && t.phone.toLowerCase().includes(q)) ||
        (t.headline && t.headline.toLowerCase().includes(q))
      );
    });
  }, [teachers, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Teacher Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
              {teachers.length} Instructors
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Provision instructor accounts, review onboarding applications, and regulate curriculum authoring privileges
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
            <span>Provision Instructor</span>
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
            placeholder="Search by instructor name, email, or headline..."
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
            { id: "all", label: "All Teachers" },
            { id: "pending", label: "Pending Approvals" },
            { id: "approved", label: "Approved" },
            { id: "active", label: "Active" },
            { id: "suspended", label: "Suspended" },
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
          <LoadingSpinner size="lg" text="Loading instructors catalog..." />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm font-bold text-rose-400">Failed to load instructor records</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchTeachers}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/20 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-300">No instructors found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "No instructor matches your active search or filter criteria. Try clearing filters."
              : "No teacher accounts exist yet. Provision the first instructor to get started."}
          </p>
          {(searchQuery || statusFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
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
                  <th className="py-3.5 px-4">Instructor</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4 text-center">Vetting Status</th>
                  <th className="py-3.5 px-4 text-center">Account</th>
                  <th className="py-3.5 px-4 text-center">Commission</th>
                  <th className="py-3.5 px-4 text-center">Courses</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTeachers.map((teacher) => (
                  <tr
                    key={teacher.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Name & Headline */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {teacher.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                            {teacher.name}
                          </p>
                          {teacher.headline && (
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">
                              {teacher.headline}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-300 font-mono text-[11px]">{teacher.email}</p>
                      {teacher.phone && (
                        <p className="text-slate-500 text-[11px]">{teacher.phone}</p>
                      )}
                    </td>

                    {/* Vetting Status */}
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge type="approval" status={teacher.isApproved ? "approved" : "pending"} />
                    </td>

                    {/* Active Status */}
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge type="active" status={teacher.isActive ? "active" : "suspended"} />
                    </td>

                    {/* Commission Rate */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-300">
                      {(teacher.commissionRate * 100).toFixed(0)}%
                    </td>

                    {/* Courses Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-semibold text-[11px]">
                        {teacher.courseCount}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details Drawer */}
                        <button
                          onClick={() => handleViewDetails(teacher)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition-colors"
                          title="Inspect instructor profile and authored courses"
                        >
                          Dossier
                        </button>

                        {/* Approve Button (if pending) */}
                        {!teacher.isApproved && (
                          <button
                            onClick={() => setConfirmAction({ type: "approve", teacher })}
                            className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px] transition-colors"
                            title="Approve onboarding application"
                          >
                            Approve
                          </button>
                        )}

                        {/* Suspend / Reactivate Button */}
                        <button
                          onClick={() => setConfirmAction({ type: "toggle-status", teacher })}
                          className={`px-2.5 py-1 rounded border font-semibold text-[11px] transition-colors ${
                            teacher.isActive
                              ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/25"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/25"
                          }`}
                          title={teacher.isActive ? "Suspend instructor account" : "Reactivate instructor account"}
                        >
                          {teacher.isActive ? "Suspend" : "Reactivate"}
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

      {/* Teacher Profile & Courses Drawer Modal */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 min-h-screen p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Instructor Dossier</h2>
                  <p className="text-xs text-slate-400">Account overview and curriculum footprint</p>
                </div>
                <button
                  onClick={closeDetails}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Teacher Info Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedTeacher.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{selectedTeacher.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge type="approval" status={selectedTeacher.isApproved ? "approved" : "pending"} />
                    <StatusBadge type="active" status={selectedTeacher.isActive ? "active" : "suspended"} />
                  </div>
                </div>

                {selectedTeacher.teacherProfile?.headline && (
                  <p className="text-xs text-amber-400 font-medium italic">
                    "{selectedTeacher.teacherProfile.headline}"
                  </p>
                )}

                {selectedTeacher.teacherProfile?.bio && (
                  <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2">
                    {selectedTeacher.teacherProfile.bio}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500">Platform Commission:</span>{" "}
                    <span className="font-bold text-amber-400">
                      {((selectedTeacher.teacherProfile?.commissionRate ?? selectedTeacher.commissionRate ?? 0.20) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Teacher Payout Split:</span>{" "}
                    <span className="font-bold text-emerald-400">
                      {(100 - (selectedTeacher.teacherProfile?.commissionRate ?? selectedTeacher.commissionRate ?? 0.20) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Joined:</span>{" "}
                    <span className="text-slate-300">
                      {selectedTeacher.createdAt ? new Date(selectedTeacher.createdAt).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Phone:</span>{" "}
                    <span className="text-slate-300">{selectedTeacher.phone || "None registered"}</span>
                  </div>
                </div>
              </div>

              {/* Authored Courses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Authored Courses ({teacherCourses.length})
                  </h4>
                  {teacherDetailsLoading && (
                    <span className="text-[11px] text-slate-500 animate-pulse">Syncing...</span>
                  )}
                </div>

                {teacherCourses.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 rounded-lg bg-slate-950/40 border border-dashed border-slate-800 text-center">
                    No courses authored by this instructor yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {teacherCourses.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-200">{c.title}</p>
                          <p className="text-[11px] font-mono text-slate-500">
                            /{c.slug} • ₹{c.price}
                          </p>
                        </div>
                        <StatusBadge
                          type="publication"
                          status={c.isPublished ? "published" : "draft"}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={closeDetails}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Close Dossier
              </button>

              <div className="flex items-center gap-2">
                {!selectedTeacher.isApproved && (
                  <button
                    onClick={() => setConfirmAction({ type: "approve", teacher: selectedTeacher })}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    Approve Instructor
                  </button>
                )}
                <button
                  onClick={() => setConfirmAction({ type: "toggle-status", teacher: selectedTeacher })}
                  className={`px-3.5 py-2 rounded-lg font-bold text-xs ${
                    selectedTeacher.isActive
                      ? "bg-rose-600 hover:bg-rose-500 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {selectedTeacher.isActive ? "Suspend Account" : "Reactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provision Instructor Modal */}
      {showCreateModal && (
        <TeacherCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(created) => {
            setShowCreateModal(false);
            setToastMessage({
              type: "success",
              text: `Instructor account "${created?.name || "New Instructor"}" created successfully.`,
            });
            try {
              fetchTeachers();
            } catch (refreshErr) {
              console.warn("[TeachersPage] Error refreshing teachers directory:", refreshErr);
            }
          }}
        />
      )}

      {/* Confirmation Modal: Approve */}
      {confirmAction?.type === "approve" && (
        <ConfirmModal
          isOpen={true}
          title="Confirm Teacher Approval"
          message={`Are you sure you want to approve "${confirmAction.teacher.name}"? This authorizes the instructor to create and manage courses on the platform.`}
          confirmText="Approve Teacher"
          confirmVariant="emerald"
          loading={actionInProgress}
          onConfirm={handleApprove}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Confirmation Modal: Toggle Status */}
      {confirmAction?.type === "toggle-status" && (
        <ConfirmModal
          isOpen={true}
          title={confirmAction.teacher.isActive ? "Confirm Account Suspension" : "Confirm Account Reactivation"}
          message={
            confirmAction.teacher.isActive
              ? `Are you sure you want to suspend "${confirmAction.teacher.name}"? The instructor will be unable to log in, author courses, or receive payouts until reactivated.`
              : `Are you sure you want to reactivate "${confirmAction.teacher.name}"? The instructor will regain access to their studio dashboard.`
          }
          confirmText={confirmAction.teacher.isActive ? "Suspend Instructor" : "Reactivate Instructor"}
          confirmVariant={confirmAction.teacher.isActive ? "rose" : "emerald"}
          loading={actionInProgress}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
