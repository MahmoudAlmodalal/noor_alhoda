"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Medal } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useQuery } from "@/hooks/useApi";
import type { LeaderboardEntry } from "@/types/api";

function LeaderboardContent() {
  const router = useRouter();

  const { data, isLoading } = useQuery<LeaderboardEntry[]>("leaderboard");

  const entries = data ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
          <Trophy className="w-6 h-6 text-yellow-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary">لوحة الشرف</h1>
          <p className="text-xs text-slate-500">المتميزون هذا الأسبوع</p>
        </div>
      </div>

      {isLoading && entries.length === 0 ? (
        <PageLoading />
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-sm text-slate-400">لا توجد بيانات</p>
        </div>
      ) : (
        <>
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {top3.map((entry, idx) => {
                const colors = ["bg-yellow-50 text-yellow-600", "bg-slate-100 text-slate-500", "bg-orange-50 text-orange-600"];
                return (
                  <button
                    key={entry.student_id}
                    type="button"
                    onClick={() => router.push(`/students/${entry.student_id}`)}
                    className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center hover:border-primary/30 transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${colors[idx]}`}>
                      <Medal className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 mb-1 line-clamp-1">{entry.student_name}</h3>
                    <p className="text-2xl font-black text-primary">{entry.total_achieved}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {entry.total_required > 0 ? `${entry.total_required} مطلوب` : `${entry.present_days} يوم حضور`}
                    </p>
                    {entry.ring_name && (
                      <p className="text-[10px] text-slate-400 mt-1">{entry.ring_name}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {rest.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-slate-500 bg-slate-50/80">
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
                      className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                      onClick={() => router.push(`/students/${entry.student_id}`)}
                    >
                      <td className="px-4 py-3 font-bold text-slate-700">#{entry.rank}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{entry.student_name}</td>
                      <td className="px-4 py-3 text-slate-600">{entry.ring_name || "—"}</td>
                      <td className="px-4 py-3 font-bold text-primary">{entry.total_achieved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
