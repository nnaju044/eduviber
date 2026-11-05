import React from "react";

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  badgeColor = "amber",
  loading = false,
  error = null,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-xl bg-slate-900/60 border border-slate-800 transition-all ${
        onClick ? "cursor-pointer hover:border-amber-500/40 hover:bg-slate-900/90" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        {badgeText && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              badgeColor === "emerald"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : badgeColor === "purple"
                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                : badgeColor === "rose"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        {loading ? (
          <div className="h-8 w-20 bg-slate-800 animate-pulse rounded" />
        ) : error ? (
          <span className="text-sm font-semibold text-rose-400">Unavailable</span>
        ) : (
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{value}</p>
        )}
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>

      {subtitle && <p className="mt-1.5 text-xs text-slate-400 truncate">{subtitle}</p>}
    </div>
  );
}
