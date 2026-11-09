import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppLayout({ showSidebar = true }) {
  const { isAuthenticated, isSuperAdmin, isTeacher } = useAuth();
  const shouldRenderSidebar = showSidebar && isAuthenticated;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const dashboardHref = isSuperAdmin ? "/app/admin" : isTeacher ? "/app/teacher" : "/app/student";

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 flex flex-col font-sans antialiased selection:bg-[#CA8A04] selection:text-white">
      {/* Top Bar with Mobile Drawer Trigger */}
      <Navbar onToggleMobileSidebar={shouldRenderSidebar ? () => setMobileSidebarOpen(true) : undefined} />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex max-w-full">
        {shouldRenderSidebar && (
          <Sidebar
            isOpen={mobileSidebarOpen}
            onClose={() => setMobileSidebarOpen(false)}
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Clean Light Footer */}
      <footer className="border-t border-neutral-200/80 bg-white py-6 px-4 sm:px-6 lg:px-8 text-xs text-neutral-500 safe-bottom">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black text-black">EDU<span className="text-[#CA8A04]">viber</span></span>
            <span className="text-neutral-300">•</span>
            <p>© 2026 EDUviber. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-5 text-neutral-600 font-semibold">
            <a href="/courses" className="hover:text-black transition-colors min-h-[44px] inline-flex items-center">
              Course Catalog
            </a>
            <span className="text-neutral-300">•</span>
            {isAuthenticated ? (
              <a href={dashboardHref} className="hover:text-black transition-colors min-h-[44px] inline-flex items-center">
                Dashboard
              </a>
            ) : (
              <a href="/app/login" className="hover:text-black transition-colors min-h-[44px] inline-flex items-center">
                Student Sign In
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
