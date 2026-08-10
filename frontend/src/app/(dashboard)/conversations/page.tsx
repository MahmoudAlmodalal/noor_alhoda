"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Clock, ChevronLeft } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { Avatar } from "@/components/ui/Avatar";
import { fetchConversations, type ConversationSummary } from "@/lib/api";

function relativeTime(iso: string): string {
  try {
    const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return "الآن";
    if (diffSec < 3600) return `قبل ${Math.floor(diffSec / 60)} دقيقة`;
    if (diffSec < 86400) return `قبل ${Math.floor(diffSec / 3600)} ساعة`;
    return `قبل ${Math.floor(diffSec / 86400)} يوم`;
  } catch {
    return "";
  }
}

const roleLabelMap: Record<string, string> = {
  teacher: "المحفظ",
  student: "الطالب",
  admin: "المدير",
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchConversations();
    if (res.success && res.data) {
      setConversations(res.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-border-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">المحادثات</h1>
            <p className="text-xs text-text-muted">
              {totalUnread > 0
                ? `${totalUnread} رسالة غير مقروءة`
                : "كل الرسائل مقروءة"}
            </p>
          </div>
        </div>
      </div>

      {/* قائمة المحادثات */}
      <div className="bg-white rounded-[24px] shadow-sm border border-border-card overflow-hidden">
        {isLoading ? (
          <div className="py-16">
            <PageLoading />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-primary/40" />
            </div>
            <p className="text-sm text-text-muted font-medium">
              لا توجد محادثات بعد
            </p>
            <p className="text-xs text-text-muted">
              ابدأ محادثة بإرسال رسالة لأحد الطلاب
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-card">
            {conversations.map((conv) => (
              <li key={conv.student_id}>
                <Link
                  href={`/students/${conv.student_id}/chat`}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-surface-subtle/60 transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar name={conv.student_name} size={46} />
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 bg-danger-text text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {conv.unread_count > 9 ? "9+" : conv.unread_count}
                      </span>
                    )}
                  </div>

                  {/* محتوى */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3
                        className={`text-sm truncate ${conv.unread_count > 0 ? "font-bold text-text-body" : "font-medium text-text-body"}`}
                      >
                        {conv.student_name}
                      </h3>
                      <div className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
                        <Clock className="w-3 h-3" />
                        {relativeTime(conv.last_message_at)}
                      </div>
                    </div>
                    <p className="text-xs text-text-muted truncate">
                      <span className="text-text-label font-medium">
                        {roleLabelMap[conv.last_sender_role] ?? ""}:{" "}
                      </span>
                      {conv.last_message}
                    </p>
                  </div>

                  <ChevronLeft className="w-4 h-4 text-text-muted shrink-0 rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
