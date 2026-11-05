import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppLayout({ showSidebar = true }) {
  const { isAuthenticated } = useAuth();
  const shouldRenderSidebar = showSidebar && isAuthenticated;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <div className="flex-1 flex">
        {shouldRenderSidebar && <Sidebar />}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>© 2026 EDUviber Platform. Multi-Teacher React Foundation (Phase 3.1).</p>
      </footer>
    </div>
  );
}
