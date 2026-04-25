"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isSubmitting?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  destructive = false,
  isSubmitting = false,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  // Synchronous reentry guard — setPending is async, so a fast double-click
  // can fire onConfirm twice before React re-renders. The ref closes that gap.
  const pendingRef = useRef(false);

  if (!isOpen) return null;

  const busy = pending || isSubmitting;

  const handleConfirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} className="max-w-sm">
      <h2 className="text-lg font-bold text-text-body mb-2">{title}</h2>
      <p className="text-sm text-text-muted mb-6 leading-relaxed">{message}</p>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={busy}
          className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-11 rounded-xl font-bold"
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={busy}
          className={cn(
            "flex-1 h-11 rounded-xl font-bold gap-2",
            destructive && "bg-red-500 hover:bg-red-600 text-white"
          )}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
