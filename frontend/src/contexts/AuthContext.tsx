"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  clearSessionKey,
  hasCachedAuth,
  initializeOrUnlockSession,
  readAuth,
  restoreSessionKey,
  unlockOffline,
} from "@/lib/db/auth";
import { wipeDb } from "@/lib/db/schema";
import { downloadFullDb, type DownloadProgress } from "@/lib/sync/download";
import { startSyncRunner, stopSyncRunner } from "@/lib/sync/runner";
import type { UserProfile } from "@/types/api";

// Auto-retry for the initial background download. Manual retry resets
// the counter; the watchdog inside downloadFullDb handles per-request
// timeouts, so these values only govern how quickly we recover from a
// server that bounces between up/down.
const MAX_AUTO_RETRIES = 4;
const RETRY_BASE_MS = 2_000;
const RETRY_CAP_MS = 30_000;

// Logout keeps the encrypted local DB on-device so the same user can
// re-login offline. A different user on the same device triggers a wipe
// inside `initializeOrUnlockSession` (OFFLINE_LOGIN_USER_MISMATCH guard).
// Explicit wipe is exposed via `wipeDeviceData()`.

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * True when the user is authenticated AND the encrypted local DB has
   * been unlocked in this tab. Repos throw when this is false.
   */
  dbUnlocked: boolean;
  /**
   * True while the offline DB key is being derived/unwrapped in the
   * background after a successful online login. The dashboard renders
   * normally; `useQuery` returns null until this flips to false and
   * `dbUnlocked` becomes true.
   */
  isInstallingDb: boolean;
  isOfflineSession: boolean;
  /**
   * True when we just logged this user in AND no prior sync has landed on
   * this device (`auth.last_sync_at === null`). While true, a background
   * download is in flight (see `isDownloading`) and `InitialDownloadBanner`
   * shows progress without blocking the dashboard.
   */
  needsInitialDownload: boolean;
  markInitialDownloadComplete: () => void;
  /** True while `downloadFullDb()` is actively running in the background. */
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
  /** User-initiated retry from the banner; resets the auto-retry counter. */
  retryInitialDownload: () => void;
  login: (
    national_id: string,
    password: string
  ) => Promise<{ error: string | null; role: string | null; offline: boolean }>;
  logout: () => Promise<void>;
  /** Explicit, user-initiated wipe of the encrypted IndexedDB on this device. */
  wipeDeviceData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbUnlocked, setDbUnlocked] = useState(false);
  const [isInstallingDb, setIsInstallingDb] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [needsInitialDownload, setNeedsInitialDownload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Bumping `runToken` re-arms the initial-download effect. Used by both
  // the auto-retry scheduler and the manual retry button.
  const [runToken, setRunToken] = useState(0);
  const autoAttemptRef = useRef(0);
  const inFlightRef = useRef(false);

  // Fetch server profile and hydrate user state.
  const fetchMe = useCallback(async (): Promise<boolean> => {
    const res = await api.me();
    if (res.success) {
      const data = res.data;
      setUser({
        id: data.id as string,
        national_id: data.national_id as string,
        phone_number: data.phone_number as string,
        role: data.role as UserProfile["role"],
        full_name:
          `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
          (data.full_name as string),
        student_profile: data.student_profile as UserProfile["student_profile"],
        teacher_profile: data.teacher_profile as UserProfile["teacher_profile"],
        parent_profile: data.parent_profile as UserProfile["parent_profile"],
      });
      return true;
    }
    if (res.error?.code === 401 || res.error?.code === 403) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    return false;
  }, []);

  const markInitialDownloadComplete = useCallback(() => {
    setNeedsInitialDownload(false);
    startSyncRunner();
  }, []);

  // Kick off the initial full-DB download as a background task whenever
  // the app determines this is the first login on this device and the DB
  // is unlocked. Pages render with their existing empty states and
  // populate via `emitChanges` → `useQuery` as tables are upserted. The
  // banner component (`InitialDownloadBanner`) reads download state from
  // this context and renders a non-blocking progress strip.
  useEffect(() => {
    if (!needsInitialDownload || !dbUnlocked || isOfflineSession) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    let cancelled = false;
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ phase: "downloading", percent: 0 });

    void (async () => {
      try {
        const result = await downloadFullDb((p) => {
          if (!cancelled) setDownloadProgress(p);
        });
        if (cancelled) return;
        if (result.ok) {
          autoAttemptRef.current = 0;
          setDownloadError(null);
          setIsDownloading(false);
          setDownloadProgress(null);
          markInitialDownloadComplete();
        } else {
          setDownloadError(result.error ?? "فشل التنزيل.");
          setIsDownloading(false);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[AuthContext] initial download threw:", err);
        setDownloadError(err instanceof Error ? err.message : String(err));
        setIsDownloading(false);
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    needsInitialDownload,
    dbUnlocked,
    isOfflineSession,
    runToken,
    markInitialDownloadComplete,
  ]);

  // Auto-retry on error with exponential backoff, capped at MAX_AUTO_RETRIES.
  // After the cap, only `retryInitialDownload` (manual button) re-arms.
  useEffect(() => {
    if (!downloadError || isOfflineSession) return;
    if (autoAttemptRef.current >= MAX_AUTO_RETRIES) return;
    const delay = Math.min(
      RETRY_BASE_MS * 2 ** autoAttemptRef.current,
      RETRY_CAP_MS
    );
    autoAttemptRef.current += 1;
    const id = setTimeout(() => {
      setDownloadError(null);
      setRunToken((t) => t + 1);
    }, delay);
    return () => clearTimeout(id);
  }, [downloadError, isOfflineSession]);

  const retryInitialDownload = useCallback(() => {
    autoAttemptRef.current = 0;
    setDownloadError(null);
    setRunToken((t) => t + 1);
  }, []);

  // On boot: if tokens exist and network is available, refresh user from
  // /me. DB remains locked until the user logs in (enters password).
  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      if (typeof window === "undefined") {
        if (isMounted) setIsLoading(false);
        return;
      }

      const token = localStorage.getItem("access_token");
      if (!token) {
        // No tokens → must log in again. Drop any stale session key so the
        // next user on this tab can't reuse a dangling unlock.
        clearSessionKey();
        if (isMounted) setIsLoading(false);
        return;
      }

      // Restore the DB key from sessionStorage if this is a reload within the
      // same tab. Hydrate user state from the cached auth row so pages render
      // immediately instead of bouncing to /login.
      const restored = await restoreSessionKey();
      if (restored) {
        const row = await readAuth();
        if (row && isMounted) {
          setUser({
            id: row.user_id,
            national_id: row.user_national_id,
            phone_number: "",
            role: row.user_role as UserProfile["role"],
            full_name: "",
          });
          setDbUnlocked(true);
          setIsOfflineSession(false);
          if (row.last_sync_at === null) {
            setNeedsInitialDownload(true);
          } else {
            startSyncRunner();
          }
        } else if (!row) {
          clearSessionKey();
        }
      } else {
        // Token exists but no session key could be restored. This happens if
        // (a) the tab was closed and reopened (sessionStorage cleared), or
        // (b) the page was reloaded mid-login before persistSessionKey() had
        // run. Either way the DB is locked and we no longer have the password
        // needed to unwrap it — force a fresh login.
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        if (isMounted) setIsLoading(false);
        if (typeof window !== "undefined") {
          window.location.href = "/login?reason=install_interrupted";
        }
        return;
      }

      // Refresh the user from /me (with retry for transient network errors).
      // On success, server data overrides the minimal state we set from IDB.
      // On 401/403, fetchMe clears tokens; on network failure we keep them so
      // the sync runner can retry once connectivity returns.
      const MAX_RETRIES = 2;
      const RETRY_DELAY_MS = 1500;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (await fetchMe()) break;
          if (!localStorage.getItem("access_token")) break;
        } catch {
          // network error — fall through to retry
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      if (isMounted) setIsLoading(false);
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchMe]);

  // Background DB install: derives/unwraps the encrypted-DB key after the
  // online login has already resolved. Runs off the LoginForm's await, so
  // PBKDF2 + bcrypt no longer hold up the redirect to the dashboard. Any
  // failure here can't abort the redirect, so we clear state and bounce
  // back to /login with a reason code instead.
  const installDbInBackground = useCallback(
    async (u: UserProfile, password: string) => {
      try {
        console.time("[AuthContext] DB install");
        console.log("[AuthContext] Starting DB install for user", u.national_id);

        // Guard against a hung crypto/IDB operation with a timeout.
        const DB_INSTALL_TIMEOUT_MS = 60_000;
        const installPromise = initializeOrUnlockSession({
          password,
          userId: u.id,
          userNationalId: u.national_id,
          userRole: u.role,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("DB_INSTALL_TIMEOUT")),
            DB_INSTALL_TIMEOUT_MS
          )
        );
        await Promise.race([installPromise, timeoutPromise]);

        console.timeEnd("[AuthContext] DB install");
        console.log("[AuthContext] DB install succeeded, unlocking…");
        setDbUnlocked(true);
        setIsOfflineSession(false);

        void fetchMe();

        const row = await readAuth();
        if (row?.last_sync_at === null) {
          setNeedsInitialDownload(true);
        } else {
          startSyncRunner();
        }
      } catch (err) {
        console.error("[AuthContext] background DB install failed:", err);
        clearSessionKey();
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
        setDbUnlocked(false);
        if (typeof window !== "undefined") {
          window.location.href = "/login?reason=install_failed";
        }
      } finally {
        console.timeEnd("[AuthContext] DB install");
        setIsInstallingDb(false);
      }
    },
    [fetchMe]
  );

  const login = useCallback(
    async (
      national_id: string,
      password: string
    ): Promise<{ error: string | null; role: string | null; offline: boolean }> => {
      // 1. Try online login. Populates tokens on success.
      const res = await api.login({ national_id, password });

      if (res.success) {
        const u = res.data.user;
        // The login response already contains a full UserProfile (role +
        // role-specific profile), so the dashboard shell and RoleGate can
        // render with just this. Hand off the heavy crypto install to the
        // background so the LoginForm's spinner clears in ~1 RTT.
        setUser(u);
        setIsInstallingDb(true);
        void installDbInBackground(u, password);
        return { error: null, role: u.role, offline: false };
      }

      // 2. Online login failed. If it's a network error and we have a
      //    cached auth row for this national_id, try offline login.
      const isNetworkError = res.error.code === 0;
      if (isNetworkError && (await hasCachedAuth())) {
        try {
          const row = await unlockOffline({ password, userNationalId: national_id });
          // Offline login succeeded — hydrate minimal user state from cache.
          setUser({
            id: row.user_id,
            national_id: row.user_national_id,
            phone_number: "",
            role: row.user_role as UserProfile["role"],
            full_name: "",
          });
          setDbUnlocked(true);
          setIsOfflineSession(true);
          // Offline session with no prior sync = nothing to show; force a
          // user-visible message by flagging the download requirement. The
          // InitialDownloadBanner will show an offline hint until they reconnect.
          if (row.last_sync_at === null) {
            setNeedsInitialDownload(true);
          } else {
            startSyncRunner();
          }
          return { error: null, role: row.user_role, offline: true };
        } catch (err) {
          const code = err instanceof Error ? err.message : String(err);
          const message =
            code === "OFFLINE_LOGIN_INVALID_PASSWORD"
              ? "كلمة المرور غير صحيحة."
              : code === "OFFLINE_LOGIN_USER_MISMATCH"
                ? "رقم الهوية لا يطابق الحساب المسجّل على هذا الجهاز."
                : "تعذّر تسجيل الدخول دون اتصال. يجب تسجيل الدخول أونلاين أولاً.";
          return { error: message, role: null, offline: false };
        }
      }

      if (isNetworkError) {
        return {
          error: "يجب الاتصال بالإنترنت لتسجيل الدخول لأول مرة على هذا الجهاز.",
          role: null,
          offline: false,
        };
      }

      return { error: res.error.message, role: null, offline: false };
    },
    [installDbInBackground]
  );

  const logout = useCallback(async () => {
    stopSyncRunner();
    try {
      await api.logout();
    } catch {
      // Offline logout — just proceed to clear local state.
    }
    clearSessionKey();
    setDbUnlocked(false);
    setIsOfflineSession(false);
    setNeedsInitialDownload(false);
    setIsDownloading(false);
    setDownloadProgress(null);
    setDownloadError(null);
    autoAttemptRef.current = 0;
    setUser(null);
    // Keep the encrypted IndexedDB so the same user can re-login offline.
    // A different user triggers a wipe via initializeOrUnlockSession.
    window.location.href = "/login";
  }, []);

  const wipeDeviceData = useCallback(async () => {
    stopSyncRunner();
    try {
      await api.logout();
    } catch {
      // ignore
    }
    clearSessionKey();
    setDbUnlocked(false);
    setIsOfflineSession(false);
    setNeedsInitialDownload(false);
    setIsDownloading(false);
    setDownloadProgress(null);
    setDownloadError(null);
    autoAttemptRef.current = 0;
    setUser(null);
    try {
      await wipeDb();
    } catch {
      // non-fatal
    }
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        dbUnlocked,
        isInstallingDb,
        isOfflineSession,
        needsInitialDownload,
        markInitialDownloadComplete,
        isDownloading,
        downloadProgress,
        downloadError,
        retryInitialDownload,
        login,
        logout,
        wipeDeviceData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
