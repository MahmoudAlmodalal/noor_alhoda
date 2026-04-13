"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <LayoutWrapper>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </LayoutWrapper>
    </ProtectedRoute>
  );
}
