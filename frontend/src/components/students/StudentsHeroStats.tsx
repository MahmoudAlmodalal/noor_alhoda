"use client";

import { GraduationCap, UserCheck, UserX, Users } from "lucide-react";

interface StudentsHeroStatsProps {
  totalCount: number;
  presentTodayCount: number;
  unassignedCount: number;
}

export function StudentsHeroStats({
  totalCount,
  presentTodayCount,
  unassignedCount,
}: StudentsHeroStatsProps) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-primary via-[#0a4a85] to-[#083d73] p-6 text-white shadow-[0_10px_30px_-12px_rgba(11,83,148,0.45)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, white 1.5px, transparent 2px), radial-gradient(circle at 40% 85%, white 1.5px, transparent 2px)",
          backgroundSize: "80px 80px, 140px 140px, 100px 100px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -start-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-[#eabd5b]/15 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight">سجل الطلاب</h1>
            <p className="mt-0.5 text-sm text-white/80">
              إدارة ومتابعة جميع الطلاب المسجلين
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <HeroStatCard
            icon={<Users className="h-5 w-5" />}
            label="إجمالي الطلاب"
            value={totalCount}
          />
          <HeroStatCard
            icon={<UserCheck className="h-5 w-5" />}
            label="الحضور اليوم"
            value={presentTodayCount}
          />
          <HeroStatCard
            icon={<UserX className="h-5 w-5" />}
            label="طلاب بلا معلم"
            value={unassignedCount}
          />
        </div>
      </div>
    </div>
  );
}

function HeroStatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/15">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/20 text-white">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white/80">{label}</p>
        <p className="text-2xl font-black leading-tight text-white">{value}</p>
      </div>
    </div>
  );
}
