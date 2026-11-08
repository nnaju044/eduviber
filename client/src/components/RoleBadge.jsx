import React from "react";

export default function RoleBadge({ role }) {
  if (!role) return null;

  const normalized = role.toLowerCase();
  if (normalized === "super_admin" || normalized === "admin") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-black text-white border border-black select-none">
        Super Admin
      </span>
    );
  }

  if (normalized === "teacher") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#CA8A04]/15 text-[#CA8A04] border border-[#CA8A04]/30 select-none">
        Teacher
      </span>
    );
  }

  if (normalized === "student") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 select-none">
        Student
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200 select-none">
      {role}
    </span>
  );
}
