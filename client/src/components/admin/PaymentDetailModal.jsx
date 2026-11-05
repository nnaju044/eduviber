import React, { useState, useEffect } from "react";
import { adminApi } from "../../api/adminApi.js";
import StatusBadge from "./StatusBadge.jsx";
import LoadingSpinner from "../LoadingSpinner.jsx";

export default function PaymentDetailModal({
  isOpen,
  paymentId,
  onClose,
  onPaymentApproved,
  onPaymentRejected,
}) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!isOpen || !paymentId) return;

    let mounted = true;
    async function loadPayment() {
      try {
        setLoading(true);
        setError(null);
        setShowRejectInput(false);
        setRejectionReason("");
        setActionError("");
        const res = await adminApi.getPayment(paymentId);
        if (mounted) setPayment(res);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load payment record.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPayment();
    return () => {
      mounted = false;
    };
  }, [isOpen, paymentId]);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (isApproving || isRejecting) return;
    setActionError("");

    const confirmed = window.confirm(
      `Confirm payment approval for ₹${payment.amount} submitted by ${payment.student?.name || "Student"}?\nThis will calculate server financial snapshot and immediately activate course enrollment.`
    );
    if (!confirmed) return;

    try {
      setIsApproving(true);
      const res = await adminApi.approvePayment(paymentId);
      setPayment((prev) => ({
        ...prev,
        status: "approved",
        financialSnapshot: res.payment?.financialSnapshot || prev.financialSnapshot,
        reviewedAt: res.payment?.reviewedAt || new Date().toISOString(),
      }));
      if (onPaymentApproved) onPaymentApproved(res.payment);
    } catch (err) {
      setActionError(err.message || "Approval failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (isApproving || isRejecting) return;
    if (!rejectionReason.trim()) {
      setActionError("Please provide a rejection reason for the student.");
      return;
    }
    setActionError("");

    try {
      setIsRejecting(true);
      const rejectedPayment = await adminApi.rejectPayment(paymentId, rejectionReason.trim());
      setPayment((prev) => ({
        ...prev,
        status: "rejected",
        rejectionReason: rejectedPayment.rejectionReason,
        reviewedAt: rejectedPayment.reviewedAt,
      }));
      setShowRejectInput(false);
      if (onPaymentRejected) onPaymentRejected(rejectedPayment);
    } catch (err) {
      setActionError(err.message || "Rejection failed.");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">Manual Payment Verification</h3>
              {payment && <StatusBadge type="payment" value={payment.status} />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Authoritative settlement and enrollment activation</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {actionError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="py-12">
            <LoadingSpinner text="Retrieving payment verification record..." />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
            {error}
          </div>
        ) : payment ? (
          <div className="space-y-4 text-xs">
            {/* Payment Details Grid */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-slate-500">Student</p>
                <p className="font-semibold text-slate-200 mt-0.5">{payment.student?.name || "—"}</p>
                <p className="text-[11px] text-slate-400">{payment.student?.email}</p>
              </div>
              <div>
                <p className="text-slate-500">Course</p>
                <p className="font-semibold text-slate-200 mt-0.5">{payment.course?.title || "—"}</p>
                <p className="text-[11px] text-slate-400">Listed Price: ₹{payment.course?.price || 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Submitted Amount</p>
                <p className="text-lg font-extrabold text-amber-400 mt-0.5">₹{payment.amount}</p>
                <p className="text-[10px] text-slate-500 font-mono">Ref: {payment.transactionReference || "None"}</p>
              </div>
              <div>
                <p className="text-slate-500">Course Owner</p>
                <p className="font-semibold text-slate-200 mt-0.5">
                  {payment.owner?.name ? `${payment.owner.name} (${payment.owner.role})` : "Platform Owned"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Submitted At</p>
                <p className="font-semibold text-slate-200 mt-0.5">
                  {payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Reviewed At</p>
                <p className="font-semibold text-slate-200 mt-0.5">
                  {payment.reviewedAt ? new Date(payment.reviewedAt).toLocaleString() : "Pending"}
                </p>
              </div>
            </div>

            {/* Proof of Payment Preview */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
              <p className="font-semibold text-slate-300 mb-2">Payment Transfer Proof</p>
              {payment.proofUrl ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <a
                    href={payment.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group relative overflow-hidden rounded-lg border border-slate-700 w-36 h-28 bg-slate-900"
                  >
                    <img
                      src={payment.proofUrl}
                      alt="Payment Receipt Proof"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition-opacity">
                      Open Full Image ↗
                    </div>
                  </a>
                  <div className="space-y-1">
                    <p className="text-slate-300 font-medium">Uploaded Receipt / Screenshot</p>
                    <p className="text-[11px] text-slate-500">
                      Verify the UPI reference or transaction ID in your bank statement.
                    </p>
                    <a
                      href={payment.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs font-semibold mt-1"
                    >
                      <span>Open Full Resolution Receipt</span>
                      <span>↗</span>
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  No screenshot proof attached. Verified via reference ID: {payment.transactionReference || "N/A"}.
                </p>
              )}
            </div>

            {/* Authoritative Financial Snapshot if Approved */}
            {payment.status === "approved" && payment.financialSnapshot && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-emerald-400">Authoritative Financial Snapshot (Immutable)</p>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded">
                    Server Calculated
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <p className="text-slate-400">Final Price</p>
                    <p className="font-bold text-slate-200">₹{payment.financialSnapshot.coursePrice}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Commission Rate</p>
                    <p className="font-bold text-slate-200">
                      {(payment.financialSnapshot.commissionRate * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Platform Share</p>
                    <p className="font-bold text-amber-400">₹{payment.financialSnapshot.platformShare}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Teacher Share</p>
                    <p className="font-bold text-emerald-400">₹{payment.financialSnapshot.teacherShare}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection Details if Rejected */}
            {payment.status === "rejected" && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                <p className="font-bold text-rose-400">Payment Rejected</p>
                <p className="text-slate-300">
                  Reason provided to student: <span className="italic font-medium">{payment.rejectionReason || "Unspecified"}</span>
                </p>
              </div>
            )}

            {/* Reject Reason Input Form */}
            {showRejectInput && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-3">
                <label className="block font-semibold text-rose-300">
                  Specify Rejection Reason (Notified to Student) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Transaction ID was not found in bank records. Please verify the amount and resubmit."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-rose-500 outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    disabled={isRejecting}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isRejecting}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isRejecting && (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    <span>Confirm Rejection</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="pt-3 flex items-center justify-between border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            Close
          </button>

          {payment && payment.status === "pending" && !showRejectInput && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRejectInput(true)}
                disabled={isApproving || isRejecting}
                className="px-4 py-2 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Reject Payment...
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {isApproving && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Approve & Activate Enrollment</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
