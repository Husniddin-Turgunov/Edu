"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Konsol / DevTools qatlami (faqat ishlab chiqarishda — `enabled=false`).
 *
 * UCH QATLAM bor va ularning maqsadi turlicha:
 *
 *  1) TEZKOR QARSHI CHORA — F12, Ctrl+Shift+I/J/C, o'ng tugma va
 *     `console.*` bloklanadi. Bu faqat "tez vazifani sekinlashtiradi";
 *     qatlam 3 dan o'tib bo'lmaydi.
 *
 *  2) ANIQLASH — oyna o'lchami farqi, `devtools` open/close hodisasi va
 *     `debugger` vaqti tuzog'i. Aniqlanganda xabar serverga yuboriladi.
 *
 *  3) SERVER QARORI (asl himoya) — bu komponent faqat xabar beradi.
 *     `/api/security/report` hodisani bazaga yozadi, foydalanuvchini
 *     `status = "blocked"` qilib qo'yadi va Telegram orqali adminlarga
 *     xabar yuboradi. Bloklash klientda emas, bazada yuz beradi — shuning
 *     uchun konsol orqali "bekor qilib bo'lmaydi": har bir server so'rovi
 *     `getSession()` orqali joriy `status` ni qayta tekshiradi.
 *
 * Konsol butunlay o'chmaydi (brauzer buni to'liq taqiqlay olmaydi) —
 * maqsad: ochilishini aniqlash va ochiq turib qolishiga yo'l qo'ymaslik.
 */

type GuardEvent = {
  event: "devtools_open" | "devtools_closed" | "console_disabled_attempt" | "shortcut_blocked";
  detail?: string;
};

function silenceConsole() {
  const noop = () => {};
  for (const key of ["log", "info", "debug", "warn", "error", "trace", "table", "dir", "group"] as const) {
    try {
      (console as any)[key] = noop;
    } catch {
      /* ba'zi brauzerlar muvjud emasligi uchun */
    }
  }
  try {
    (window as any).__consoleSilenced = true;
  } catch {
    /* ignore */
  }
}

/** Konsolni qayta tiklashga urinishni aniqlash. */
function watchConsoleReEnable(onAttempt: () => void) {
  let tripped = false;
  const timer = window.setInterval(() => {
    if (tripped) return;
    const silenced = (window as any).__consoleSilenced;
    const nowNoop = (() => {
      try {
        const original = Function.prototype.bind.call(Function, function () {});
        void original;
        return (console.log as any)?.toString?.().includes("native code") === false;
      } catch {
        return false;
      }
    })();
    if (silenced && nowNoop) {
      tripped = true;
      window.clearInterval(timer);
      onAttempt();
    }
  }, 1500);
  return () => window.clearInterval(timer);
}

export default function ConsoleGuard({ enabled = false }: { enabled?: boolean }) {
  const [blocked, setBlocked] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    const report = (payload: GuardEvent) => {
      // Bitta sahifada ko'p xabar yubormaymiz (faqat birinchi)
      if (payload.event === "devtools_open" && reported.current) return;
      if (payload.event === "devtools_open") reported.current = true;
      void fetch("/api/security/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      })
        .then(async (res) => {
          if (res.status === 401) return; // sessiya yo'q — server bloklamaydi
          const data = await res.json().catch(() => null);
          if (data?.blocked) setBlocked(true);
        })
        .catch(() => {});
    };

    silenceConsole();

    // 1) Oyna o'lchami / DevTools oynasi farqi
    const THRESHOLD = 160;
    const checkSize = () => {
      if (stopped) return;
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const wide = widthGap > THRESHOLD;
      const tall = heightGap > THRESHOLD && widthGap > 60;
      if (wide || tall) {
        if (!reported.current) {
          report({ event: "devtools_open", detail: `delta ${Math.round(widthGap)}x${Math.round(heightGap)}` });
        }
      } else if (reported.current) {
        reported.current = false;
        report({ event: "devtools_closed" });
      }
    };

    // 2) `debugger` tuzog'i — DevTools "pause on debugger" bilan ishlaydi
    let debuggerHits = 0;
    const debuggerTrap = window.setInterval(() => {
      const before = performance.now();
      // eslint-disable-next-line no-debugger
      try {
        // @ts-ignore — at runtime bu `debugger` statement'ni ishga tushiradi
        new Function("debugger")();
      } catch {
        /* ignore */
      }
      const delta = performance.now() - before;
      if (delta > 100) {
        debuggerHits++;
        if (debuggerHits >= 2 && !reported.current) {
          report({ event: "devtools_open", detail: "debugger trap" });
        }
      }
    }, 1200);

    // 3) Klaviatura
    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      const isF12 = key === "f12";
      const isInspectCombo =
        (e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(key);
      if (isF12 || isInspectCombo) {
        e.preventDefault();
        e.stopPropagation();
        report({ event: "shortcut_blocked", detail: isF12 ? "F12" : `Ctrl+Shift+${key.toUpperCase()}` });
        setBlocked(true);
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      report({ event: "console_disabled_attempt", detail: "context menu" });
    };
    const onSelectStart = (e: Event) => e.preventDefault();
    const onDragStart = (e: Event) => e.preventDefault();

    window.addEventListener("resize", checkSize);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("selectstart", onSelectStart, true);
    window.addEventListener("dragstart", onDragStart, true);
    const unwatchConsole = watchConsoleReEnable(() =>
      report({ event: "console_disabled_attempt", detail: "console qayta tiklandi" }),
    );
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
      unwatchConsole();
    };
  }, [enabled]);

  if (!enabled || !blocked) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#04140f]/95 px-6 backdrop-blur"
    >
      <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0b241c] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-3xl">
          ⛔
        </div>
        <h1 className="text-lg font-bold text-rose-200">Akkauntingiz bloklandi</h1>
        <p className="mt-3 text-sm leading-relaxed text-emerald-100/80">
          Saytning konsol yoki DevTools oynasi aniqlandi. Test qoidalari shuni talab qiladi —
          javoblar faqat serverda tekshiriladi.
        </p>
        <p className="mt-4 text-xs text-emerald-200/60">
          Bloklashni faqat administrator bekor qila oladi. Sabab va vaqt Telegram bot orqali
          adminga yuborilgan.
        </p>
      </div>
    </div>
  );
}
