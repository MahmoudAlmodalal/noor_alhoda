"use client";

import { useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (body: string) => Promise<void>;
  isSubmitting: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  isSubmitting,
  placeholder = "اكتب رسالتك هنا...",
}: ChatInputProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || isSubmitting) return;
    setBody("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    // Auto-grow textarea
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex items-end gap-2 p-3 bg-white border-t border-border-card">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={isSubmitting}
        aria-label="حقل كتابة الرسالة"
        className="flex-1 resize-none rounded-xl border border-border-subtle bg-surface-subtle/80 px-4 py-3 text-sm text-text-body placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px] max-h-[120px] overflow-y-auto transition-all disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={!body.trim() || isSubmitting}
        aria-label="إرسال الرسالة"
        className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
