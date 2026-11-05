import React, { useEffect } from "react";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "amber", // 'amber' | 'emerald' | 'rose'
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const confirmColors = {
    amber: "bg-amber-500 hover:bg-amber-400 text-slate-950 focus:ring-amber-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500",
    rose: "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-start justify-between">
          <h3 id="modal-title" className="text-lg font-bold text-white">
            {title}
          </h3>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {message && <p className="text-sm text-slate-300 leading-relaxed">{message}</p>}

        {children}

        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-60 ${
              confirmColors[variant] || confirmColors.amber
            }`}
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
