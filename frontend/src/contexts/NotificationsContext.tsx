"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Notification, NotificationsPayload } from "@/types/api";

interface NotificationsContextValue {
  items: Notification[];
  unreadCount: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const POLL_INTERVAL_MS = 60_000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (!isAuthenticated || inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    const res = await api.get<NotificationsPayload | Notification[]>("/api/notifications/");
    if (res.success) {
      const payload = res.data as NotificationsPayload | Notification[];
      const list: Notification[] = Array.isArray(payload)
        ? payload
        : payload.items ?? payload.results ?? [];
      setItems(list);
      const unreadCount =
        "unread_count" in res && typeof res.unread_count === "number"
          ? res.unread_count
          : undefined;
      if (typeof unreadCount === "number") {
        setUnreadCount(unreadCount);
      } else {
        setUnreadCount(list.filter((n) => !n.is_read).length);
      }
    }
    setIsLoading(false);
    inFlight.current = false;
  }, [isAuthenticated]);

  const markRead = useCallback(
    async (id: string) => {
      const res = await api.patch(`/api/notifications/${id}/read/`);
      if (res.success) {
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    const res = await api.patch("/api/notifications/read-all/");
    if (res.success) {
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      const timeoutId = window.setTimeout(() => {
        setItems([]);
        setUnreadCount(0);
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    if (typeof window === "undefined") {
      return;
    }

    const refetchTimeoutId = window.setTimeout(() => {
      void refetch();
    }, 0);

    const onFocus = () => refetch();
    window.addEventListener("focus", onFocus);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(refetchTimeoutId);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, refetch]);

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
