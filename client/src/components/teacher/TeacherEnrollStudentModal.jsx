import React, { useState, useEffect } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import LoadingSpinner from "../LoadingSpinner.jsx";

export default function TeacherEnrollStudentModal({
  isOpen,
  courses = [],
  initialCourseId = "",
  onClose,
  onSuccess,
}) {
  const [activeTab, setActiveTab] = useState("existing"); // 'existing' | 'new'
  const [selectedCourseId, setSelectedCourseId] = useState("");

  // Existing student form
  const [existingEmail, setExistingEmail] = useState("");

  // New student form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successResult, setSuccessResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessResult(null);
      setCopied(false);
      setExistingEmail("");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      if (initialCourseId) {
        setSelectedCourseId(initialCourseId);
      } else if (courses.length > 0) {
        setSelectedCourseId(courses[0].id || courses[0]._id || "");
      }
    }
  }, [isOpen, initialCourseId, courses]);

  if (!isOpen) return null;

  const selectedCourse = courses.find((c) => (c.id || c._id) === selectedCourseId);
  const isPaid = selectedCourse ? Number(selectedCourse.price) > 0 : false;

  // Handle Tab 1: Enroll Existing Student
  const handleEnrollExisting = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setError("Please select a course to enroll the student into.");
      return;
    }
    if (!existingEmail.trim()) {
      setError("Please enter the student's email address.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const res = await teacherApi.enrollExistingStudent(selectedCourseId, existingEmail.trim());
      setSuccessResult({
        type: "existing",
        isFree: res?.isFree ?? !isPaid,
        studentName: res?.enrollment?.student?.name || existingEmail,
        studentEmail: res?.enrollment?.student?.email || existingEmail,
        courseTitle: res?.enrollment?.courseTitle || selectedCourse?.title || "Selected Course",
        message: res?.message || "Student was successfully enrolled with immediate active access.",
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Failed to enroll existing student.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Tab 2: Create & Enroll New Student
  const handleCreateAndEnroll = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setError("Please select a course for the new student.");
      return;
    }
    if (!newName.trim() || newName.trim().length < 2) {
      setError("Please enter a valid student name (at least 2 characters).");
      return;
    }
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    const cleanPhone = newPhone.trim();
    const phoneDigits = cleanPhone.replace(/\D/g, "");
    if (!cleanPhone || phoneDigits.length < 7) {
      setError("Please provide a valid phone number (at least 7 digits) to use as the student's initial temporary password.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const res = await teacherApi.createAndEnrollStudent(selectedCourseId, {
        name: newName.trim(),
        email: newEmail.trim(),
        phone: cleanPhone,
      });

      setSuccessResult({
        type: "new",
        isFree: res?.isFree ?? !isPaid,
        studentName: res?.student?.name || newName,
        studentEmail: res?.student?.email || newEmail,
        studentPhone: res?.student?.phone || cleanPhone,
        courseTitle: res?.enrollment?.courseTitle || selectedCourse?.title || "Selected Course",
        message: res?.message || "Student account created with active course access.",
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Failed to create student account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    const textToCopy = successResult?.studentPhone || successResult?.temporaryPassword;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleModalClose = () => {
    setSuccessResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {successResult ? "Student Enrollment Result" : "Enroll Student to Course"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {successResult
                ? "Enrollment successfully recorded in your class roster"
                : "Add an existing EduVibe student or provision a new student account"}
            </p>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="space-y-5">
            <div
              className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">✓</span>
                <div>
                  <h4 className="font-bold text-sm">
                    Enrollment Active
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed">{successResult.message}</p>
                </div>
              </div>
            </div>

            {/* Student & Course Summary */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <span className="font-semibold text-slate-200">{successResult.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="font-mono text-slate-300">{successResult.studentEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Course:</span>
                <span className="font-semibold text-amber-400">{successResult.courseTitle}</span>
              </div>
            </div>

            {/* Credentials / Initial Password for New Accounts */}
            {successResult.type === "new" && (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Initial Credentials
                  </span>
                  <span className="text-[11px] text-amber-300/70 font-semibold">Change required on first login</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 text-[11px]">Login Email</label>
                    <div className="font-mono text-slate-200 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      {successResult.studentEmail}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px]">
                      Initial Password <span className="text-amber-400 font-semibold">(Student's Phone Number)</span>
                    </label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="text"
                        readOnly
                        value={successResult.studentPhone || successResult.temporaryPassword}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-300 font-mono text-sm tracking-wide select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                      >
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed space-y-1">
                  <p className="font-semibold">⚠️ Important Security Requirement:</p>
                  <p>
                    The student must log in at <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">/app/login</code> using this phone number.
                    For security, the student will be forced to change this temporary password immediately after their first login before accessing their learning dashboard.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleModalClose}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("existing");
                  setError("");
                }}
                className={`py-2 rounded-lg transition-colors text-center ${activeTab === "existing"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                Existing Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("new");
                  setError("");
                }}
                className={`py-2 rounded-lg transition-colors text-center ${activeTab === "new"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                Create New Student
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
                <span className="text-sm">✕</span>
                <span>{error}</span>
              </div>
            )}

            {/* Course Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Select Course <span className="text-amber-400">*</span>
              </label>
              {courses.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-slate-500 text-xs">
                  No owned courses found. Please create a course first.
                </div>
              ) : (
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {courses.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.title} — {Number(c.price) === 0 ? "Free Course" : `Paid (₹${c.price})`}
                    </option>
                  ))}
                </select>
              )}
              {isPaid && (
                <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5 mt-1">
                  <span>ℹ️</span> Paid course: Student access is granted immediately. Financial tracking record will be submitted to Super Admin.
                </p>
              )}
            </div>

            {/* Workflow A: Existing Student */}
            {activeTab === "existing" && (
              <form onSubmit={handleEnrollExisting} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Student Email Address <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={existingEmail}
                    onChange={(e) => setExistingEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                  />
                  <p className="text-[11px] text-slate-400">
                    The student must already have a registered EduVibe account.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !courses.length}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    {submitting && <LoadingSpinner size="sm" />}
                    <span>Enroll Student</span>
                  </button>
                </div>
              </form>
            )}

            {/* Workflow B: Create New Student */}
            {activeTab === "new" && (
              <form onSubmit={handleCreateAndEnroll} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Full Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Email Address <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Phone Number <span className="text-amber-400">*</span>
                    <span className="text-slate-500 font-normal ml-1.5">(Used as initial temporary password)</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                  />
                  <p className="text-[11px] text-slate-400">
                    Minimum 7 digits. This phone number will be hashed as the student's initial temporary password.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">Security & Authentication:</p>
                  <p>• The student's phone number serves as their temporary password upon initial setup.</p>
                  <p>• The student is strictly required to change this password immediately upon their first login.</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !courses.length}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    {submitting && <LoadingSpinner size="sm" />}
                    <span>Create & Enroll</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
