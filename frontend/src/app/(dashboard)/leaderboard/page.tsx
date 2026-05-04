"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Medal } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { SectionCard } from "@/components/ui/SectionCard";
import { Avatar } from "@/components/ui/Avatar";
import { useQuery } from "@/hooks/useApi";
import type { LeaderboardEntry } from "@/types/api";

const PODIUM_STYLES = [
  { tile: "bg-tile-yellow", icon: "text-secondary" },
  { tile: "bg-border-card", icon: "text-text-muted" },
  { tile: "bg-tile-red",    icon: "text-[#c2410c]" },
] as const;

function LeaderboardContent() {
  const router = useRouter();

  const { data, isLoading } = useQuery<LeaderboardEntry[]>("leaderboard");

  const entries = data ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <SectionCard padding="lg" className="flex items-center gap-4">
        <div className="w-12 h-12 bg-tile-yellow rounded-[14px] flex items-center justify-center">
          <Trophy className="w-6 h-6 text-secondary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary">لوحة الشرف</h1>
          <p className="text-xs text-text-muted">المتميزون هذا الأسبوع</p>
        </div>
      </SectionCard>

      {isLoading && entries.length === 0 ? (
        <PageLoading />
      ) : entries.length === 0 ? (
        <SectionCard padding="lg" className="py-12 text-center">
          <p className="text-sm text-text-muted">لا توجد بيانات</p>
        </SectionCard>
      ) : (
        <>
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {top3.map((entry, idx) => {
                const style = PODIUM_STYLES[idx];
                return (
                  <button
                    key={entry.student_id}
                    type="button"
                    onClick={() => router.push(`/students/${entry.student_id}`)}
                    className="bg-white rounded-[16px] p-3 sm:p-5 border border-border-card shadow-sm text-center hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-[14px] flex items-center justify-center mx-auto mb-2 sm:mb-3 ${style.tile}`}>
                      <Medal className={`w-5 h-5 sm:w-6 sm:h-6 ${style.icon}`} />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-text-body leading-tight break-words mb-1 min-h-[2.5rem] sm:min-h-0">{entry.student_name}</h3>
                    <p className="text-2xl sm:text-[30px] font-bold leading-tight sm:leading-9 text-primary">{entry.score}</p>
                    <p className="text-[11px] text-text-muted mt-1">
                      {entry.total_achieved} آية · {entry.present_days} يوم
                    </p>
                    {entry.ring_name && (
                      <p className="text-[11px] text-text-muted mt-1 line-clamp-1">{entry.ring_name}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {rest.length > 0 && (
            <SectionCard padding="none" className="overflow-hidden">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-text-muted bg-surface-subtle">
                  <tr>
                    <th className="px-4 py-3 font-bold">الترتيب</th>
                    <th className="px-4 py-3 font-bold">الاسم</th>
                    <th className="px-4 py-3 font-bold">الحلقة</th>
                    <th className="px-4 py-3 font-bold">النقاط</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((entry) => (
                    <tr
                      key={entry.student_id}
                      className="border-b border-border-card hover:bg-surface-subtle cursor-pointer"
                      onClick={() => router.push(`/students/${entry.student_id}`)}
                    >
                      <td className="px-4 py-3 font-bold text-text-label">#{entry.rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={entry.student_name} size={32} />
                          <span className="font-bold text-text-body">{entry.student_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-label">{entry.ring_name || "—"}</td>
                      <td className="px-4 py-3 font-bold text-primary">{entry.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LeaderboardContent />
    </Suspense>
  );
}
