import React from "react";
import { Link, Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative antialiased selection:bg-[#CA8A04] selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/app" className="inline-flex items-center gap-2.5 group select-none">
          <img
            src="/EDUviber_LOGO.png"
            alt="EDUviber Logo"
            className="h-10 w-auto object-contain mx-auto transition-transform group-hover:scale-105"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <span className="text-2xl font-black tracking-tight text-black flex items-center">
            EDU<span className="text-[#CA8A04]">viber</span>
          </span>
        </Link>
        <p className="mt-2 text-xs font-semibold text-neutral-500">
          Professional Digital Skills Learning Platform
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-neutral-200 shadow-card rounded-2xl p-6 sm:p-8">
          <Outlet />
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-neutral-400">
        <p>
          Need assistance or exploring courses?{" "}
          <Link to="/app" className="text-black font-bold hover:underline">
            Return Home
          </Link>{" "}
          •{" "}
          <a href="/courses" className="text-neutral-600 hover:text-black font-semibold hover:underline">
            Browse Catalog
          </a>
        </p>
      </div>
    </div>
  );
}
