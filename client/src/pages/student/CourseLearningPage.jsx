import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { studentApi } from "../../api/studentApi.js";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import CourseHeader from "../../components/student/CourseHeader.jsx";
import VideoPlayerContainer from "../../components/student/VideoPlayerContainer.jsx";
import LessonInfo from "../../components/student/LessonInfo.jsx";
import LessonDescription from "../../components/student/LessonDescription.jsx";
import LessonResources from "../../components/student/LessonResources.jsx";
import LearningProgressIndicator from "../../components/student/LearningProgressIndicator.jsx";
import CourseCurriculum from "../../components/student/CourseCurriculum.jsx";
import LessonControls from "../../components/student/LessonControls.jsx";
import CourseCompletionSummary from "../../components/student/CourseCompletionSummary.jsx";
import StudentAssignmentSection from "../../components/student/StudentAssignmentSection.jsx";

/**
 * CourseLearningPage
 * Approved Design:
 * - White-only interface (#FFFFFF)
 * - Black typography (#000000 / neutral-900)
 * - Gold accent (#CA8A04)
 * - Mobile-first PWA priority:
 *    1. Course header and back navigation
 *    2. Video player container
 *    3. Current lesson title and details
 *    4. Chapter and lesson information
 *    5. Lesson description
 *    6. Available lesson resources
 *    7. Learning progress information
 *    8. Previous and Next lesson controls
 *    9. Course curriculum directly below the lesson content
 * - Desktop secondary:
 *    - Left column: Player, lesson info, description, resources, progress, controls
 *    - Right column: Sticky curriculum sidebar with chapter accordion
 */
