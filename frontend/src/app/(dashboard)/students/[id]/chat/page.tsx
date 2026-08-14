"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchConversationMessages,
  sendConversationReply,
  type ChatMessage,
} from "@/lib/api";
import { useQuery } from "@/hooks/useApi";
import type { StudentWithTeacher } from "@/hooks/queries";
import { useToast } from "@/contexts/ToastContext";

export default function StudentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // جلب اسم الطالب
  const { data: student } = useQuery<StudentWithTeacher>("student", { id });

  // جلب الرسائل
  const loadMessages = useCallback(async () => {
    const res = await fetchConversationMessages(id);
    if (res.success && res.data) {
      setMessages(res.data);
    }
    setLoadingMessages(false);
  }, [id]);

  // التحميل الأول
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMessages();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadMessages]);

  // Auto-scroll لآخر رسالة
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Polling كل 10 ثوان
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      void loadMessages();
    }, 10_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadMessages]);

  const handleSend = async (body: string) => {
    setIsSubmitting(true);
    const res = await sendConversationReply(id, body);
    setIsSubmitting(false);
    if (!res.success) {
      showToast(res.error?.message ?? "حدث خطأ أثناء الإرسال.", "error");
      return;
    }
    // إعادة تحميل الرسائل بعد الإرسال
    await loadMessages();
  };

  const myUserId = user?.id ?? "";

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-border-card px-4 py-3 flex items-center gap-3 rounded-t-[24px] shadow-sm">
        <Link
          href="/conversations"
          className="p-2 rounded-xl hover:bg-surface-subtle transition-colors text-text-muted hover:text-primary"
          aria-label="عودة للمحادثات"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
        </Link>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-text-body truncate">
              {student?.full_name ?? "..."}
            </h1>
            <p className="text-[10px] text-text-muted">محادثة خاصة</p>
          </div>
        </div>
      </div>

      {/* منطقة الرسائل */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-surface-subtle/40">
        {loadingMessages ? (
          <PageLoading />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-primary/50" />
            </div>
            <p className="text-sm text-text-muted font-medium">
              لا توجد رسائل بعد
            </p>
            <p className="text-xs text-text-muted">
              ابدأ المحادثة بإرسال رسالة
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                body={msg.body}
                senderName={msg.sender_name}
                senderRole={msg.sender_role}
                createdAt={msg.created_at}
                isMine={msg.sender_id === myUserId}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* حقل الإدخال */}
      <ChatInput onSend={handleSend} isSubmitting={isSubmitting} />
    </div>
  );
}
