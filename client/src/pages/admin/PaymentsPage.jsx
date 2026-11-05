import React, { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "../../api/adminApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import PaymentDetailModal from "../../components/admin/PaymentDetailModal.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending"); // default to pending queue

  // Modal state
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch payments list
  const fetchPayments = useCallback(async (filter) => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.listPayments(filter);
      setPayments(data || []);
    } catch (err) {
      setError(err.message || "Failed to load payment queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments(statusFilter);
  }, [statusFilter, fetchPayments]);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return payments;
    const q = searchQuery.toLowerCase();
    return payments.filter((p) => {
      const studentName = p.student ? p.student.name.toLowerCase() : "";
      const studentEmail = p.student ? p.student.email.toLowerCase() : "";
      const courseTitle = p.course ? p.course.title.toLowerCase() : "";
      const txRef = p.transactionReference ? p.transactionReference.toLowerCase() : "";
      return (
        studentName.includes(q) ||
        studentEmail.includes(q) ||
        courseTitle.includes(q) ||
        txRef.includes(q)
      );
    });
  }, [payments, searchQuery]);

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Payment Settlements & Audits
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
              {payments.length} Transactions
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manual transfer verification queue, receipt proof checks, and server-calculated financial snapshot settlements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPayments(statusFilter)}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-2"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Queue</span>
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

      {/* Search and Status Tabs Toolbar */}
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
            placeholder="Search by student, course title, or transaction ref..."
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

        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "pending", label: "Pending Verification", count: statusFilter === "pending" ? filteredPayments.length : null },
            { id: "approved", label: "Approved Settlements" },
            { id: "rejected", label: "Rejected" },
            { id: "all", label: "All Transactions" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === "pending" && statusFilter !== "pending" && pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / State View */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-slate-900/20 rounded-2xl border border-slate-800">
          <LoadingSpinner size="lg" text="Loading payment queue..." />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm font-bold text-rose-400">Failed to load payments</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchPayments(statusFilter)}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/20 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-300">No payment records found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? "No payments match your search query."
              : statusFilter === "pending"
              ? "All manual payment verifications are up to date! Great job."
              : `No payments currently in status "${statusFilter}".`}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Clear Search
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
                  <th className="py-3.5 px-4">Course & Ownership</th>
                  <th className="py-3.5 px-4 text-center">Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Transaction Ref</th>
                  <th className="py-3.5 px-4">Submitted Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Student */}
                    <td className="py-3.5 px-4">
                      {payment.student ? (
                        <div>
                          <p className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                            {payment.student.name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">{payment.student.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Deleted User</span>
                      )}
                    </td>

                    {/* Course & Owner */}
                    <td className="py-3.5 px-4">
                      {payment.course ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-200">{payment.course.title}</p>
                          <StatusBadge type="ownership" owner={payment.owner} />
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Deleted Course</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400 text-sm">
                      ₹{payment.amount}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge type="payment" status={payment.status} />
                    </td>

                    {/* Transaction Reference */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-300 text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {payment.transactionReference || "N/A"}
                      </span>
                    </td>

                    {/* Submitted Date */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "N/A"}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedPaymentId(payment.id)}
                        className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors ${
                          payment.status === "pending"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                        }`}
                        title="Review payment proof and server financial snapshot"
                      >
                        {payment.status === "pending" ? "Review & Verify" : "Audit Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Detail & Review Modal */}
      {selectedPaymentId && (
        <PaymentDetailModal
          isOpen={Boolean(selectedPaymentId)}
          paymentId={selectedPaymentId}
          onClose={() => setSelectedPaymentId(null)}
          onPaymentApproved={(approvedRecord) => {
            setToastMessage({
              type: "success",
              text: `Payment approved! Server financial snapshot calculated and course enrollment activated.`,
            });
            fetchPayments(statusFilter);
          }}
          onPaymentRejected={(rejectedRecord) => {
            setToastMessage({
              type: "success",
              text: `Payment marked as rejected. Student will be notified.`,
            });
            fetchPayments(statusFilter);
          }}
        />
      )}
    </div>
  );
}
