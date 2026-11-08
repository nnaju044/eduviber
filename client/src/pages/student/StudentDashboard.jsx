import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { studentApi } from "../../api/studentApi.js";
import RoleBadge from "../../components/RoleBadge.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const data = await studentApi.getDashboard();
        if (isMounted) {
          setDashboardData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load dashboard data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const enrolledCourses = dashboardData?.enrolledCourses || [];
  const pendingCourses = dashboardData?.pendingCourses || [];

  const totalLessonsCount = enrolledCourses.reduce(
    (acc, c) => acc + (c.progress?.totalLessons || 0),
    0
  );
  const completedLessonsCount = enrolledCourses.reduce(
    (acc, c) => acc + (c.progress?.completedLessons || 0),
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Student Learning Portal</h1>
            <RoleBadge role="student" />
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Welcome back, {user?.name || "Student"}. Continue your courses and review your learning milestones.
          </p>
        </div>
        <div>
          <a
            href="/courses"
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <span>Browse More Courses</span>
          </a>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs font-medium text-slate-400">Enrolled Courses</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{enrolledCourses.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {pendingCourses.length > 0 ? `${pendingCourses.length} pending verification` : "Active enrollments"}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs font-medium text-slate-400">Lessons Completed</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{completedLessonsCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Out of {totalLessonsCount} total lessons</p>
        </div>
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs font-medium text-slate-400">Certificates Earned</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {enrolledCourses.filter((c) => c.progress?.percentage === 100).length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Available upon course completion</p>
        </div>
      </div>

      {/* Enrolled Courses Section */}
      <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200">My Enrolled Courses</h2>
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
            {enrolledCourses.length} Active
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner text="Loading your courses..." />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-300">
            {error}
          </div>
        ) : enrolledCourses.length === 0 ? (
          <div className="p-8 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-400">
              You are not currently enrolled in any active courses.
            </p>
            <a
              href="/courses"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              Browse Course Catalog
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {enrolledCourses.map((c) => (
              <div
                key={c.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-2">
                  <h3 className="font-bold text-white text-sm line-clamp-2">{c.title}</h3>
                  {c.instructor && (
                    <p className="text-xs text-slate-400">Instructor: {c.instructor}</p>
                  )}
                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Progress</span>
                      <span className="font-semibold text-amber-400">{c.progress?.percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${c.progress?.percentage || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to={`/app/student/courses/${c.id}`}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                  >
                    <span>Continue Learning</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
