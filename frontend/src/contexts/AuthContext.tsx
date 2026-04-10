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
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
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
          full_name: data.full_name as string,
        });
      } else {
        // Token is invalid or expired, clear it
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
      setIsLoading(false);
    }).catch(() => {
      // Network error or other issue, clear tokens to be safe
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (phone_number: string, password: string): Promise<string | null> => {
    const res = await api.login({ phone_number, password });
    if (res.success) {
      setUser(res.data.user);
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
