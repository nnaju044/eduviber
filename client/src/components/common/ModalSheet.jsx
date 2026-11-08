import React, { useEffect } from "react";

/**
 * ModalSheet
 * On desktop: Centered dialog modal
 * On mobile (<640px): Responsive bottom sheet with handle
 */
export default function ModalSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-lg",
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal / Bottom Sheet Container */}
      <div
        className={`relative z-10 w-full ${maxWidth} bg-white rounded-t-3xl sm:rounded-2xl shadow-modal border border-neutral-200/80 flex flex-col max-h-[90vh] sm:max-h-[85vh] mt-auto sm:mt-0 transition-transform overflow-hidden`}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile bottom sheet handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>

        {/* Modal Header */}
        {(title || subtitle) && (
          <div className="px-6 py-4 border-b border-neutral-200/80 flex items-start justify-between">
            <div className="space-y-0.5">
              {title && <h3 className="text-lg font-bold text-neutral-900 tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition min-w-[36px] min-h-[36px] flex items-center justify-center -mr-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
}
