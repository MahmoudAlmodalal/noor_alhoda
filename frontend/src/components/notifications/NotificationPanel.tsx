"use client";

import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import type { Notification } from "@/types/api";

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

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { items, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const top = items.slice(0, 8);

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    onClose();
  };

  return (
    <div className="absolute end-0 mt-2 w-80 bg-white rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] border border-border-card z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-card">
        <h3 className="font-bold text-text-body text-sm">الإشعارات</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" />
            تعيين الكل كمقروء
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading && top.length === 0 ? (
          <p className="text-center text-xs text-text-muted py-6">جاري التحميل...</p>
        ) : top.length === 0 ? (
          <p className="text-center text-xs text-text-muted py-6">لا توجد إشعارات</p>
        ) : (
          top.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className={`w-full text-start px-4 py-3 border-b border-border-card hover:bg-surface-subtle transition-colors ${
                !n.is_read ? "bg-tile-blue/60" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-text-body truncate">{n.title}</h4>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-text-muted mt-1">{relativeTime(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <Link
        href="/notifications"
        onClick={onClose}
        className="block text-center py-2.5 bg-surface-subtle text-primary text-xs font-bold hover:bg-border-card transition-colors"
      >
        عرض كل الإشعارات
      </Link>
    </div>
  );
}
