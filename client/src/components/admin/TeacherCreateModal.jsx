import React, { useState } from "react";
import { adminApi } from "../../api/adminApi.js";

export default function TeacherCreateModal({ isOpen, onClose, onSuccess, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [commissionRate, setCommissionRate] = useState(0.20);
  const [isApproved, setIsApproved] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage("");

    if (!name || name.trim().length < 2) {
      setErrorMessage("Instructor name must be at least 2 characters.");
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!phone || phone.trim().length < 6) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }
    if (!password || password.length < 12) {
      setErrorMessage("Temporary password must be at least 12 characters long.");
      return;
    }

    let newTeacher = null;
    try {
      setIsSubmitting(true);
      newTeacher = await adminApi.createTeacher({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: password.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        commissionRate: parseFloat(commissionRate) || 0.20,
        isApproved,
      });
    } catch (err) {
      setIsSubmitting(false);
      // Specific handling for 409 Conflict / duplicate email
      if (err.status === 409 || err.code === "EMAIL_COLLISION" || err.message?.toLowerCase().includes("already exists")) {
        setErrorMessage("An account with this email address already exists. Please choose a different email or search the directory.");
      } else {
        setErrorMessage(err.message || "Failed to create teacher account.");
      }
      return;
    }

    // Server confirmed creation! Isolate post-creation callbacks so UI refresh failures never show a false creation error.
    try {
      if (typeof onSuccess === "function") {
        onSuccess(newTeacher);
      } else if (typeof onCreated === "function") {
        onCreated(newTeacher);
      }
    } catch (callbackErr) {
      console.warn("[TeacherCreateModal] Post-creation callback error:", callbackErr);
    } finally {
      setIsSubmitting(false);
      if (typeof onClose === "function") {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white">Provision Teacher Account</h3>
            <p className="text-xs text-slate-400 mt-0.5">Create a new instructor credential on EduVibe</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Jane Smith"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-300">Temporary Password *</label>
              <span className="text-[10px] text-slate-500">Min. 12 characters</span>
            </div>
            <input
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Machine Learning Engineer"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Platform Commission Fee</label>
              <select
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:border-amber-500 outline-none"
              >
                <option value={0.20}>20% Platform Fee (80% Teacher Share)</option>
                <option value={0.15}>15% Platform Fee (85% Teacher Share)</option>
                <option value={0.25}>25% Platform Fee (75% Teacher Share)</option>
                <option value={0.10}>10% Platform Fee (90% Teacher Share)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short instructor biography..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isApproved"
              checked={isApproved}
              onChange={(e) => setIsApproved(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="isApproved" className="text-slate-300 font-medium cursor-pointer">
              Approve account immediately (allows publishing courses immediately)
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting && (
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              )}
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
