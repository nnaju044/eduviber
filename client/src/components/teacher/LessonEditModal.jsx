import React, { useState, useEffect } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import LoadingSpinner from "../LoadingSpinner.jsx";

export default function LessonEditModal({
  isOpen,
  courseId,
  lesson,
  existingLessonsCount = 0,
  onClose,
  onSuccess,
}) {
  const isEditing = Boolean(lesson);

  const [title, setTitle] = useState("");
  const [moduleName, setModuleName] = useState("General");
  const [order, setOrder] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [bunnyVideoId, setBunnyVideoId] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isFreePreview, setIsFreePreview] = useState(false);

  // Video Upload & Verification state
  const [videoMode, setVideoMode] = useState("upload"); // 'upload' | 'manual'
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [videoStatus, setVideoStatus] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Initialize form state
  useEffect(() => {
    if (lesson) {
      setTitle(lesson.title || "");
      setModuleName(lesson.moduleName || "General");
      setOrder(lesson.order || 1);
      setDurationMinutes(lesson.durationMinutes || (lesson.durationSeconds ? Math.round(lesson.durationSeconds / 60) : 0));
      setBunnyVideoId(lesson.bunnyVideoId || "");
      setIsPublished(Boolean(lesson.isPublished));
      setIsFreePreview(Boolean(lesson.isFreePreview));
      if (lesson.bunnyVideoId) {
        verifyVideo(lesson.bunnyVideoId);
      }
    } else {
      setTitle("");
      setModuleName("General");
      setOrder(existingLessonsCount + 1);
      setDurationMinutes(10);
      setBunnyVideoId("");
      setIsPublished(false);
      setIsFreePreview(false);
      setSelectedFile(null);
      setVideoStatus(null);
    }
    setUploadError("");
    setFormError("");
  }, [lesson, existingLessonsCount, isOpen]);

  if (!isOpen) return null;

  // Verify Bunny Video Status
  async function verifyVideo(videoIdToVerify) {
    const id = String(videoIdToVerify || bunnyVideoId).trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setUploadError("Invalid Bunny video GUID format (must be 36 characters with hyphens).");
      return;
    }
    try {
      setIsVerifying(true);
      setUploadError("");
      const res = await teacherApi.getVideoStatus(id);
      if (res && res.exists) {
        setVideoStatus(res);
        if (res.durationSeconds && (!durationMinutes || durationMinutes === 10)) {
          setDurationMinutes(Math.ceil(res.durationSeconds / 60));
        }
      } else {
        setVideoStatus(null);
        setUploadError("Video not found in your Bunny Stream library.");
      }
    } catch (err) {
      setUploadError(err.message || "Failed to verify video status.");
    } finally {
      setIsVerifying(false);
    }
  }

  // Handle Video File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate video MIME or extension
      if (!file.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|avi)$/i.test(file.name)) {
        setUploadError("Please select a valid video file (.mp4, .mov, .mkv, .webm).");
        return;
      }
      setSelectedFile(file);
      setUploadError("");
      if (!title) {
        // Auto-fill title from filename
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    }
  };

  // Perform Secure Server-Side Video Upload via Multipart FormData
  const handleStartUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please choose a video file first.");
      return;
    }
    try {
      setIsUploading(true);
      setUploadProgress(20);
      setUploadError("");

      // Send actual file via multipart FormData (streamed by Multer without base64 bloat)
      const formData = new FormData();
      formData.append("video", selectedFile);
      if (title.trim()) {
        formData.append("title", title.trim());
      }

      setUploadProgress(50);
      const res = await teacherApi.uploadLessonVideo(courseId, formData);

      setUploadProgress(100);
      if (res?.videoId) {
        setBunnyVideoId(res.videoId);
        await verifyVideo(res.videoId);
      }
    } catch (err) {
      setUploadError(err.message || "Video upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Lesson form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim() || title.trim().length < 2) {
      setFormError("Lesson title must be at least 2 characters.");
      return;
    }

    if (!bunnyVideoId.trim()) {
      setFormError("Please upload or attach a Bunny Stream video before saving.");
      return;
    }

    const payload = {
      title: title.trim(),
      moduleName: moduleName.trim() || "General",
      order: parseInt(order, 10) || 1,
      durationMinutes: Math.max(0, parseInt(durationMinutes, 10) || 0),
      durationSeconds: Math.max(0, parseInt(durationMinutes, 10) || 0) * 60,
      bunnyVideoId: bunnyVideoId.trim(),
      isPublished,
      isFreePreview,
    };

    try {
      setSubmitting(true);
      if (isEditing) {
        await teacherApi.updateLesson(courseId, lesson.id, payload);
      } else {
        await teacherApi.createLesson(courseId, payload);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setFormError(err.message || "Failed to save lesson.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {isEditing ? `Edit Lesson: ${lesson.title}` : "Add New Course Lesson"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure curriculum module, lesson duration, and secure Bunny Stream video
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Global Form Error Banner */}
        {formError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold flex items-center justify-between">
            <span>{formError}</span>
            <button onClick={() => setFormError("")} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title & Module */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Lesson Title <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Introduction to Vector Calculus"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Module / Section Name
              </label>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="e.g. Module 1: Foundations"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Order & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Playback Order # <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-slate-500 mt-1">Sequential position within course</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="0"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-slate-500 mt-1">Displayed to students in curriculum</p>
            </div>
          </div>

          {/* Bunny Stream Video Pipeline Section */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Bunny Stream DRM Video Asset
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Signed, time-limited token streaming with dynamic student watermarking
                </p>
              </div>

              {/* Mode switch */}
              <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setVideoMode("upload")}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${videoMode === "upload" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setVideoMode("manual")}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${videoMode === "manual" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                >
                  Attach GUID
                </button>
              </div>
            </div>

            {/* Video Upload Mode */}
            {videoMode === "upload" && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="px-4 py-2.5 rounded-lg bg-slate-900 border border-dashed border-slate-700 hover:border-amber-500/50 flex items-center justify-between transition-colors">
                      <span className="text-xs text-slate-300 truncate">
                        {selectedFile ? selectedFile.name : "Choose video file (.mp4, .mov, .mkv)..."}
                      </span>
                      <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-bold text-amber-400 uppercase">
                        Browse
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleStartUpload}
                    disabled={!selectedFile || isUploading}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 flex-shrink-0"
                  >
                    {isUploading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Uploading... {uploadProgress}%</span>
                      </>
                    ) : (
                      <span>Upload to Bunny</span>
                    )}
                  </button>
                </div>

                {isUploading && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-1.5 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Manual GUID Attachment Mode */}
            {videoMode === "manual" && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bunnyVideoId}
                    onChange={(e) => setBunnyVideoId(e.target.value.trim())}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => verifyVideo(bunnyVideoId)}
                    disabled={isVerifying || !bunnyVideoId}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs border border-slate-700"
                  >
                    {isVerifying ? "Verifying..." : "Verify GUID"}
                  </button>
                </div>
              </div>
            )}

            {/* Video Error Message */}
            {uploadError && (
              <p className="text-xs text-rose-400 font-semibold">{uploadError}</p>
            )}

            {/* Verified Video Badge / Info Card */}
            {bunnyVideoId && (
              <div className="p-3 rounded-lg bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Video Attached & Verified
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">GUID: {bunnyVideoId}</p>
                  {videoStatus && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Length: {videoStatus.durationSeconds ? `${Math.ceil(videoStatus.durationSeconds / 60)} min` : "Calculating"} • Encoding Status: {videoStatus.status === 4 ? "Complete" : "Processing"}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBunnyVideoId("");
                    setSelectedFile(null);
                    setVideoStatus(null);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  Detach
                </button>
              </div>
            )}
          </div>

          {/* Publication and Free Preview Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500/20"
              />
              <div>
                <span className="text-xs font-bold text-white block">Publish Lesson</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Make available to students enrolled in this course
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={isFreePreview}
                onChange={(e) => setIsFreePreview(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500/20"
              />
              <div>
                <span className="text-xs font-bold text-white block">Free Preview Lesson</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Allow potential students to watch without enrolling
                </span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || isUploading}
              className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isUploading}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10 transition-colors flex items-center gap-2"
            >
              {submitting && <LoadingSpinner size="sm" />}
              <span>{isEditing ? "Save Lesson Changes" : "Create Lesson"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
