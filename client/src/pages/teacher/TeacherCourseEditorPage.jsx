import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { teacherApi } from "../../api/teacherApi.js";
import StatusBadge from "../../components/admin/StatusBadge.jsx";
import ConfirmModal from "../../components/admin/ConfirmModal.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import LessonEditModal from "../../components/teacher/LessonEditModal.jsx";
import TeacherContentAccessManager from "../../components/teacher/TeacherContentAccessManager.jsx";
import TeacherAssignmentManager from "../../components/teacher/TeacherAssignmentManager.jsx";

export default function TeacherCourseEditorPage() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Course metadata form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);

  // Lesson modal state
  const [activeLesson, setActiveLesson] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);

  // Active tab in Course Editor: 'curriculum' | 'access' | 'settings'
  const [activeTab, setActiveTab] = useState("curriculum");

  // Confirm delete lesson state
  const [lessonToDelete, setLessonToDelete] = useState(null);
  const [deletingLesson, setDeletingLesson] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);

  // Load course and lessons
  const fetchCourseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherApi.getCourse(courseId);
      if (data?.course) {
        setCourse(data.course);
        setLessons(data.lessons || []);
        setTitle(data.course.title || "");
        setDescription(data.course.description || "");
        setPrice(String(data.course.price ?? ""));
        setThumbnail(data.course.thumbnail || "");
        setCustomSlug(data.course.slug || "");
      }
    } catch (err) {
      setError(err.message || "Failed to load course details.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  // Save Course Metadata
  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setToastMessage({ type: "error", text: "Course title must be at least 3 characters." });
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setToastMessage({ type: "error", text: "Price must be a non-negative number." });
      return;
    }

    try {
      setSavingCourse(true);
      const updated = await teacherApi.updateCourse(courseId, {
        title: title.trim(),
        description: description.trim(),
        price: numPrice,
        thumbnail: thumbnail.trim(),
        customSlug: customSlug.trim() || undefined,
      });

      setCourse(updated);
      setToastMessage({ type: "success", text: "Course metadata saved successfully." });
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to update course." });
    } finally {
      setSavingCourse(false);
    }
  };

  // Toggle Publication
  const handleTogglePublication = async () => {
    if (!course) return;
    try {
      const willPublish = !course.isPublished;
      const res = await teacherApi.toggleCoursePublication(courseId);
      setCourse((prev) => ({ ...prev, isPublished: res.isPublished }));
      setToastMessage({
        type: "success",
        text: `Course ${willPublish ? "published to storefront" : "converted to draft"}.`,
      });
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to update publication status." });
    }
  };

  // Delete Lesson
  const handleDeleteLesson = async () => {
    if (!lessonToDelete) return;
    try {
      setDeletingLesson(true);
      await teacherApi.deleteLesson(courseId, lessonToDelete.id);
      setToastMessage({ type: "success", text: `Lesson "${lessonToDelete.title}" deleted.` });
      setLessonToDelete(null);
      await fetchCourseData();
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to delete lesson." });
    } finally {
      setDeletingLesson(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="lg" text="Loading course curriculum studio..." />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
        <p className="text-sm font-bold text-rose-400">Failed to load course</p>
        <p className="text-xs text-slate-400">{error || "Course record could not be found."}</p>
        <div className="pt-2">
          <Link
            to="/app/teacher/courses"
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
          >
            ← Return to Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/app/teacher/courses" className="hover:text-amber-400 transition-colors">
              Courses
            </Link>
            <span>/</span>
            <span className="text-slate-200 truncate max-w-xs">{course.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Curriculum Studio
            </h1>
            <StatusBadge
              type="publication"
              status={course.isPublished ? "published" : "draft"}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePublication}
            className={`px-3.5 py-2 rounded-lg font-bold text-xs border transition-colors ${course.isPublished
                ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-500/40"
              }`}
          >
            {course.isPublished ? "Unpublish from Storefront" : "Publish Course Now"}
          </button>

          <a
            href={`/courses/${course.slug}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Preview storefront page"
          >
            <span>Storefront</span>
            <span className="text-[10px] text-amber-400 font-mono">↗</span>
          </a>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${toastMessage.type === "success"
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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("curriculum")}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer ${activeTab === "curriculum"
              ? "bg-amber-500/15 text-[#CA8A04] border border-[#CA8A04]/40"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
        >
          <span>📚 Curriculum & Lessons</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
            {lessons.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("access")}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer ${activeTab === "access"
              ? "bg-amber-500/15 text-[#CA8A04] border border-[#CA8A04]/40"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
        >
          <span>🔐 Content Access & Unlocking</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#CA8A04]/20 text-[10px] text-[#CA8A04] font-semibold">
            Teacher Control
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assignments")}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer ${activeTab === "assignments"
              ? "bg-amber-500/15 text-[#CA8A04] border border-[#CA8A04]/40"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
        >
          <span>📝 Homework & Assignments</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer ${activeTab === "settings"
              ? "bg-amber-500/15 text-[#CA8A04] border border-[#CA8A04]/40"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
        >
          <span>⚙️ Course Settings</span>
        </button>
      </div>

      {/* Tab: Content Access & Unlocking System */}
      {activeTab === "access" && (
        <TeacherContentAccessManager
          courseId={courseId}
          courseTitle={course.title}
        />
      )}

      {/* Tab: Homework & Assignments Management */}
      {activeTab === "assignments" && (
        <TeacherAssignmentManager
          courseId={courseId}
          courseTitle={course.title}
          modules={Array.from(new Set(lessons.map((l) => l.moduleName || "General")))}
          lessons={lessons}
        />
      )}

      {/* Tab: Course Metadata Editor Section */}
      {activeTab === "settings" && (
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-200">Course Metadata & Storefront Settings</h2>
              <p className="text-xs text-slate-400">Title, pricing, description, and preview imagery</p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">ID: {course.id}</span>
          </div>

          <form onSubmit={handleSaveCourse} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Course Title <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Storefront URL Slug
                </label>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  placeholder="leave empty to auto-slugify"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Course Price (INR ₹) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Thumbnail Image URL
                </label>
                <input
                  type="url"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a comprehensive course description..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={savingCourse}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2"
              >
                {savingCourse && <LoadingSpinner size="sm" />}
                <span>Save Course Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Lessons & Chapters Curriculum Section */}
      {activeTab === "curriculum" && (
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Course Lessons & Modules</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-semibold text-xs">
                  {lessons.length} Lessons
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Playback ordering, chapter divisions, and Bunny Stream DRM video attachments
              </p>
            </div>

            <button
              onClick={() => {
                setActiveLesson(null);
                setShowLessonModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Lesson</span>
            </button>
          </div>

          {lessons.length === 0 ? (
            <div className="p-10 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-300">No lessons authored yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add your first lesson, upload the video chapter via Bunny Stream, and organize your syllabus.
              </p>
              <button
                onClick={() => {
                  setActiveLesson(null);
                  setShowLessonModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Add First Lesson
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-amber-400 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-700">
                      #{lesson.order}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-200 text-xs sm:text-sm group-hover:text-amber-400 transition-colors">
                          {lesson.title}
                        </p>
                        {lesson.isFreePreview && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Free Preview
                          </span>
                        )}
                        <StatusBadge
                          type="publication"
                          status={lesson.isPublished ? "published" : "draft"}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>Module: <strong className="text-slate-300">{lesson.moduleName || "General"}</strong></span>
                        <span>•</span>
                        <span>Duration: {lesson.durationMinutes || (lesson.durationSeconds ? Math.round(lesson.durationSeconds / 60) : 0)} min</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500 truncate max-w-[150px]">
                          Bunny ID: {lesson.bunnyVideoId ? lesson.bunnyVideoId.slice(0, 8) + "..." : "None"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => {
                        setActiveLesson(lesson);
                        setShowLessonModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
                    >
                      Edit / Video
                    </button>

                    <button
                      onClick={() => setLessonToDelete(lesson)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-semibold text-xs transition-colors"
                      title="Delete Lesson"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lesson Edit / Create Modal */}
      {showLessonModal && (
        <LessonEditModal
          isOpen={showLessonModal}
          courseId={courseId}
          lesson={activeLesson}
          existingLessonsCount={lessons.length}
          onClose={() => {
            setShowLessonModal(false);
            setActiveLesson(null);
          }}
          onSuccess={() => {
            fetchCourseData();
            setToastMessage({
              type: "success",
              text: activeLesson ? "Lesson updated successfully." : "New lesson added successfully.",
            });
          }}
        />
      )}

      {/* Confirm Delete Lesson Modal */}
      {lessonToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete Lesson"
          message={`Are you sure you want to delete lesson #${lessonToDelete.order} "${lessonToDelete.title}"? Associated student progress records will also be removed.`}
          confirmText="Delete Lesson"
          confirmVariant="rose"
          loading={deletingLesson}
          onConfirm={handleDeleteLesson}
          onCancel={() => setLessonToDelete(null)}
        />
      )}
    </div>
  );
}
