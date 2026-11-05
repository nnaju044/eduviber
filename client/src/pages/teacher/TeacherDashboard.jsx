import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { teacherApi } from "../../api/teacherApi.js";
import RoleBadge from "../../components/RoleBadge.jsx";
import StatCard from "../../components/admin/StatCard.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";
import TeacherCourseCreateModal from "../../components/teacher/TeacherCourseCreateModal.jsx";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teacherApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || "Failed to load instructor metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const isApproved = stats?.isApproved ?? (user?.teacherProfile?.isApproved === true);
  const isActive = stats?.isActive ?? (user?.isActive !== false);

  const teacherRevenueShare = stats?.teacherRevenueShare !== undefined
    ? `${(stats.teacherRevenueShare * 100).toFixed(0)}% Royalty Split`
    : "80% Royalty Split";

  const platformFeeDescription = stats?.commissionRate !== undefined
    ? `Platform commission: ${(stats.commissionRate * 100).toFixed(0)}%`
    : "Platform commission: 20%";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Teacher Studio
            </h1>
            <RoleBadge role="teacher" />
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Approved Instructor
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pending Vetting Review
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Author curriculum, upload secure Bunny Stream lessons, and track student learning progress
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-2"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>

          {isApproved && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Course</span>
            </button>
          )}
        </div>
      </div>

      {/* Account Status Alerts */}
      {!isActive && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
            ✕
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-300">Instructor Account Suspended</h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Your instructor account has been temporarily suspended by the Super Administrator. Course creation and publishing operations are disabled. Please contact platform support.
            </p>
          </div>
        </div>
      )}

      {!isApproved && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-300">Instructor Account Under Review</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your instructor profile is currently awaiting validation by the platform Super Administrator. You can configure your profile and draft courses, but public course publishing will activate automatically once your application is approved.
            </p>
            <div className="pt-2">
              <Link
                to="/app/teacher/profile"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300"
              >
                <span>Complete Your Instructor Profile & Bio</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Error State with Retry Button */}
      {error && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm font-bold text-rose-400">Failed to load studio metrics</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Courses */}
        <StatCard
          title="Total Courses"
          value={stats?.totalCourses ?? 0}
          subtitle="Authored in your studio"
          loading={loading}
          badgeText="Curriculum"
          badgeColor="purple"
          icon={
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />

        {/* Metric 2: Published Courses */}
        <StatCard
          title="Published Courses"
          value={stats?.publishedCourses ?? 0}
          subtitle="Live on public storefront"
          loading={loading}
          badgeText="Live"
          badgeColor="emerald"
          icon={
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />

        {/* Metric 3: Active Students */}
        <StatCard
          title="Enrolled Students"
          value={stats?.totalStudents ?? 0}
          subtitle="Active learners in your courses"
          loading={loading}
          badgeText="Learners"
          badgeColor="amber"
          icon={
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        {/* Metric 4: Revenue Share Split */}
        <StatCard
          title="Your Revenue Split"
          value={teacherRevenueShare}
          subtitle={platformFeeDescription}
          loading={loading}
          badgeText="Royalty"
          badgeColor="emerald"
          icon={
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Useful Empty State or Studio Quick Action Links */}
      {!loading && stats && stats.totalCourses === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
            🎓
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-white">Welcome to your Teacher Studio!</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You haven't authored any courses yet. Create your first course draft, add video chapters via Bunny Stream, and publish to start teaching.
            </p>
          </div>
          {isApproved ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
            >
              Author Your First Course
            </button>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Course creation will unlock automatically when your account is approved.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/app/teacher/courses"
            className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">
                Course Catalog Studio
              </span>
              <span className="text-slate-500 group-hover:text-amber-400">→</span>
            </div>
            <p className="text-xs text-slate-400">
              Manage your course drafts, modules, and publish status.
            </p>
          </Link>

          <Link
            to="/app/teacher/students"
            className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">
                Enrolled Students & Progress
              </span>
              <span className="text-slate-500 group-hover:text-amber-400">→</span>
            </div>
            <p className="text-xs text-slate-400">
              Inspect student learning progress and lesson completion rates.
            </p>
          </Link>

          <Link
            to="/app/teacher/profile"
            className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">
                Instructor Profile & Bio
              </span>
              <span className="text-slate-500 group-hover:text-amber-400">→</span>
            </div>
            <p className="text-xs text-slate-400">
              Update headline, bio background, and banking details.
            </p>
          </Link>
        </div>
      )}

      {/* Course Create Modal */}
      {showCreateModal && (
        <TeacherCourseCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchStats();
          }}
        />
      )}
    </div>
  );
}
