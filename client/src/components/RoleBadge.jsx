import React from "react";

export default function RoleBadge({ role }) {
  if (!role) return null;

  const normalized = role.toLowerCase();
  if (normalized === "super_admin" || normalized === "admin") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
        Super Admin
      </span>
    );
  }

  if (normalized === "teacher") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Teacher
      </span>
    );
  }

  if (normalized === "student") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Student
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
      {role}
    </span>
  );
}
