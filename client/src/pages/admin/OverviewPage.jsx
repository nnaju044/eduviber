import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../api/adminApi.js";
import StatCard from "../../components/admin/StatCard.jsx";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || "Failed to retrieve platform metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const pendingApprovalsCount = (stats?.pendingTeachers || 0) + (stats?.pendingPayments || 0);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Platform Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time platform governance, instructor network, course catalog, and financial settlements
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
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {/* Pending Action Banner if any approvals or payments pending */}
      {!loading && !error && pendingApprovalsCount > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
              !
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300">
                Action Required: {pendingApprovalsCount} Items Pending Super Admin Review
              </p>
              <p className="text-xs text-slate-300">
                {stats.pendingTeachers} instructor application(s) and {stats.pendingPayments} manual payment verification(s) awaiting approval.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {stats.pendingTeachers > 0 && (
              <Link
                to="/app/admin/teachers"
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Review Teachers ({stats.pendingTeachers})
              </Link>
            )}
            {stats.pendingPayments > 0 && (
              <Link
                to="/app/admin/payments"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs border border-amber-500/30 transition-colors"
              >
                Review Payments ({stats.pendingPayments})
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Error State with Retry Button */}
      {error && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <p className="text-sm font-bold text-rose-400">Failed to load platform metrics</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Retry Loading Metrics
          </button>
        </div>
      )}

      {/* 8 Primary Platform Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Teachers */}
        <StatCard
          title="Total Teachers"
          value={stats?.totalTeachers ?? 0}
          subtitle="Registered instructor network"
          loading={loading}
          badgeText="Instructors"
          badgeColor="purple"
          icon={
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />

        {/* Metric 2: Approved Teachers */}
        <StatCard
          title="Approved Teachers"
          value={stats?.approvedTeachers ?? 0}
          subtitle="Authorized to author & publish"
          loading={loading}
          badgeText="Verified"
          badgeColor="emerald"
          icon={
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* Metric 3: Pending Teacher Approvals */}
        <StatCard
          title="Pending Teachers"
          value={stats?.pendingTeachers ?? 0}
          subtitle="Awaiting Super Admin vetting"
          loading={loading}
          badgeText={stats?.pendingTeachers > 0 ? "Action Required" : "Up to date"}
          badgeColor={stats?.pendingTeachers > 0 ? "amber" : "emerald"}
          icon={
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* Metric 4: Total Courses */}
        <StatCard
          title="Total Courses"
          value={stats?.totalCourses ?? 0}
          subtitle="Platform & teacher courses"
          loading={loading}
          badgeText="Catalog"
          badgeColor="amber"
          icon={
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />

        {/* Metric 5: Published Courses */}
        <StatCard
          title="Published Courses"
          value={stats?.publishedCourses ?? 0}
          subtitle="Publicly visible in storefront"
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

        {/* Metric 6: Total Students */}
        <StatCard
          title="Total Students"
          value={stats?.totalStudents ?? 0}
          subtitle="Enrolled student community"
          loading={loading}
          badgeText="Learners"
          badgeColor="purple"
          icon={
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        {/* Metric 7: Pending Payments */}
        <StatCard
          title="Pending Payments"
          value={stats?.pendingPayments ?? 0}
          subtitle="Awaiting manual receipt check"
          loading={loading}
          badgeText={stats?.pendingPayments > 0 ? "Review Needed" : "Clear"}
          badgeColor={stats?.pendingPayments > 0 ? "amber" : "emerald"}
          icon={
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        {/* Metric 8: Approved Payments */}
        <StatCard
          title="Approved Payments"
          value={stats?.approvedPayments ?? 0}
          subtitle="Immutable financial settlements"
          loading={loading}
          badgeText="Settled"
          badgeColor="emerald"
          icon={
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Navigation Quick Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          to="/app/admin/teachers"
          className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Manage Teachers</span>
            <span className="text-slate-500 group-hover:text-amber-400">→</span>
          </div>
          <p className="text-xs text-slate-400">
            Provision instructor accounts, review onboarding applications, and manage active status.
          </p>
        </Link>

        <Link
          to="/app/admin/courses"
          className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Manage Courses</span>
            <span className="text-slate-500 group-hover:text-amber-400">→</span>
          </div>
          <p className="text-xs text-slate-400">
            Platform-wide curriculum inspection, ownership verification, and publishing controls.
          </p>
        </Link>

        <Link
          to="/app/admin/students"
          className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Manage Students</span>
            <span className="text-slate-500 group-hover:text-amber-400">→</span>
          </div>
          <p className="text-xs text-slate-400">
            Student directory, enrollment histories, and authorization status overrides.
          </p>
        </Link>

        <Link
          to="/app/admin/payments"
          className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Review Payments</span>
            <span className="text-slate-500 group-hover:text-amber-400">→</span>
          </div>
          <p className="text-xs text-slate-400">
            Manual transfer verification queue, receipt proof checks, and server snapshot settlements.
          </p>
        </Link>
      </div>
    </div>
  );
}
