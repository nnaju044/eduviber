import React from "react";

export function FormField({ label, error, hint, required, id, children, className = "" }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
          {label} {required && <span className="text-[#CA8A04]">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}

export function Input({ id, error, className = "", ...props }) {
  return (
    <input
      id={id}
      className={`w-full px-3.5 py-2.5 rounded-xl bg-white border text-neutral-900 text-sm font-medium placeholder:text-neutral-400 min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#CA8A04] focus:border-transparent ${
        error ? "border-rose-300 bg-rose-50/20" : "border-neutral-200 hover:border-neutral-300"
      } ${className}`}
      {...props}
    />
  );
}

export function Textarea({ id, error, rows = 3, className = "", ...props }) {
  return (
    <textarea
      id={id}
      rows={rows}
      className={`w-full px-3.5 py-2.5 rounded-xl bg-white border text-neutral-900 text-sm font-medium placeholder:text-neutral-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[#CA8A04] focus:border-transparent ${
        error ? "border-rose-300 bg-rose-50/20" : "border-neutral-200 hover:border-neutral-300"
      } ${className}`}
      {...props}
    />
  );
}

export function Select({ id, error, options = [], children, className = "", ...props }) {
  return (
    <select
      id={id}
      className={`w-full px-3.5 py-2.5 rounded-xl bg-white border text-neutral-900 text-sm font-medium min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#CA8A04] focus:border-transparent ${
        error ? "border-rose-300" : "border-neutral-200 hover:border-neutral-300"
      } ${className}`}
      {...props}
    >
      {options.length > 0
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
}
