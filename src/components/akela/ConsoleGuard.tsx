"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Konsol / DevTools qatlami.
 *
 * Sizning talab: "devtools ochiqligi aniqlansa HECH QANDAY amal bajarilmasin
 * — na bloklash, na ogohlantirish, na Telegram. Faqat konsolga OCHIB
 * BO'LMASIN."
 *
 * SHU SABABLI:
 *  - Serverga HECH QANDAY so'rov yuborilmaydi (`/api/security/report` chaqirilmaydi)
 *  - Hech qanday banner, xabar yoki ogohlantirish ko'rsatilmaydi
 *  - Foydalanuvchi hech qachon bloklanmaydi
 *  - DevTools aniqlanganda sahifa MA'LUMOTI YASHIRILADI (bo'sh qora ekran)
 *
 * Bloklash klientda emas, balki umuman yo'q. Qolgan himoya: klaviatura
 * (F12, Ctrl+Shift+I/J/C), o'ng tugma menyusi va `console.*` bloklanadi.
 */

function silenceConsole() {
  const noop = () => {};
  for (const key of ["log", "info", "debug", "warn", "error", "trace", "table", "dir", "group"] as const) {
    try {
      (console as any)[key] = noop;
    } catch {
      /* ba'zi brauzerlar muvjud emasligi uchun */
    }
  }
}

export default function ConsoleGuard({ enabled = false }: { enabled?: boolean }) {
  /** DevTools ochiqligi aniqlanganmi? Unda kontent yashiriladi. */
  const [hidden, setHidden] = useState(false);
  /** Hozir yashirilgan holatda ham qayta-qayta o'lchash kerak (cheklovchan emas). */
  const openRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;

    silenceConsole();

    // 1) Oyna o'lchami farqi — DevTools yon yoki pastda ochiqligi
    const THRESHOLD = 160;
    const checkSize = () => {
      if (stopped) return;
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const isOpen = widthGap > THRESHOLD || (heightGap > THRESHOLD && widthGap > 60);
      if (isOpen !== openRef.current) {
        openRef.current = isOpen;
        setHidden(isOpen);
      }
    };

    // 2) `debugger` tuzog'i — "pause on debugger" bilan ishlaydi
    let debuggerHits = 0;
    const debuggerTrap = window.setInterval(() => {
      const before = performance.now();
      try {
        // @ts-ignore — runtime'da `debugger` statement'ni ishga tushiradi
        new Function("debugger")();
      } catch {
        /* ignore */
      }
      if (performance.now() - before > 100) {
        debuggerHits++;
        if (debuggerHits >= 2 && !openRef.current) {
          openRef.current = true;
          setHidden(true);
        }
      }
    }, 1200);

    // 3) Klaviatura — konsolni ochishga imkon berilmaydi
    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      const isF12 = key === "f12";
      const isInspectCombo =
        (e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(key);
      if (isF12 || isInspectCombo) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onSelectStart = (e: Event) => e.preventDefault();
    const onDragStart = (e: Event) => e.preventDefault();

    window.addEventListener("resize", checkSize);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("selectstart", onSelectStart, true);
    window.addEventListener("dragstart", onDragStart, true);
    const initial = window.setTimeout(checkSize, 900);

    return () => {
      stopped = true;
      window.clearInterval(debuggerTrap);
      window.clearTimeout(initial);
      window.removeEventListener("resize", checkSize);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("selectstart", onSelectStart, true);
      window.removeEventListener("dragstart", onDragStart, true);
    };
  }, [enabled]);

  // DevTools ochiq — kontent BO'SH qora ekran bilan yopiladi.
  // Hech qanday xabar, banner yoki bloklash yo'q.
  if (!enabled || !hidden) return null;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 z-[99999] bg-[#050807]"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}