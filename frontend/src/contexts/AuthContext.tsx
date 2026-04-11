"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { UserProfile } from "@/types/api";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone_number: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, validate existing token
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    // Only clear tokens if we are on the main login page, not sub-pages like forgot-password or reset-password
    if (window.location.pathname === "/login") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    api.me().then((res) => {
      if (res.success) {
        const data = res.data;
        setUser({
          id: data.id as string,
          phone_number: data.phone_number as string,
          role: data.role as UserProfile["role"],
          full_name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || (data.full_name as string),
          student_profile: data.student_profile as UserProfile["student_profile"],
          teacher_profile: data.teacher_profile as UserProfile["teacher_profile"],
          parent_profile: data.parent_profile as UserProfile["parent_profile"],
        });
      } else {
        // Only clear tokens if it's a definitive 401/403 auth error
        if (res.error && (res.error.code === 401 || res.error.code === 403)) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      }
    }).catch(() => {
      // Network error, keep tokens
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (phone_number: string, password: string): Promise<string | null> => {
    const res = await api.login({ phone_number, password });
    if (res.success) {
      // After successful login, we should fetch the full profile to get student_profile/teacher_profile IDs
      const meRes = await api.me();
      if (meRes.success) {
        const data = meRes.data;
        setUser({
          id: data.id as string,
          phone_number: data.phone_number as string,
          role: data.role as UserProfile["role"],
          full_name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || (data.full_name as string),
          student_profile: data.student_profile as UserProfile["student_profile"],
          teacher_profile: data.teacher_profile as UserProfile["teacher_profile"],
          parent_profile: data.parent_profile as UserProfile["parent_profile"],
        });
      } else {
        // If profile fetch fails but login succeeded, use basic user data from login response
        // This prevents the user from being stuck if their profile is missing but account exists
        setUser(res.data.user);
      }
      return null; // no error
    }
    return res.error.message;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
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
