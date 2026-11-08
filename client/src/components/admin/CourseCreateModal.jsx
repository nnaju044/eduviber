import React, { useState } from "react";
import { adminApi } from "../../api/adminApi.js";

export default function CourseCreateModal({ isOpen, teachers = [], onClose, onSuccess, onCreated }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [instructor, setInstructor] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage("");

    if (!title || title.trim().length < 3) {
      setErrorMessage("Course title must be at least 3 characters.");
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMessage("Please enter a valid price (0 or greater).");
      return;
    }

    let newCourse = null;
    try {
      setIsSubmitting(true);
      newCourse = await adminApi.createCourse({
        title: title.trim(),
        price: numPrice,
        instructor: instructor.trim() || undefined,
        description: description.trim(),
        thumbnail: thumbnail.trim(),
        customSlug: customSlug.trim() || undefined,
        ownerId: ownerId || undefined,
      });
    } catch (err) {
      setIsSubmitting(false);
      // Handle duplicate slug specifically (HTTP 409 / SLUG_CONFLICT)
      if (err.status === 409 || err.code === "SLUG_CONFLICT" || err.message?.toLowerCase().includes("slug")) {
        setErrorMessage("A course with this URL slug already exists. Please choose a different custom slug or leave it blank.");
      } else {
        setErrorMessage(err.message || "Failed to create course.");
      }
      return;
    }

    // Server confirmed creation! Isolate post-creation callbacks so UI refresh failures never report a false creation error.
    try {
      if (typeof onSuccess === "function") {
        onSuccess(newCourse);
      } else if (typeof onCreated === "function") {
        onCreated(newCourse);
      }
    } catch (callbackErr) {
      console.warn("[CourseCreateModal] Post-creation callback error:", callbackErr);
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
            <h3 className="text-lg font-bold text-white">Create New Course</h3>
            <p className="text-xs text-slate-400 mt-0.5">Author a platform course or assign to a teacher</p>
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
            <label className="block font-semibold text-slate-300 mb-1">Course Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced System Architecture"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Price (₹ / USD) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="499"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Instructor Display Name</label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="e.g. EduVibe Faculty"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Course Ownership Assignment</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:border-amber-500 outline-none"
            >
              <option value="">Platform Owned (Super Admin)</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  Teacher: {t.name} ({t.email})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Select which instructor or platform account will receive revenue from student enrollments.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Custom URL Slug (Optional)</label>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              placeholder="e.g. advanced-system-architecture"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Thumbnail URL</label>
            <input
              type="url"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief course overview and learning objectives..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none"
            />
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
              <span>Create Course</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
