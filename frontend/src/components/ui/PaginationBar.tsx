"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[16px] border border-border-card bg-white px-4 py-3 shadow-sm">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded-[10px] border border-border-subtle px-3 py-2 text-sm font-semibold text-text-body transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
        السابق
      </button>
      <span className="text-sm font-bold text-text-title">
        صفحة {page} من {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 rounded-[10px] border border-border-subtle px-3 py-2 text-sm font-semibold text-text-body transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        التالي
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
