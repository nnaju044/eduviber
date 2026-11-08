import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { studentApi } from "../api/studentApi.js";
import { teacherApi } from "../api/teacherApi.js";

/**
 * NotificationBell
 * Renders in-app notification bell with real-time unread badge, dropdown list,
 * and mark-as-read interactions for teachers and students.
 */
export default function NotificationBell() {
  const { isTeacher, isStudent } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const api = isTeacher ? teacherApi : isStudent ? studentApi : null;

  const fetchNotifications = async () => {
    if (!api) return;
    try {
      const data = await api.getNotifications();
      if (data) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (_) { }
  };

  useEffect(() => {
    if (api) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // 30s poll
      return () => clearInterval(interval);
    }
  }, [isTeacher, isStudent]);

  const handleMarkAllRead = async () => {
    if (!api) return;
    try {
      await api.markNotificationAsRead("all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (_) { }
  };

  const handleItemClick = async (notif) => {
    if (!notif.isRead && api) {
      try {
        await api.markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (_) { }
    }
  };

  if (!api) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:text-black hover:border-neutral-300 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="View notifications"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#CA8A04] text-white font-extrabold text-[10px] min-w-[18px] text-center shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-neutral-200 shadow-dropdown z-50 overflow-hidden text-left">
            <div className="p-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs text-black uppercase tracking-wider">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#CA8A04]/10 text-[#CA8A04] text-[10px] font-bold">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-[#CA8A04] hover:text-[#A16207] transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  <span className="text-2xl block mb-2">🔔</span>
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`p-3.5 transition-colors cursor-pointer ${n.isRead ? "bg-white hover:bg-neutral-50" : "bg-[#CA8A04]/5 hover:bg-[#CA8A04]/10"
                      }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? "bg-transparent" : "bg-[#CA8A04]"
                          }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-neutral-900 truncate">{n.title}</p>
                          <span className="text-[10px] text-neutral-400 shrink-0">
                            {new Date(n.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
