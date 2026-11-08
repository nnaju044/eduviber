import React from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import RoleBadge from "../../components/RoleBadge.jsx";

export default function SuperAdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Super Admin Console</h1>
            <RoleBadge role="super_admin" />
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Platform-wide governance, system metrics, and teacher approvals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/admin/courses"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span>Open EJS Admin</span>
            <span className="text-[10px] text-amber-400 font-mono">↗</span>
          </a>
        </div>
      </div>

      {/* Metrics Placeholders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs font-medium text-slate-400">Platform Revenue</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">20.0% Commission</p>
          <p className="text-[11px] text-slate-500 mt-1">Phase 3.2 financial reporting placeholder</p>
        </div>
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs font-medium text-slate-400">Teacher Accounts</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">Pending Queue</p>
          <p className="text-[11px] text-slate-500 mt-1">Approval module scheduled for Phase 3.2</p>
        </div>
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs font-medium text-slate-400">Total Courses</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">Catalog Active</p>
          <p className="text-[11px] text-slate-500 mt-1">Multi-teacher course governance</p>
        </div>
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs font-medium text-slate-400">System Security</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">CSRF & Sessions</p>
          <p className="text-[11px] text-slate-500 mt-1">105 Automated Isolation Tests Passing</p>
        </div>
      </div>

      {/* Section Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200">Teacher Approvals Pipeline</h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">Placeholder</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Phase 3.2 will deliver the interactive teacher verification interface, allowing super admins to approve or reject instructor onboarding applications with one click.
          </p>
          <div className="p-4 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-center py-8">
            <p className="text-xs text-slate-500">Teacher approval queue UI will be mounted here in Phase 3.2.</p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200">Platform Financial Audits</h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">Placeholder</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Comprehensive audit reports tracking immutable payments, teacher 80% splits, platform 20% commission deductions, and payout history.
          </p>
          <div className="p-4 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-center py-8">
            <p className="text-xs text-slate-500">Financial audit & payout ledger UI will be mounted here in Phase 3.2.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
