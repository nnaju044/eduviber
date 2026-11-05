import React, { useState, useEffect, useCallback } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import StatusBadge from "../../components/admin/StatusBadge.jsx";

export default function TeacherProfilePage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [payoutUpiId, setPayoutUpiId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherApi.getProfile();
      if (data) {
        setProfile(data);
        setName(data.name || "");
        setPhone(data.phone || "");
        setHeadline(data.teacherProfile?.headline || "");
        setBio(data.teacherProfile?.bio || "");
        setPayoutUpiId(data.teacherProfile?.payoutUpiId || "");
        setAccountName(data.teacherProfile?.payoutBankDetails?.accountName || "");
        setBankName(data.teacherProfile?.payoutBankDetails?.bankName || "");
        setAccountNumber(data.teacherProfile?.payoutBankDetails?.accountNumber || "");
        setIfscCode(data.teacherProfile?.payoutBankDetails?.ifscCode || "");
      }
    } catch (err) {
      setError(err.message || "Failed to load instructor profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setToastMessage({ type: "error", text: "Display name cannot be empty." });
      return;
    }

    try {
      setSaving(true);
      const updated = await teacherApi.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        payoutUpiId: payoutUpiId.trim(),
        payoutBankDetails: {
          accountName: accountName.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim(),
        },
      });

      setProfile(updated);
      setToastMessage({ type: "success", text: "Profile details updated successfully." });
      refreshUser?.();
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="lg" text="Loading instructor profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
        <p className="text-sm font-bold text-rose-400">Failed to load profile</p>
        <p className="text-xs text-slate-400">{error || "Profile unavailable."}</p>
        <button
          onClick={fetchProfile}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const isApproved = profile.teacherProfile?.isApproved;
  const commissionRate = profile.teacherProfile?.commissionRate ?? 0.20;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Instructor Profile
            </h1>
            <StatusBadge type="approval" status={isApproved ? "approved" : "pending"} />
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your public bio, credentials, contact information, and payout settings
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

      {/* Platform Governance (Read-Only) Info Card */}
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Platform Governance & Royalty Terms</h2>
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            Admin Controlled
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Commission policies and vetting approvals are regulated exclusively by the platform Super Administrator.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 text-[11px] block">Your Revenue Split</span>
            <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5 block">
              {((1 - commissionRate) * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Platform Commission</span>
            <span className="font-mono font-bold text-amber-400 text-sm mt-0.5 block">
              {(commissionRate * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Vetting Approval</span>
            <span className="font-semibold text-slate-300 text-xs mt-0.5 block">
              {isApproved ? "Approved" : "Pending Review"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Registered Email</span>
            <span className="font-mono text-slate-300 text-xs mt-0.5 block truncate">
              {profile.email}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal & Public Bio */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
            Public Instructor Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Display Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Professional Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Senior Lecturer in Mathematics & Quantum Theory"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Displayed below your name on course detail pages</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Biography & Background
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your teaching experience, research credentials, and achievements..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Payout Credentials */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Payout Credentials & Banking Setup</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Designated accounts for receiving your 80% course royalty disbursements
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                UPI ID for Instant Settlement
              </label>
              <input
                type="text"
                value={payoutUpiId}
                onChange={(e) => setPayoutUpiId(e.target.value)}
                placeholder="username@okhdfcbank"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Bank Account Holder Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Name as registered with bank"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Account Number
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Bank account number"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                IFSC Code
              </label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 uppercase"
              />
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10 transition-colors flex items-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" />}
            <span>Save Profile Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
