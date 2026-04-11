"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Users, BookOpen, Star, PlusCircle, ClipboardCheck, Bell } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useMutation";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import type { DashboardStats, Notification } from "@/types/api";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useApi<DashboardStats>("/api/reports/dashboard/");
  const { data: notifData, isLoading: notifLoading, refetch: refetchNotifs } = useApi<{ unread_count: number; data: Notification[] }>("/api/notifications/");
  const { mutate: markRead } = useMutation<void>("patch");
  const { mutate: markAllRead } = useMutation<void>("patch", "/api/notifications/read-all/");

  const isLoading = statsLoading || notifLoading;

  if (isLoading) return <PageLoading />;

  const notifications = notifData?.data?.slice(0, 5) ?? [];
  const unreadCount = notifData?.unread_count ?? 0;

  const handleNotifClick = async (notif: Notification) => {
    if (notif.is_read) return;
    const res = await markRead(undefined, { endpoint: `/api/notifications/${notif.id}/read/`, successMessage: " " });
    if (res !== null) refetchNotifs();
  };

  const handleMarkAllRead = async () => {
    const res = await markAllRead(undefined, { successMessage: "تم تعليم الكل كمقروء" });
    if (res !== null) refetchNotifs();
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Welcome Section */}
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-2xl font-bold text-primary">
          مرحباً، {user?.full_name || "مدير المركز"}
        </h1>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          نسأل الله لك التوفيق في إدارة هذه المؤسسة المباركة
        </p>
        <div className="mt-4 inline-flex items-center gap-2 border border-[#e6b150] text-[#0a528e] font-semibold bg-[#fffcf4] px-4 py-2 rounded-xl text-sm">
          <span>العام الدراسي الحالي 1447هـ - 2026م</span>
          <BookOpen className="w-4 h-4 text-[#e6b150]" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex flex-col gap-4">
        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <CardContent className="p-0 flex items-center justify-between p-5">
            <div className="text-start">
              <p className="text-xs text-slate-500 font-medium mb-1">عدد الطلاب المسجلين</p>
              <h2 className="text-4xl font-black text-primary">{stats?.total_students ?? 0}</h2>
            </div>
            <div className="bg-[#eef3f8] w-14 h-14 rounded-full flex items-center justify-center">
              <Users className="w-7 h-7 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <CardContent className="p-0 flex items-center justify-between p-5">
            <div className="text-start">
              <p className="text-xs text-slate-500 font-medium mb-1">عدد المحفظين</p>
              <h2 className="text-4xl font-black text-[#e6b150]">{stats?.total_teachers ?? 0}</h2>
            </div>
            <div className="bg-[#fcf8ef] w-14 h-14 rounded-full flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-[#e6b150]" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <CardContent className="p-0 flex items-center justify-between p-5">
            <div className="text-start">
              <p className="text-xs text-slate-500 font-medium mb-1">الحضور اليوم</p>
              <h2 className="text-4xl font-black text-primary">{stats?.today?.present ?? 0}</h2>
            </div>
            <div className="bg-[#eef3f8] w-14 h-14 rounded-full flex items-center justify-center">
              <Star className="w-7 h-7 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/students/register" className="flex flex-col items-center justify-center bg-primary text-white rounded-2xl p-4 shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full border-b border-l border-white/5" />
          <PlusCircle className="w-8 h-8 z-10" />
          <div className="text-center z-10">
            <span className="block font-bold text-sm mb-0.5">تسجيل طالب جديد</span>
            <span className="block text-[10px] text-white/80 max-w-[100px]">إضافة طالب جديد إلى المركز وإصدار بطاقته</span>
          </div>
        </Link>

        <Link href="/rings" className="flex flex-col items-center justify-center bg-[#e6b150] text-white rounded-2xl p-4 shadow-md shadow-[#e6b150]/20 hover:bg-[#e6b150]/90 transition-colors gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full border-b border-l border-white/5" />
          <BookOpen className="w-8 h-8 z-10" />
          <div className="text-center z-10">
            <span className="block font-bold text-sm mb-0.5">تسجيل حلقة جديدة</span>
            <span className="block text-[10px] text-white/80 max-w-[100px]">إنشاء حلقة للتحفيظ والمراجعة</span>
          </div>
        </Link>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-t-3xl border-x border-t border-slate-100 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] pt-6 pb-8 px-5 rounded-b-3xl -mx-4 md:mx-0">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-slate-900 relative pe-4">
            أحدث النشاطات والإشعارات
            <div className="absolute top-0 bottom-0 right-0 w-1 bg-primary rounded-full" />
          </h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-primary font-semibold hover:underline shrink-0"
            >
              تعليم الكل كمقروء
            </button>
          )}
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">لا توجد إشعارات حديثة</p>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleNotifClick(notif)}
                disabled={notif.is_read}
                className={`w-full flex justify-between items-center p-4 rounded-xl text-right transition-opacity ${
                  notif.is_read ? "bg-slate-50/60 opacity-60 cursor-default" : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <p className="text-sm text-slate-800 font-medium">{notif.title}</p>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0 ms-3">
                  {notif.type === "absence" ? (
                    <ClipboardCheck className="w-4 h-4 text-[#9333ea]" />
                  ) : (
                    <Bell className="w-4 h-4 text-primary" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
