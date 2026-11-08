import React from "react";

/**
 * EduViber Button Component
 * Variants:
 * - primary: Solid Black with White text
 * - gold: Solid Gold (#CA8A04) with Black/White text
 * - secondary / outline: 1px border with neutral hover
 * - ghost: Transparent background, minimal hover
 * - danger: Muted red destructive action
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className = "",
  type = "button",
  onClick,
  ...props
}) {
  const baseClasses =
    "inline-flex items-center justify-center font-bold tracking-tight rounded-xl transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#CA8A04] focus-visible:ring-offset-2";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs min-h-[36px]",
    md: "px-4 py-2.5 text-sm min-h-[44px]",
    lg: "px-6 py-3.5 text-base min-h-[48px]",
  }[size] || "px-4 py-2.5 text-sm min-h-[44px]";

  const variantClasses = {
    primary: "bg-[#000000] text-white hover:bg-neutral-800 active:bg-neutral-900 shadow-sm",
    gold: "bg-[#CA8A04] text-white hover:bg-[#A16207] active:bg-[#854D0E] shadow-sm",
    secondary: "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100",
    ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800",
  }[variant] || "";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