export default function CourseLearningPage() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read raw query parameters
  const canonicalLessonId = searchParams.get("lessonId");
  const legacyLessonId = searchParams.get("lesson");
  const effectiveLessonIdFromUrl = canonicalLessonId || legacyLessonId;

  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active lesson selection and playback authorization state
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  const [activeLessonPlaybackData, setActiveLessonPlaybackData] = useState(null);

  // 1. Fetch course details & syllabus
  useEffect(() => {
    let isMounted = true;

    async function fetchCourseDetails() {
      if (!courseId) {
        setError({ message: "Course ID is required.", status: 400 });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await studentApi.getEnrolledCourse(courseId);
        if (isMounted) {
          setCourseData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError({
            message: err.message || "Failed to load course information.",
            status: err.status || 500,
            code: err.code || "LOAD_FAILED",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchCourseDetails();

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  // 2. Synchronize URL & active lesson selection
  useEffect(() => {
    if (!courseData?.syllabus) return;

    const syllabus = courseData.syllabus;
    if (syllabus.length === 0) {
      setActiveLessonId(null);
      return;
    }

    // If legacy `lesson` parameter exists, or canonical `lessonId` is present
    if (effectiveLessonIdFromUrl) {
      const targetLesson = syllabus.find((l) => l.id === effectiveLessonIdFromUrl);
      if (targetLesson) {
        setActiveLessonId(targetLesson.id);

        // Normalize URL to canonical ?lessonId=<id> if it was using legacy ?lesson
        if (legacyLessonId || canonicalLessonId !== targetLesson.id) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("lesson");
          nextParams.set("lessonId", targetLesson.id);
          setSearchParams(nextParams, { replace: true });
        }
        return;
      } else {
        // Lesson ID from URL does not exist in this course syllabus!
        setPlaybackError({
          message: "The requested lesson could not be found in this course syllabus.",
          code: "LESSON_NOT_FOUND",
        });
        setActiveLessonId(effectiveLessonIdFromUrl);
        return;
      }
    }

    // No lesson specified in URL: default to first incomplete lesson, or first lesson
    const firstIncomplete = syllabus.find((l) => !l.progress?.completed);
    const target = firstIncomplete || syllabus[0];
    if (target) {
      setActiveLessonId(target.id);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("lesson");
      nextParams.set("lessonId", target.id);
      setSearchParams(nextParams, { replace: true });
    }
  }, [courseData, effectiveLessonIdFromUrl, canonicalLessonId, legacyLessonId, searchParams, setSearchParams]);

  // 3. Verify access and load playback token whenever activeLessonId changes
  const authorizedLessonIdRef = useRef(null);

  const loadLessonPlayback = useCallback(async (targetId, force = false) => {
    if (!courseId || !targetId) return;
    if (!force && authorizedLessonIdRef.current === targetId && activeLessonPlaybackData) {
      return; // Already authorized for this lesson; do not re-request on progress saves or state updates
    }

    setPlaybackLoading(true);
    setPlaybackError(null);

    try {
      const data = await studentApi.getLessonPlayback(courseId, targetId);
      authorizedLessonIdRef.current = targetId;
      setActiveLessonPlaybackData(data);
      setPlaybackError(null);
    } catch (err) {
      authorizedLessonIdRef.current = null;
      setActiveLessonPlaybackData(null);
      setPlaybackError({
        message: err.message || "Active enrollment required to watch this lesson.",
        status: err.status || 403,
        code: err.code || "PLAYBACK_UNAUTHORIZED",
      });
    } finally {
      setPlaybackLoading(false);
    }
  }, [courseId, activeLessonPlaybackData]);

  useEffect(() => {
    if (!courseData?.syllabus || !activeLessonId) return;

    const targetLesson = courseData.syllabus.find((l) => l.id === activeLessonId);
    if (!targetLesson) return;

    // Only load playback if lesson has changed or not yet loaded
    if (authorizedLessonIdRef.current !== targetLesson.id) {
      loadLessonPlayback(targetLesson.id);
    }
  }, [courseData?.syllabus, activeLessonId, loadLessonPlayback]);

  // Handle live progress updates from player
  const handleProgressSaved = useCallback((updatedProgress) => {
    if (!updatedProgress) return;

    setCourseData((prev) => {
      if (!prev?.syllabus) return prev;

      const newSyllabus = prev.syllabus.map((l) => {
        if (l.id === updatedProgress.lessonId) {
          return {
            ...l,
            progress: {
              ...l.progress,
              completed: updatedProgress.completed,
              lastPositionSeconds: updatedProgress.lastPositionSeconds,
              progressSeconds: updatedProgress.progressSeconds,
              watchedSeconds: updatedProgress.watchedSeconds,
              percentage: updatedProgress.progressPercentage,
              lastWatchedAt: updatedProgress.lastWatchedAt,
            },
          };
        }
        return l;
      });

      const totalLessons = newSyllabus.length;
      const completedLessons = newSyllabus.filter((s) => s.progress?.completed).length;
      const completionPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return {
        ...prev,
        syllabus: newSyllabus,
        stats: {
          totalLessons,
          completedLessons,
          completionPercentage,
        },
      };
    });
  }, []);

  const handleLessonCompleted = useCallback(() => {
    // Re-sync course details to ensure chapter completion counters and stats match backend
    studentApi.getEnrolledCourse(courseId).then((data) => {
      if (data) setCourseData(data);
    }).catch(() => { });
  }, [courseId]);

  // Handle lesson selection from curriculum or controls
  const handleSelectLesson = useCallback(
    (targetLessonId) => {
      if (!targetLessonId || targetLessonId === activeLessonId) return;
      setActiveLessonId(targetLessonId);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("lesson");
      nextParams.set("lessonId", targetLessonId);
      setSearchParams(nextParams);

      // Smooth scroll to top for mobile view
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [activeLessonId, searchParams, setSearchParams]
  );

  const handleFinishCourse = useCallback(() => {
    navigate("/app/student");
  }, [navigate]);

  // Derive current lesson, prev/next navigation, and sequence counters
  const { currentLesson, prevLesson, nextLesson, currentIndex, totalLessons } = useMemo(() => {
    const syllabus = courseData?.syllabus || [];
    const total = syllabus.length;
    const index = syllabus.findIndex((l) => l.id === activeLessonId);

    return {
      currentLesson: index >= 0 ? syllabus[index] : null,
      prevLesson: index > 0 ? syllabus[index - 1] : null,
      nextLesson: index >= 0 && index < total - 1 ? syllabus[index + 1] : null,
      currentIndex: index >= 0 ? index + 1 : null,
      totalLessons: total,
    };
  }, [courseData?.syllabus, activeLessonId]);

  const isEnrolled = courseData?.enrollmentStatus === "active" || courseData?.enrollmentStatus === "admin_override";
  const isCourseComplete =
    courseData?.stats?.completionPercentage === 100 ||
    (courseData?.stats?.totalLessons > 0 &&
      courseData?.stats?.completedLessons === courseData?.stats?.totalLessons);

  const handleRevisitFirstLesson = useCallback(() => {
    if (courseData?.syllabus?.[0]) {
      handleSelectLesson(courseData.syllabus[0].id);
    }
  }, [courseData?.syllabus, handleSelectLesson]);

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col antialiased selection:bg-[#CA8A04] selection:text-white">
      {/* 1. Header with back-to-dashboard navigation */}
      <CourseHeader courseTitle={courseData?.course?.title} />

      {/* Main Learning Canvas */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        {/* Loading State */}
        {loading && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
            <LoadingSpinner text="Loading course curriculum..." />
          </div>
        )}

        {/* Error / Unauthorized / Unavailable State */}
        {!loading && error && (
          <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-neutral-50 border border-neutral-200 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-neutral-100 text-[#CA8A04] font-bold text-xl flex items-center justify-center mx-auto">
              !
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-neutral-900">
                {error.status === 403
                  ? "Enrollment Required"
                  : error.status === 404
                    ? "Course Not Found"
                    : "Unable to Load Course"}
              </h1>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                {error.message}
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/app/student"
                className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs font-bold transition-all shadow-sm"
              >
                Return to Student Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Loaded Course Content */}
        {!loading && !error && courseData && (
          <div className="space-y-6">
            {/* Desktop Two-Column / Mobile Stacked Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* Left Column: Player, Lesson Info, Description, Resources, Progress, Controls */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-5">
                {/* 2. Video player container */}
                <VideoPlayerContainer
                  lesson={currentLesson}
                  playbackData={activeLessonPlaybackData}
                  courseId={courseId}
                  playbackLoading={playbackLoading}
                  error={playbackError}
                  onProgressSaved={handleProgressSaved}
                  onLessonCompleted={handleLessonCompleted}
                  onRetryPlayback={() => loadLessonPlayback(activeLessonId, true)}
                />

                {/* 3 & 4. Current lesson title, chapter and metadata */}
                <LessonInfo lesson={currentLesson} />

                {/* 5. Lesson Description */}
                <LessonDescription description={currentLesson?.description} />

                {/* 6. Available Lesson Resources */}
                <LessonResources resources={currentLesson?.resources || []} />

                {/* 6.5 Course & Lesson Homework / Assignments */}
                <StudentAssignmentSection
                  courseId={courseId}
                  activeLessonId={activeLessonId}
                  currentModuleName={currentLesson?.moduleName}
                />

                {/* 7. Learning progress information */}
                <LearningProgressIndicator stats={courseData.stats} />

                {/* Course Completion Celebration Banner when 100% complete */}
                {isCourseComplete && (
                  <CourseCompletionSummary
                    stats={courseData.stats}
                    courseTitle={courseData.course?.title}
                    onRevisitFirstLesson={handleRevisitFirstLesson}
                  />
                )}

                {/* 8. Previous and Next lesson controls */}
                <LessonControls
                  prevLesson={prevLesson}
                  nextLesson={nextLesson}
                  onSelectLesson={handleSelectLesson}
                  onFinishCourse={handleFinishCourse}
                  currentIndex={currentIndex}
                  totalLessons={totalLessons}
                />

                {/* 9. Mobile-Only Curriculum Placement (Directly below lesson content & controls) */}
                <div className="block lg:hidden pt-2">
                  <CourseCurriculum
                    syllabus={courseData.syllabus}
                    activeLessonId={activeLessonId}
                    onSelectLesson={handleSelectLesson}
                    isEnrolled={isEnrolled}
                  />
                </div>

                {/* Course & Instructor Footnote */}
                {courseData.course?.instructor && (
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      Course instructor:{" "}
                      <strong className="text-neutral-800 font-semibold">
                        {courseData.course.instructor}
                      </strong>
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      ID: {courseData.course.id.slice(-6)}
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Desktop Sticky Curriculum Sidebar */}
              <div className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-20">
                <CourseCurriculum
                  syllabus={courseData.syllabus}
                  activeLessonId={activeLessonId}
                  onSelectLesson={handleSelectLesson}
                  isEnrolled={isEnrolled}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
