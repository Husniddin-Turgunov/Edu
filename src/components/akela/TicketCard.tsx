"use client";

import Link from "next/link";
import { ReactNode } from "react";

type TicketCardProps = {
  href?: string;
  icon: ReactNode;
  gradient: string;
  numberLabel: string; // e.g. "01"
  topLeftBadge?: ReactNode;
  topRightLabel?: string; // e.g. "47 kun"
  /** topRightLabel uchun hover izohi (masalan, cheklov tafsiloti) */
  topRightTitle?: string;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
  // admin actions
  adminActions?: ReactNode;
};

export function TicketCard({
  href,
  icon,
  gradient,
  numberLabel,
  topLeftBadge,
  topRightLabel,
  topRightTitle,
  title,
  description,
  footer,
  onClick,
  className = "",
  adminActions,
}: TicketCardProps) {
  const inner = (
    <div className={`group relative block glass-card overflow-hidden rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${className}`}>
      {/* gradient blob */}
      <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl transition-opacity group-hover:opacity-30`} />

      {/* ticket notches - left/right perforation */}
      <div className="pointer-events-none absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[color:var(--background)] border border-black/5 shadow-inner" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 translate-x-1/2 rounded-full bg-[color:var(--background)] border border-black/5 shadow-inner" />

      {/* dashed separator hint - perforation line */}
      <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px -translate-y-[18px] border-t border-dashed border-black/10 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" style={{ top: '52%' }} />

      <div className="relative">
        {/* header row */}
        <div className="flex items-start justify-between">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg transition-transform group-hover:scale-110`}>
            {icon}
          </div>
          <div className="font-[var(--font-display)] text-5xl font-extrabold leading-none text-black/[0.06] select-none">
            {numberLabel}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {topLeftBadge}
          </div>
          {topRightLabel && (
            <span
              title={topRightTitle}
              className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-soft)]"
            >
              {topRightLabel}
            </span>
          )}
        </div>

        {/* Sarlavha va tavsif — HECH QACHON kesilmaydi (line-clamp olib tashlangan):
            karta matni to'liq ko'rinadi, karta balandligi moslashadi */}
        <h3 className="mt-2 min-h-[3.5rem] text-[15px] font-extrabold leading-snug text-[color:var(--emerald-deep)] transition-colors group-hover:text-blue-600 sm:text-[17px]">
          {title}
        </h3>

        {description && (
          <div className="mt-2 text-[13px] leading-relaxed text-[color:var(--ink)]">
            {description}
          </div>
        )}

        {/* ticket footer with dashed top border */}
        {(footer || adminActions) && (
          <div className="mt-5 flex flex-col gap-3 border-t border-dashed border-black/10 pt-4">
            {footer && <div className="flex flex-wrap gap-1.5 text-[10px]">{footer}</div>}
            {adminActions && <div className="flex flex-wrap gap-1.5">{adminActions}</div>}
          </div>
        )}
      </div>

      {/* subtle barcode / ticket stub lines at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-6 right-6 flex items-center gap-[3px] opacity-[0.08] group-hover:opacity-15 transition-opacity">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className={`h-6 bg-[color:var(--emerald-deep)] ${i % 3 === 0 ? "w-[2px]" : i % 2 === 0 ? "w-[3px]" : "w-[1px]"}`} />
        ))}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

export function TicketBadge({ children, variant = "neutral" }: { children: ReactNode; variant?: "emerald" | "violet" | "amber" | "neutral" }) {
  const map: Record<string, string> = {
    emerald: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    neutral: "bg-black/[0.04] text-[color:var(--ink-soft)]",
  };
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${map[variant]}`}>{children}</span>;
}
