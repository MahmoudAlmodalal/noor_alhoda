import { cn } from "@/lib/utils";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="space-y-4 max-w-lg mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded-xl w-48 mx-auto" />
      <div className="h-4 bg-slate-100 rounded-lg w-64 mx-auto" />
      <div className="space-y-4 mt-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-slate-100 rounded-lg w-3/4" />
                <div className="h-3 bg-slate-50 rounded-lg w-1/2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-slate-50 rounded-xl" />
              <div className="h-16 bg-slate-50 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
