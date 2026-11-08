import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppLayout({ showSidebar = true }) {
  const { isAuthenticated } = useAuth();
  const shouldRenderSidebar = showSidebar && isAuthenticated;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 flex flex-col font-sans antialiased selection:bg-[#CA8A04] selection:text-white">
      {/* Top Bar with Mobile Drawer Trigger */}
      <Navbar onToggleMobileSidebar={shouldRenderSidebar ? () => setMobileSidebarOpen(true) : undefined} />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex max-w-full overflow-x-hidden">
        {shouldRenderSidebar && (
          <Sidebar
            isOpen={mobileSidebarOpen}
            onClose={() => setMobileSidebarOpen(false)}
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Clean Light Footer */}
      <footer className="border-t border-neutral-200/80 bg-white py-5 px-6 text-center text-xs text-neutral-500 safe-bottom">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 EDUviber. All rights reserved.</p>
          <div className="flex items-center gap-4 text-neutral-600 font-semibold">
            <a href="/courses" className="hover:text-black transition">
              Courses
            </a>
            <span className="text-neutral-300">•</span>
            <span className="text-[11px] text-neutral-400">White • Black • Gold (#CA8A04)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
