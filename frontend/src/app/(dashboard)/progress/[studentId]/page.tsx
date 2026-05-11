"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, User } from "lucide-react";
import { useQuery } from "@/hooks/useApi";
import type { ProgressRecord } from "@/lib/db/repos/progress";
import { getStudent, type StudentRecord } from "@/lib/db/repos/students";
import { ProgressForm } from "@/components/progress/ProgressForm";
import { ProgressTable } from "@/components/progress/ProgressTable";
import { useAuth } from "@/contexts/AuthContext";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default function ProgressPage({ params }: PageProps) {
  const { studentId } = use(params);
  const { dbUnlocked } = useAuth();
  const [student, setStudent] = useState<StudentRecord | null>(null);

  // Fetch the student's basic info for the header
  useEffect(() => {
    if (!dbUnlocked || !studentId) return;
    getStudent(studentId).then((s) => setStudent(s ?? null));
  }, [dbUnlocked, studentId]);

  const { data: entries, isLoading } = useQuery<ProgressRecord[]>(
    "progress",
    { student_id: studentId }
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3 motion-fade-up">
        <Link
          href="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-surface-subtle text-text-muted transition-colors hover:bg-border-card hover:text-text-body"
          aria-label="العودة"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Link>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-[var(--text-h2)] font-bold leading-[var(--text-h2--line-height)] text-text-title">
              سجل تقدم الحفظ
            </h1>
            {student ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-[var(--text-small)] text-text-muted">
                <User className="h-3 w-3" />
                {student.full_name}
              </p>
            ) : (
              <div className="mt-1 h-4 w-32 rounded motion-skeleton" />
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <ProgressForm studentId={studentId} />

      {/* Table */}
      {isLoading ? (
        <div className="mt-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-[var(--radius-md)] motion-skeleton"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      ) : (
        <ProgressTable entries={entries ?? []} />
      )}
    </div>
  );
}
