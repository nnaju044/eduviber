import React, { useState, useEffect } from "react";
import { adminApi } from "../../api/adminApi.js";
import StatusBadge from "./StatusBadge.jsx";
import LoadingSpinner from "../LoadingSpinner.jsx";

export default function StudentDetailModal({ isOpen, studentId, onClose, onEnrollmentUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (!isOpen || !studentId) return;

    let mounted = true;
    async function loadStudent() {
      try {
        setLoading(true);
        setError(null);
        const result = await adminApi.getStudent(studentId);
        if (mounted) {
          setData(result);
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load student details.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStudent();
    return () => {
      mounted = false;
    };
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  const handleStatusChange = async (enrollmentId, newStatus) => {
    try {
      setUpdatingId(enrollmentId);
      const updated = await adminApi.updateEnrollmentStatus(enrollmentId, newStatus);
      setData((prev) => ({
        ...prev,
        enrollments: prev.enrollments.map((e) =>
          e.id === enrollmentId ? { ...e, status: updated.status } : e
        ),
      }));
      if (onEnrollmentUpdated) onEnrollmentUpdated(enrollmentId, newStatus);
    } catch (err) {
      alert(`Failed to update enrollment status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white">Student Enrollment Dossier</h3>
            <p className="text-xs text-slate-400 mt-0.5">Profile inspection and course enrollment management</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12">
            <LoadingSpinner text="Retrieving student profile & enrollments..." />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-5 text-xs">
            {/* Student Info Card */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-slate-500">Full Name</p>
                <p className="font-semibold text-slate-200 mt-0.5">{data.student.name}</p>
              </div>
              <div>
                <p className="text-slate-500">Email Address</p>
                <p className="font-semibold text-slate-200 mt-0.5 truncate">{data.student.email}</p>
              </div>
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-semibold text-slate-200 mt-0.5">{data.student.phone || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Account Status</p>
                <div className="mt-1">
                  <StatusBadge type="active" value={data.student.isActive} />
                </div>
              </div>
            </div>

            {/* Enrollments Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-200 text-sm">Course Enrollments</h4>
                <span className="text-slate-500 text-[11px]">
                  {data.enrollments?.length || 0} Total Records
                </span>
              </div>

              {data.enrollments?.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-slate-500">
                  This student is not currently enrolled in any courses.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Course Title</th>
                        <th className="py-2.5 px-3 font-semibold">Price</th>
                        <th className="py-2.5 px-3 font-semibold">Current Status</th>
                        <th className="py-2.5 px-3 font-semibold">Enrolled Date</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Modify Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {data.enrollments.map((enr) => (
                        <tr key={enr.id} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-medium text-slate-200 max-w-[180px] truncate">
                            {enr.course?.title || "Untitled Course"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            ₹{enr.course?.price || 0}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge type="enrollment" value={enr.status} />
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {enr.createdAt ? new Date(enr.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <select
                              value={enr.status}
                              disabled={updatingId === enr.id}
                              onChange={(e) => handleStatusChange(enr.id, e.target.value)}
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:border-amber-500 outline-none disabled:opacity-50"
                            >
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="suspended">Suspended</option>
                              <option value="expired">Expired</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="pt-3 flex items-center justify-end border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
