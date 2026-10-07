"use client";

import { useEffect, useState } from "react";

/**
 * Bo'limlar orasida o'tganda kontent maydoni bo'sh qolmasligi uchun ingichka
 * progress panel. To'liq ekran skeletoni esa har o'tishda "alohida yuklash"
 * taassurotini qoldirardi.
 */
export function AdminTopProgress({ label = "Yuklanmoqda" }: { label?: string }) {
  const [pct, setPct] = useState(12);

  useEffect(() => {
    const t = setInterval(() => {
      // 90% gacha sekin progress, oxirida to'liq bo'ladi
      setPct((p) => (p >= 90 ? 92 : p + Math.max(2, Math.round((90 - p) / 6))));
    }, 180);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="sticky top-0 z-20" role="status" aria-live="polite" aria-label={label}>
      <div className="h-1 w-full bg-blue-200/50">
        <div
          className="h-full bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-2 border-b border-blue-200/50 bg-[#EAF1FE]/80 px-8 py-2.5 backdrop-blur-sm">
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" aria-hidden="true" />
        <span className="text-xs font-semibold text-blue-900">{label}...</span>
        <span className="tabular-nums text-[11px] font-bold text-blue-700/70">{pct}%</span>
      </div>
    </div>
  );
}
