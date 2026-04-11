"use client";

import { useState } from "react";
import { Bell, CheckCheck, Megaphone } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/contexts/AuthContext";
import { AnnounceModal } from "@/components/notifications/AnnounceModal";
import { PageLoading } from "@/components/ui/LoadingSpinner";

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffSec = Math.round((Date.now() - then) / 1000);
    if (diffSec < 60) return "الآن";
    if (diffSec < 3600) return `قبل ${Math.floor(diffSec / 60)} دقيقة`;
    if (diffSec < 86400) return `قبل ${Math.floor(diffSec / 3600)} ساعة`;
    return `قبل ${Math.floor(diffSec / 86400)} يوم`;
  } catch {
    return "";
  }
}

export default function NotificationsPage() {
  const { items, unreadCount, isLoading, markRead, markAllRead, refetch } = useNotifications();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [announceOpen, setAnnounceOpen] = useState(false);

  if (isLoading && items.length === 0) return <PageLoading />;

  const filtered = filter === "unread" ? items.filter((n) => !n.is_read) : items;
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">الإشعارات</h1>
            <p className="text-xs text-slate-500">{unreadCount} غير مقروءة</p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAnnounceOpen(true)}
            className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 flex items-center gap-2"
          >
            <Megaphone className="w-4 h-4" />
            إرسال إعلان
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === "all"
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === "unread"
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              غير مقروء
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />
              تعيين الكل كمقروء
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">لا توجد إشعارات</p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.is_read && markRead(n.id)}
                className={`w-full text-start px-5 py-4 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                  !n.is_read ? "bg-blue-50/40" : ""
                }`}
              >
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-800">{n.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{n.body}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{relativeTime(n.created_at)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {isAdmin && (
        <AnnounceModal
          isOpen={announceOpen}
          onClose={() => setAnnounceOpen(false)}
          onSent={refetch}
        />
      )}
    </div>
  );
}
