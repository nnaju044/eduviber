import React from "react";
import { Link, Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <Link to="/" className="inline-flex items-center gap-3 group">
          <img
            src="/EDUviber_LOGO.png"
            alt="EDUviber Logo"
            className="h-12 w-auto object-contain mx-auto transition-transform group-hover:scale-105"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white flex items-center justify-center">
          EDU<span className="text-amber-500">viber</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Sign in to your account or return to{" "}
          <Link to="/" className="text-amber-400 hover:text-amber-300 font-medium underline">
            Home
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/80 border border-slate-800 shadow-xl rounded-2xl p-6 sm:p-8 backdrop-blur-xl">
          <Outlet />
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 relative z-10">
        <p>Looking for the traditional view? <a href="/login" className="text-slate-400 hover:text-slate-200 underline">Switch to EJS Login</a></p>
      </div>
    </div>
  );
}
