"use client";

/**
 * Til tanlagich — "suv tomchisi" effekti bilan.
 *
 * Bitta maydon, ikkita amal:
 *  1) BOSISH — maydonning ICHIDAGI istalgan nuqtaga bosilsa, o'sha segment
 *     tanlanadi (ko'rsatkich u yerda paydo bo'ladi).
 *  2) SURISH — maydonning istalgan joyidan ushlab, chapga/o'ngga tortilsa,
 *     ko'rsatkich suv tomchisi kabi cho'ziladi va qo'yib yuborilganda eng
 *     yaqin segmentga inersiya bilan "sepib" o'tadi.
 *
 * Qo'shimcha: faol til aniq ko'rinadi; ko'rsatkich ostidagi yorliq "lupa"
 * kabi kattalashadi; klaviatura strelkalari ham ishlaydi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion";
import type { Locale } from "@/lib/akela-content";

const ORDER: Locale[] = ["uz", "ru", "en"];
/** Track ichidagi ichki bo'shliq (px) — p-1 bilan mos. */
const PAD = 4;

/** Spring: tez urish, biroz cho'zilish, osilish yo'q. */
const SPRING = { type: "spring" as const, stiffness: 520, damping: 26, mass: 0.55 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clampIndex = (i: number) => Math.round(clamp(i, 0, ORDER.length - 1));

export function LanguageSwitcher({
  locale,
  labels,
  onChange,
}: {
  locale: Locale;
  labels: Record<Locale, { label: string; full: string }>;
  onChange: (l: Locale) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const selected = Math.max(0, ORDER.indexOf(locale));

  const [seg, setSeg] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(selected);
  const [dragging, setDragging] = useState(false);

  /** Ko'rsatkichning x koordinatasi (px) — boshqa joyda ham shu boshqariladi. */
  const x = useMotionValue(0);
  /** Cho'zilish kuchi: -1..1 (belgi = yo'nalish, |qiymat| = tezlik). */
  const pull = useMotionValue(0);

  // Chozilish: tez bo'lsa yassilanib "katta tomchi" bo'ladi, sekin bo'lsa
  // deyarli doira ("lupa") qoladi.
  const scaleX = useTransform(pull, (v) => 1 + Math.min(0.42, Math.abs(v) * 0.34));
  const scaleY = useTransform(pull, (v) => 1 - Math.min(0.20, Math.abs(v) * 0.16));
  const tilt = useTransform(pull, (v) => v * 4);
  const shadow = useTransform(pull, (v) =>
    `0 ${10 + Math.abs(v) * 12}px ${20 + Math.abs(v) * 26}px rgba(16,94,74,${0.18 + Math.abs(v) * 0.22})`
  );

  const maxX = Math.max(0, (ORDER.length - 1) * seg);

  /** Segment kengligini o'lchash (resize'da ham qayta hisoblanadi). */
  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const inner = (el.clientWidth - PAD * 2) / ORDER.length;
    setSeg((prev) => (Math.abs(prev - inner) < 0.5 ? prev : inner));
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  /** Tanlangan segmentga silish (o'lcham va tildan tashqari holatlar ham). */
  useEffect(() => {
    if (seg <= 0 || dragging) return;
    animate(x, selected * seg, SPRING);
    setHoverIndex(selected);
  }, [selected, seg, dragging, x]);

  /** Ko'rsatkich segment chegarasini o'tsa — "lupa" o'sha yerga ko'chadi. */
  useMotionValueEvent(x, "change", (v) => {
    if (seg <= 0) return;
    setHoverIndex((prev) => {
      const next = clampIndex(v / seg);
      return next === prev ? prev : next;
    });
  });

  const snap = useCallback(
    (index: number, velocity = 0) => {
      const target = clampIndex(index);
      animate(x, target * seg, SPRING);
      animate(pull, 0, { type: "spring", stiffness: 420, damping: 24, mass: 0.4 });
      setHoverIndex(target);
      setDragging(false);
      if (ORDER[target] !== locale) onChange(ORDER[target]);
    },
    [locale, onChange, pull, seg, x]
  );

  /** Koordinatadan segment markaziga o'tish (maydon ichida). */
  const posOf = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || seg <= 0) return 0;
      const rect = el.getBoundingClientRect();
      return clamp(clientX - rect.left - PAD, 0, maxX);
    },
    [maxX, seg]
  );

  // ——— Bosish va surish: bitta maydon, ikkita amal ———
  // Eslatma: ushlab turgan paytda hech qanday animatsiya ISHLAMAYDI — ko'rsatkich
  // barmoqga 1:1 ergashadi. Aks holda spring bilan "kurashib", ko'rsatkich
  // o'zi surilib ketardi. Spring faqat bo'yashda (qo'yib yuborganda) ishlaydi.
  const dragRef = useRef<{
    startX: number;
    startPill: number;
    lastX: number;
    lastT: number;
    v: number;
    pressIdx: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (seg <= 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const pos = posOf(e.clientX);
    // Ishlayotgan animatsiyalarni to'xtatamiz — aks holda ular x qiymatini
    // har kadrda qayta yozib, barmoqni "itga" qarshilash qilardi.
    x.stop();
    pull.stop();
    dragRef.current = {
      startX: e.clientX,
      startPill: x.get(),
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
      pressIdx: clampIndex(pos / seg),
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || seg <= 0) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    // px/ms -> px/s; -2200..2200 ga siqamiz
    d.v = ((e.clientX - d.lastX) / dt) * 1000;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    x.set(clamp(d.startPill + (e.clientX - d.startX), 0, maxX));
    pull.set(clamp(d.v / 1400, -1, 1));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || seg <= 0) return;
    // 1) Bosish (barmoq deyarli qimirilmagan) -> bosilgan segment
    // 2) Surish -> oxirgi nuqta + tezlikning inertial qo'shimchasi
    const moved = Math.abs(e.clientX - d.startX);
    const projected = moved < 4 ? d.pressIdx * seg : x.get() + clamp(d.v, -2200, 2200) * 0.14;
    snap(projected / seg);
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label="Tilni tanlash"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative hidden h-9 w-[136px] shrink-0 select-none items-center rounded-full glass-pill border border-white/60 p-1 sm:flex ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      {ORDER.map((l, i) => {
        const isSelected = i === selected;
        const isFocus = i === hoverIndex;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={labels[l].full}
            title={labels[l].full}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                snap(i + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                snap(i - 1);
              }
            }}
            /* Ko'rsatkich maydonni to'liq egallaganligi uchun tugmalar sichqoncha
               bilan uning ostida qoladi va `pointer-events-none`; bosish va
               surishni yuqoridagi maydon hal qiladi. Klaviatura va ekran
               o'quvchisi esa shu tugmalar orqali ishlaydi. */
            className={`pointer-events-none relative z-10 flex-1 rounded-full text-center text-[13px] font-semibold transition-[color,opacity] duration-200 ease-out ${
              isSelected
                ? "text-[color:var(--emerald-deep)]"
                : "text-[color:var(--ink-soft)]"
            }`}
            style={{
              transform: isFocus ? "scale(1.18)" : "scale(1)",
              opacity: isSelected ? 1 : isFocus ? 0.95 : 0.6,
            }}
          >
            {labels[l].label}
          </button>
        );
      })}

      {/* Suv tomchisi / lupa: bitta element, holatlar orasida spring bilan
          siljiydi; surish paytida tezlikka qarab cho'ziladi. */}
      <motion.span
        aria-hidden="true"
        style={{
          x,
          scaleX,
          scaleY,
          rotate: tilt,
          width: seg,
          top: PAD,
          bottom: PAD,
          left: PAD,
          boxShadow: shadow,
        }}
        className="pointer-events-none absolute z-0 rounded-full bg-white/95 ring-1 ring-emerald-900/10 backdrop-blur-sm"
      />
    </div>
  );
}