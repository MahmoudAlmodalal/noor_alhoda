"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <LayoutWrapper>{children}</LayoutWrapper>
    </ProtectedRoute>
  );
}
