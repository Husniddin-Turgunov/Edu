// Admin bo'limlari orasida o'tganda darhol ko'rinadigan skeleton.
// Maqsad: bo'sh oq ekran (pause) paydo bo'lmasligi — kontent yuklanayotganini
// foydalanuvchi ko'rib turishi va o'tish on-time bo'lishi.
export function AdminSkeleton({ rows = 3, cards = 6 }: { rows?: number; cards?: number }) {
  return (
    <div className="p-8 max-w-[1600px]" role="status" aria-label="Yuklanmoqda">
      {/* Sarlavha */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-52 animate-pulse rounded-lg bg-blue-200/70" />
          <div className="h-3.5 w-80 animate-pulse rounded bg-blue-200/40" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-blue-200/60" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-blue-200/80" />
        </div>
      </div>

      {/* Filtr paneli */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-blue-200/50" />
        <div className="flex gap-1.5">
          <div className="h-9 w-16 animate-pulse rounded-lg bg-blue-200/60" />
          <div className="h-9 w-14 animate-pulse rounded-lg bg-blue-200/40" />
          <div className="h-9 w-14 animate-pulse rounded-lg bg-blue-200/40" />
        </div>
      </div>

      {/* Kartalar yoki jadval qatorlari */}
      {rows > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-blue-200/60 bg-white/70">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-blue-100/70 p-4 last:border-0">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-blue-200/70" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 animate-pulse rounded bg-blue-200/60" />
                <div className="h-3 w-64 animate-pulse rounded bg-blue-200/30" />
              </div>
              <div className="hidden gap-3 md:flex">
                <div className="h-8 w-24 animate-pulse rounded-lg bg-blue-200/40" />
                <div className="h-8 w-20 animate-pulse rounded-lg bg-blue-200/40" />
              </div>
              <div className="h-8 w-20 shrink-0 animate-pulse rounded-lg bg-blue-200/60" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-blue-200/60 bg-white/70">
              <div className="h-28 animate-pulse bg-blue-200/60" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-blue-200/60" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-blue-200/50" />
                <div className="h-3 w-full animate-pulse rounded bg-blue-200/30" />
              </div>
            </div>
          ))}
        </div>
      )}

      <span className="sr-only">Yuklanmoqda...</span>
    </div>
  );
}
