"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import type { UserProfile } from "@/types/api";

type Role = UserProfile["role"];

export function RoleGate({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (!isLoading && user && !allowed) {
      router.replace("/");
    }
  }, [isLoading, user, allowed, router]);

  if (isLoading) return <PageLoading />;
  if (!allowed) return null;
  return <>{children}</>;
}
