"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { runMutation } from "@/hooks/mutations";
import { triggerPush } from "@/lib/sync/push";
import type { NotificationRecord } from "@/hooks/queries";
import type { Notification } from "@/types/api";

interface NotificationsContextValue {
  items: Notification[];
  unreadCount: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const userId = user?.id ?? "";
  const { data: rows, isLoading, refetch: refetchQuery } = useQuery<NotificationRecord[]>(
    isAuthenticated && userId ? "notifications" : null,
    userId ? { user_id: userId } : undefined
  );

  const items: Notification[] = useMemo(
    () =>
      (rows ?? []).map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        is_read: r.is_read,
        created_at: r.created_at ?? "",
      })),
    [rows]
  );

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const refetch = useCallback(async () => {
    await refetchQuery();
  }, [refetchQuery]);

  const markRead = useCallback(
    async (id: string) => {
      const res = await runMutation({
        resource: "notification",
        action: "update",
        payload: { id, is_read: true },
      });
      if (res.ok) void triggerPush();
    },
    []
  );

  const markAllRead = useCallback(async () => {
    const unread = items.filter((n) => !n.is_read);
    for (const n of unread) {
      await runMutation({
        resource: "notification",
        action: "update",
        payload: { id: n.id, is_read: true },
      });
    }
    if (unread.length > 0) void triggerPush();
  }, [items]);

  return (
    <NotificationsContext.Provider
      value={{ items, unreadCount, isLoading, refetch, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
