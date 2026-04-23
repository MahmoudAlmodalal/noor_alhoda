"use client";

import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { UserProfile } from "@/types/api";

/**
 * After a successful login + initial download, ask the service worker to
 * pre-fetch every dashboard route shell into its runtime cache. This lets
 * a cold-start offline session navigate to any route, including ones the
 * user hasn't visited yet in this session.
 *
 * Each role gets a different set of routes — no point warming admin
 * pages for a student. The SW silently ignores routes the server 401s
 * (auth-gated), so over-listing is safe but wasteful.
 */
const ROUTES_BY_ROLE: Record<UserProfile["role"], string[]> = {
  admin: [
    "/",
    "/students",
    "/students/register",
    "/students-db",
    "/teachers",
    "/courses",
    "/attendance",
    "/plans",
    "/leaderboard",
    "/reports/attendance",
    "/notifications",
  ],
  teacher: [
    "/",
    "/attendance",
    "/plans",
    "/leaderboard",
    "/reports/attendance",
  ],
  parent: [
    "/",
    "/notifications",
  ],
  student: [
    "/student",
    "/student/tasks",
    "/student/achievements",
  ],
};

export function CacheWarmer() {
  const { user, dbUnlocked, needsInitialDownload } = useAuth();

  useEffect(() => {
    if (!user || !dbUnlocked || needsInitialDownload) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Only warm once per role-session. Avoid re-running on every render.
    const key = `_warmed_${user.role}`;
    if (sessionStorage.getItem(key)) return;

    const urls = ROUTES_BY_ROLE[user.role] ?? ["/"];
    const doWarm = async () => {
      const reg = await navigator.serviceWorker.ready;
      const target = reg.active ?? navigator.serviceWorker.controller;
      if (!target) return;
      target.postMessage({ type: "WARM_ROUTES", urls });
      sessionStorage.setItem(key, Date.now().toString());
    };
    void doWarm();
  }, [user, dbUnlocked, needsInitialDownload]);

  return null;
}
