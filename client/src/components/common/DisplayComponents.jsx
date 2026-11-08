import React from "react";

export function Card({ children, className = "", onClick, hoverable = false }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-neutral-200/80 p-5 sm:p-6 shadow-sm transition-all duration-150 ${
        hoverable ? "hover:border-neutral-300 hover:shadow cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({ children, variant = "default", className = "" }) {
  const variantStyles = {
    default: "bg-neutral-100 text-neutral-800 border-neutral-200",
    gold: "bg-[#CA8A04]/10 text-[#CA8A04] border-[#CA8A04]/30 font-bold",
    black: "bg-black text-white border-black font-semibold",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold",
    warning: "bg-amber-50 text-amber-700 border-amber-200 font-semibold",
    danger: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
  }[variant] || "bg-neutral-100 text-neutral-800 border-neutral-200";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description, actionText, onAction, icon = "✦" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50">
      <div className="w-12 h-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-lg text-[#CA8A04] shadow-sm mb-3">
        {icon}
      </div>
      <h4 className="text-base font-bold text-neutral-900">{title}</h4>
      {description && <p className="text-xs text-neutral-500 max-w-sm mt-1">{description}</p>}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200/80 mb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">{title}</h1>
          {badge && <Badge variant="gold">{badge}</Badge>}
        </div>
        {description && <p className="text-xs sm:text-sm text-neutral-600 font-medium">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
}
