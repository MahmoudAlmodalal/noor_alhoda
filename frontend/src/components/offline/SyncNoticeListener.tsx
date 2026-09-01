"use client";

import { useEffect } from "react";

import { useToast } from "@/contexts/ToastContext";
import { onSyncNotice } from "@/lib/sync/notices";

/**
 * Bridges sync-layer notices (see `lib/sync/notices.ts`) to the toast UI so a
 * write the server refused or overrode is never lost in silence.
 */
export function SyncNoticeListener() {
  const { showToast } = useToast();

  useEffect(() => onSyncNotice(({ message, type }) => showToast(message, type)), [showToast]);

  return null;
}
