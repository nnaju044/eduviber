import React from "react";

export default function LoadingSpinner({ size = "md", text = "Loading..." }) {
  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-3" role="status">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-slate-700 border-t-amber-500 animate-spin`}
      />
      {text && <p className="text-sm text-slate-400 font-medium">{text}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );
}
