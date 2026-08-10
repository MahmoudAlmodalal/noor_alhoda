"use client";

interface ChatBubbleProps {
  body: string;
  senderName: string;
  senderRole: "teacher" | "student" | "admin";
  createdAt: string;
  isMine: boolean;
}

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

export function ChatBubble({
  body,
  senderName,
  senderRole,
  createdAt,
  isMine,
}: ChatBubbleProps) {
  const roleLabel =
    senderRole === "teacher"
      ? "المحفظ"
      : senderRole === "student"
        ? "الطالب"
        : "المدير";

  return (
    <div className={`flex ${isMine ? "justify-start" : "justify-end"} mb-3`}>
      <div
        className={`max-w-[75%] group ${isMine ? "items-start" : "items-end"} flex flex-col gap-1`}
      >
        {/* اسم المرسل */}
        <span className="text-[10px] font-semibold text-text-muted px-1">
          {isMine ? "أنت" : `${senderName} (${roleLabel})`}
        </span>

        {/* فقاعة الرسالة */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isMine
              ? "bg-primary text-white rounded-tr-sm"
              : "bg-white border border-border-card text-text-body rounded-tl-sm"
          }`}
        >
          {body}
        </div>

        {/* الوقت */}
        <span className="text-[10px] text-text-muted px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {relativeTime(createdAt)}
        </span>
      </div>
    </div>
  );
}
