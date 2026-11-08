import React, { useState } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import LoadingSpinner from "../LoadingSpinner.jsx";

export default function TeacherCourseCreateModal({ isOpen, onClose, onSuccess, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("1999");
  const [thumbnail, setThumbnail] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!title.trim() || title.trim().length < 3) {
      setError("Course title must be at least 3 characters.");
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError("Price must be a non-negative number.");
      return;
    }

    let course = null;
    try {
      setLoading(true);
      course = await teacherApi.createCourse({
        title: title.trim(),
        description: description.trim(),
        price: numPrice,
        thumbnail: thumbnail.trim(),
        customSlug: customSlug.trim() || undefined,
      });
    } catch (err) {
      setLoading(false);
      if (err.status === 409 || err.code === "SLUG_CONFLICT") {
        setError("A course with this slug already exists. Please choose a different custom slug.");
      } else {
        setError(err.message || "Failed to create course.");
      }
      return;
    }

    // Server confirmed creation! Isolate post-creation callbacks so UI refresh failures never report a false creation error.
    try {
      if (typeof onSuccess === "function") {
        onSuccess(course);
      } else if (typeof onCreated === "function") {
        onCreated(course);
      }
    } catch (callbackErr) {
      console.warn("[TeacherCourseCreateModal] Post-creation callback error:", callbackErr);
    } finally {
      setLoading(false);
      if (typeof onClose === "function") {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white">Create New Course</h3>
            <p className="text-xs text-slate-400 mt-0.5">Author a new curriculum draft in your Teacher Studio</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Course Title <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Modern Vector Calculus & Applications"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Storefront Price (₹) <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1999"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Custom URL Slug (Optional)
              </label>
              <input
                type="text"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="e.g. vector-calculus-2026"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Thumbnail Image URL (Optional)
            </label>
            <input
              type="url"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Course Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Comprehensive syllabus and learning outcomes..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
            <strong>Author Ownership:</strong> This course will be created with Draft status under your instructor account. You can add lessons, upload Bunny Stream videos, and publish it when ready.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              <span>Create Course Draft</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
