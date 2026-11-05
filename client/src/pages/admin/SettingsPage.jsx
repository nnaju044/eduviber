import React from "react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Platform Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          System configurations, global commission policy, and third-party integrations
        </p>
      </div>

      {/* Placeholder Notice */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
          ℹ
        </div>
        <div>
          <p className="text-sm font-bold text-amber-300">Phase 3.2 Boundary Notice</p>
          <p className="text-xs text-slate-300">
            Platform settings are intentionally preserved as a placeholder in Phase 3.2. Global commission policies (default 20%), payment provider webhooks, and SMTP settings remain strictly managed by environment variables and backend database defaults.
          </p>
        </div>
      </div>

      {/* Settings Sections Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">Commission & Payout Policy</h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Backend Enforced</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Standard platform commission is established at 20.0% for teacher-owned courses, with 80.0% allocated to teachers. Payout automation will be implemented in subsequent phases.
          </p>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Default Platform Commission:</span>
              <span className="font-mono font-bold text-amber-400">20.0%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Default Teacher Split:</span>
              <span className="font-mono font-bold text-emerald-400">80.0%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Financial Immutability:</span>
              <span className="font-mono font-bold text-purple-400">Strict (Read-only snapshots)</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">Storage & Video Delivery</h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Active</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            EduVibe video assets and lessons stream via Bunny Stream CDN. Video processing and webhook secrets are locked to production environment configuration.
          </p>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Video CDN:</span>
              <span className="font-mono font-bold text-slate-200">Bunny Stream</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Storage Zone:</span>
              <span className="font-mono font-bold text-slate-200">Configured via .env</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Playback Security:</span>
              <span className="font-mono font-bold text-emerald-400">Signed Token URLs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
