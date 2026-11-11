import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getPublicCourseDetail } from "../../api/publicApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { studentApi } from "../../api/studentApi.js";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function CourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Enrollment state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [txRef, setTxRef] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(null);
  const [enrollError, setEnrollError] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadCourse() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicCourseDetail(slug);
        if (active) setCourseData(data);
      } catch (err) {
        if (active) setError(err.message || "Failed to load course details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCourse();
    return () => {
      active = false;
    };
  }, [slug]);

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onload = () => setProofPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    setEnrollError(null);
    setSubmitting(true);

    try {
      let finalProofUrl = proofPreview || "";
      const res = await studentApi.submitEnrollment(slug, {
        transactionReference: txRef,
        proofUrl: finalProofUrl,
      });
      setEnrollSuccess(res);
    } catch (err) {
      setEnrollError(err.message || "Enrollment submission failed. Please check reference details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading course details..." />
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-neutral-900">Course Unavailable</h2>
        <p className="text-sm text-neutral-600">{error || "The requested course could not be found."}</p>
        <Link
          to="/app/courses"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-black hover:bg-neutral-800 rounded-xl"
        >
          Browse All Courses
        </Link>
      </div>
    );
  }

  const { course, modules, syllabus, paymentConfig } = courseData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Course Hero Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#CA8A04]">
                {course.instructor || "Platform Course"}
              </span>
              <span className="text-xs text-neutral-400">•</span>
              <span className="text-xs text-neutral-500 font-medium">
                {course.totalLessons} {course.totalLessons === 1 ? "lesson" : "lessons"}
                {course.totalMinutes > 0 ? ` (${course.totalMinutes} total mins)` : ""}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-neutral-900 tracking-tight leading-tight">
              {course.title}
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 font-normal leading-relaxed">
              {course.description || "Detailed video curriculum engineered for practical mastery."}
            </p>
          </div>

          {/* Instructor Card */}
          {course.teacher && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
              <div className="w-12 h-12 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center text-lg">
                {course.teacher.name?.[0] || "T"}
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900">{course.teacher.name}</p>
                <p className="text-xs text-neutral-500">{course.teacher.headline || "Instructor"}</p>
              </div>
            </div>
          )}
        </div>

        {/* Enrollment Purchase Card */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6 sticky top-24">
          <div className="aspect-video w-full rounded-xl bg-neutral-100 overflow-hidden relative">
            {course.thumbnail ? (
              <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-white font-black text-2xl tracking-wider">
                EDU<span className="text-[#CA8A04]">viber</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-neutral-900">
                {course.price > 0 ? `₹${course.price}` : "Free"}
              </span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                Lifetime Access
              </span>
            </div>
            <p className="text-xs text-neutral-500">Includes all future updates and assignments.</p>
          </div>

          {course.isEnrolled ? (
            <Link
              to={`/app/student/courses/${course.id}`}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-center text-white bg-[#CA8A04] hover:bg-amber-600 transition-colors block"
            >
              Resume Learning →
            </Link>
          ) : (
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  navigate(`/app/login?redirect=/app/courses/${slug}`);
                } else {
                  setShowEnrollModal(true);
                }
              }}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-center text-white bg-black hover:bg-neutral-800 transition-colors"
            >
              Enroll Now
            </button>
          )}

          <div className="pt-4 border-t border-neutral-100 text-[11px] text-neutral-500 space-y-2">
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>Self-paced HD video playback</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>Course assignment submissions</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>Verified Certificate upon completion</span>
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum Syllabus Section */}
      <div className="max-w-3xl space-y-6 pt-6 border-t border-neutral-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#CA8A04]">Curriculum</span>
          <h2 className="text-2xl font-black text-neutral-900 tracking-tight mt-1">Course Syllabus</h2>
        </div>

        {modules.length === 0 ? (
          <p className="text-xs text-neutral-500">No lessons are published yet.</p>
        ) : (
          <div className="space-y-4">
            {modules.map((mod, modIdx) => (
              <div key={modIdx} className="border border-neutral-200/90 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-neutral-50/80 border-b border-neutral-200/60 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-900">{mod.name}</h3>
                  <span className="text-xs text-neutral-500 font-medium">
                    {mod.lessons.length} {mod.lessons.length === 1 ? "lesson" : "lessons"}
                  </span>
                </div>

                <div className="divide-y divide-neutral-100">
                  {mod.lessons.map((lesson) => (
                    <div key={lesson.id} className="p-4 sm:px-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-600 flex items-center justify-center shrink-0">
                          {lesson.order}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-neutral-900">{lesson.title}</p>
                          {lesson.description && (
                            <p className="text-[11px] text-neutral-500 line-clamp-1">{lesson.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {lesson.isFreePreview && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60">
                            Free Preview
                          </span>
                        )}
                        <span className="text-xs text-neutral-400 font-medium">
                          {lesson.durationMinutes > 0 ? `${lesson.durationMinutes}m` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enrollment Payment Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-6 relative my-8">
            <button
              onClick={() => {
                setShowEnrollModal(false);
                setEnrollSuccess(null);
                setEnrollError(null);
              }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-black text-lg p-1"
            >
              ✕
            </button>

            {enrollSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Enrollment Submitted!</h3>
                <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
                  Your verification request has been received. Our admin team will verify your reference (
                  <span className="font-semibold text-black">{txRef}</span>) and activate your course access shortly.
                </p>
                <div className="pt-4">
                  <Link
                    to="/app/student"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-black hover:bg-neutral-800"
                  >
                    Go to Student Dashboard →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CA8A04]">Course Enrollment</span>
                  <h3 className="text-xl font-bold text-neutral-900">{course.title}</h3>
                  <p className="text-xs text-neutral-500">
                    Amount Due: <span className="font-bold text-neutral-900">₹{course.price}</span>
                  </p>
                </div>

                {/* Bank / UPI Transfer Instructions */}
                {paymentConfig && (
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs space-y-2">
                    <p className="font-bold text-neutral-800">Transfer Instructions:</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
                      <div>
                        <span className="text-neutral-400 block">UPI ID:</span>
                        <span className="font-semibold text-black">{paymentConfig.upiId}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">Account Name:</span>
                        <span className="font-semibold text-black">{paymentConfig.accountName}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">Bank Name:</span>
                        <span className="font-semibold text-black">{paymentConfig.bankName}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">Account No:</span>
                        <span className="font-semibold text-black">{paymentConfig.accountNumber}</span>
                      </div>
                    </div>
                  </div>
                )}

                {enrollError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    {enrollError}
                  </div>
                )}

                <form onSubmit={handleEnrollSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-800 block">
                      Transaction Reference / UPI UTR *
                    </label>
                    <input
                      type="text"
                      required
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder="e.g. 332810928374 or UPI reference"
                      className="w-full px-3.5 py-2.5 text-xs border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#CA8A04] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-800 block">
                      Payment Screenshot / Receipt (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofChange}
                      className="w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 cursor-pointer"
                    />
                    {proofPreview && (
                      <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border border-neutral-200">
                        <img src={proofPreview} alt="Proof preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 rounded-xl font-bold text-xs text-white bg-black hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Submitting Verification..." : "Submit Enrollment Request"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

