"use client";

// components/akela/AiFloatingWidget.tsx
// Saytning istalgan sahifasida suzib yuradigan AI oynasi:
//   • foydalanuvchi istalgan joyga suradi (sahifa bo'ylab)
//   • o'ng pastki burchakdan tortib o'lchaydi (kichik ↔ katta)
//   • yopadi / kichiklashtiradi / yopilgan holda tugma holatida qoladi
//   • oyna holati (joy, o'lcham) localStorage'da saqlanadi
//   • ochilishida yumshoq animatsiya, ishlayotganda jonli orb

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  GripVertical,
  Sparkles,
  Wifi,
  WifiOff,
  LayoutGrid,
  MessageSquarePlus,
} from "lucide-react";
import { AiChatPanel } from "@/components/admin/ai/AiChatPanel";
import { AiMotionOrb } from "@/components/admin/ai/AiMotionOrb";
import type { Capabilities } from "@/components/admin/ai/types";

// v3: o'lcham endi ekrandan avto hisoblanadi — eski qattiq px li yozilgan
// kichik o'lchamlar (340x380 va h.k.) qayta ishlatilmasin.
const STORAGE_KEY = "akela-ai-widget-v3";

type WidgetState = {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  /**
   * O'lcham qanday kelgani:
   *   "fit" | "compact" — ekrandan avto hisoblanadi, har o'zgarishda qayta moslanadi
   *   "manual"          — foydalanuvchi burchakdan surib qo'lda o'zgartirgan
   */
  sizeMode: "fit" | "compact" | "manual";
};

const FAB = 56;
const MARGIN = 24;
const MIN_W = 320;
const MIN_H = 340;
/** Burchakka "magnit" bilan yopish chegarasi (px) */
const SNAP = 72;

/** Oyna qaysi burchakka bog'langan. */
type Dock = "tl" | "tr" | "bl" | "br";

/** Joriy ekran o'lchamlari. */
function viewSize() {
  return { vw: window.innerWidth, vh: window.innerHeight };
}

/** Oyna eng yaqin burchakni topadi — oyna o'shaga "avto suriladi". */
function dockOf(x: number, y: number, w: number, h: number): Dock {
  const { vw, vh } = viewSize();
  const nearLeft = x <= vw - (x + w);
  const nearTop = y <= vh - (y + h);
  return `${nearLeft ? "l" : "r"}${nearTop ? "t" : "b"}` as Dock;
}

/** Berilgan burchak uchun oyna koordinatlari (chegaradan tashqariga chiqmaydi). */
function dockPos(dock: Dock, w: number, h: number) {
  const { vw, vh } = viewSize();
  return {
    x: dock.startsWith("l") ? MARGIN : Math.max(MARGIN, vw - w - MARGIN),
    y: dock.endsWith("t") ? MARGIN : Math.max(MARGIN, vh - h - MARGIN),
  };
}

/**
 * Magnit bilan yopish: yReleased yaqin burchak/chet bo'lsa — oyna o'shaga
 * tekislanadi. Aks holda oyna erkin qoladi (kichkina joyda qamashib qolmaydi).
 */
function snapRect(rect: { x: number; y: number; width: number; height: number; sizeMode?: WidgetState["sizeMode"] }) {
  const { vw, vh } = viewSize();
  const w = rect.width;
  const h = rect.height;
  const nearL = rect.x <= SNAP;
  const nearR = vw - (rect.x + w) <= SNAP;
  const nearT = rect.y <= SNAP;
  const nearB = vh - (rect.y + h) <= SNAP;
  if (!nearL && !nearR && !nearT && !nearB) {
    return clampState({ minimized: false, sizeMode: rect.sizeMode ?? "fit", ...rect });
  }

  // gorizontal: yaqinroq chetga, vertikal: ham yaqin bo'lsa yaqinroq tomonga
  const x = nearL && nearR ? Math.round((vw - w) / 2) : nearL ? MARGIN : Math.max(MARGIN, vw - w - MARGIN);
  const y = nearT && nearB ? Math.round((vh - h) / 2) : nearT ? MARGIN : Math.max(MARGIN, vh - h - MARGIN);
  return clampState({ minimized: false, sizeMode: rect.sizeMode ?? "fit", ...rect, x, y });
}

/**
 * Ekran hajmiga AVTO moslashuvchi o'lchamlar.
 * Qattiq px yo'q — har safar ekrandan hisoblanadi, shuning uchun kichik
 * ekranda ham oyna sig'adi, katta ekranda chetlab qolmaydi.
 *   fit     — imkon qadar keng (ekranning ~48% dan ko'p emas)
 *   compact — ixcham (chat uchun yetarli)
 */
function autoSize(kind: "fit" | "compact", vw: number, vh: number) {
  const availW = Math.max(MIN_W, vw - MARGIN * 2);
  const availH = Math.max(MIN_H, vh - MARGIN * 2);
  if (kind === "fit") {
    return {
      width: Math.min(1100, Math.max(400, Math.round(vw * 0.62)), availW),
      height: Math.min(960, Math.max(420, Math.round(vh * 0.86)), availH),
    };
  }
  return {
    width: Math.min(560, Math.max(MIN_W, Math.round(vw * 0.36)), availW),
    height: Math.min(720, Math.max(380, Math.round(vh * 0.74)), availH),
  };
}

function defaultState(): WidgetState {
  if (typeof window === "undefined") {
    return { x: 24, y: 120, width: 420, height: 620, minimized: true, sizeMode: "fit" };
  }
  const { vw, vh } = viewSize();
  const { width, height } = autoSize("compact", vw, vh);
  return {
    x: Math.max(MARGIN, vw - width - MARGIN),
    y: Math.max(MARGIN, vh - height - MARGIN),
    width,
    height,
    minimized: true,
    sizeMode: "fit",
  };
}

/** Hozirgi holat ekranda to'liq ko'rinadigan holatga keltiriladi. */
function clampState(s: WidgetState): WidgetState {
  if (typeof window === "undefined") return s;
  const { vw, vh } = viewSize();
  const maxW = Math.max(MIN_W, vw - MARGIN * 2);
  const maxH = Math.max(MIN_H, vh - MARGIN * 2);
  const width = Math.max(Math.min(MIN_W, maxW), Math.min(maxW, s.width));
  const height = Math.max(Math.min(MIN_H, maxH), Math.min(maxH, s.height));
  // Kichiklashtirilgan holatda faqat tugma ko'rinadi — uni ham ekran ichida
  // ushlab turish kerak, aks holda oyna topib bo'lmay qoladi.
  const anchorW = s.minimized ? FAB : width;
  const anchorH = s.minimized ? FAB : height;
  return {
    width,
    height,
    x: Math.max(0, Math.min(s.x, vw - anchorW)),
    y: Math.max(0, Math.min(s.y, vh - anchorH)),
    minimized: s.minimized,
    sizeMode: s.sizeMode,
  };
}

export function AiFloatingWidget() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<WidgetState>(defaultState);
  const [tab, setTab] = useState<"chat" | "caps">("chat");
  const [flash, setFlash] = useState(false);

  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; origin: WidgetState; collapsed: boolean } | null>(null);
  /** Oxirgi hisoblangan geometriya — bo'shatganda magnit bilan bog'lash uchun */
  const liveRect = useRef<WidgetState | null>(null);
  liveRect.current = state;
  /** Surish bosishdan farqlansin — 6px dan ko'p siljiganda "drag" deb hisoblanadi */
  const dragged = useRef(false);
  /** Ekran o'lchamining oxirgi qiymati — nisbiy masshtab uchun */
  const viewSizeRef = useRef({ vw: 0, vh: 0 });
  if (!viewSizeRef.current.vw && typeof window !== "undefined") {
    viewSizeRef.current = { vw: window.innerWidth, vh: window.innerHeight };
  }

  // Holatni tiklash — butun sahifa yangilanganida oyna DOIM yopiq (minimized)
  // boshlanadi; position saqlanadi. Bu `minimized` flagning eskirmagan mantiqqa
  // keltiriladi — aks holda surish/drag hisoblari eski panel o'lchamiga tushardi.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState(clampState({ ...parsed, minimized: true }));
      }
    } catch {
      /* localStorage yo'q bo'lishi mumkin */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* kvota to'lgan bo'lishi mumkin */
    }
  }, [state, ready]);

  // Imkoniyatlarni yuklash — 3 urinish, 12 soniyaliq limit, xato ko'rinadi.
  // Aks holda oyna "Yuklanmoqda..." da qolib ketardi va hech qachon ochilmasdi.
  const [capsError, setCapsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadCaps = useCallback(async (n: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const r = await fetch("/api/ai/capabilities", { cache: "no-store", signal: controller.signal });
      if (!r.ok) throw new Error(`Server ${r.status}`);
      const data = await r.json();
      if (!data?.ok) throw new Error(data?.error || "Ma'lumot kelmadi");
      setCaps(data);
      setCapsError(null);
    } catch (err: any) {
      if (n < 3) {
        setTimeout(() => void loadCaps(n + 1), 600 * n);
      } else {
        setCapsError(
          err?.name === "AbortError"
            ? "Javob juda uzoq davom etdi"
            : err?.message || "Yuklab bo'lmadi",
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void loadCaps(1);
  }, [loadCaps, attempt]);

  // Ekran o'lchami o'zgarganda oyna avto moslashadi va o'z burchagiga suriladi
  useEffect(() => {
    const onResize = () =>
      setState((s) => {
        const { vw, vh } = viewSize();
        const next = clampState(s);
        const fits = next.width <= vw - MARGIN * 2 && next.height <= vh - MARGIN * 2;
        const prev = viewSizeRef.current;
        // Qo'lda o'lchangan oyna ham EKRANGA MOSLANADI — nisbiy o'lcham saqlanadi
        const ratioW = prev.vw > 0 ? Math.min(1, vw / prev.vw) : 1;
        const ratioH = prev.vh > 0 ? Math.min(1, vh / prev.vh) : 1;
        viewSizeRef.current = { vw, vh };
        if (!fits) {
          const size = autoSize("fit", vw, vh);
          return clampState({
            ...next,
            ...size,
            ...dockPos(dockOf(next.x, next.y, size.width, size.height), size.width, size.height),
            sizeMode: "fit",
          });
        }
        if (s.sizeMode !== "manual") {
          const size = autoSize(s.sizeMode, vw, vh);
          return clampState({
            ...next,
            ...size,
            ...dockPos(dockOf(next.x, next.y, size.width, size.height), size.width, size.height),
          });
        }
        if (ratioW < 1 || ratioH < 1) {
          return clampState({
            ...next,
            width: Math.round(next.width * ratioW),
            height: Math.round(next.height * ratioH),
          });
        }
        return next;
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Sichqoncha yoki barmoq bilan surish / o'lchash
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.mode === "move" || d.mode === "resize") {
        if (Math.hypot(dx, dy) > 6) dragged.current = true;
      }
      if (d.mode === "move") {
        const { vw, vh } = viewSize();
        const width = d.collapsed ? FAB : d.origin.width;
        const height = d.collapsed ? FAB : d.origin.height;
        setState((s) => {
          const next = {
            ...s,
            x: Math.max(0, Math.min(d.origin.x + dx, vw - width)),
            y: Math.max(0, Math.min(d.origin.y + dy, vh - height)),
          };
          liveRect.current = next;
          return next;
        });
      } else {
        const { vw, vh } = viewSize();
        const maxW = Math.max(MIN_W, vw - MARGIN * 2);
        const maxH = Math.max(MIN_H, vh - MARGIN * 2);
        const minW = Math.min(MIN_W, maxW);
        const minH = Math.min(MIN_H, maxH);
        setState((s) => {
          const next = clampState({
            ...s,
            width: Math.max(minW, Math.min(maxW, d.origin.width + dx)),
            height: Math.max(minH, Math.min(maxH, d.origin.height + dy)),
            // Qo'lda o'lchalandi — endi ekrana avto moslama to'xtaydi
            sizeMode: "manual",
          });
          liveRect.current = next;
          return next;
        });
      }
    };
    const onUp = () => {
      const mode = drag.current?.mode;
      const wasPanel = drag.current && !drag.current.collapsed;
      drag.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      // Faqat PANEL surilgandagina magnit bilan bog'laymiz — FAB (tugma)
      // uchun hech qanday ovur oyna o'lchamiga bog'lab yubormaydi.
      if ((mode === "move" || mode === "resize") && wasPanel) {
        setState((s) => (s.minimized ? s : snapRect(s)));
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const startDrag = useCallback(
    (mode: "move" | "resize") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      drag.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        origin: { ...state },
        // Oyna yopiq bo'lsa (FAB), surish 985px-lik oyna o'rniga 56px-lik tugma
        // o'lchamida hisoblanadi — aks holda tugma ekranning faqat kichik qismida
        // yuradi.
        collapsed: !open || state.minimized,
      };
      dragged.current = false;
      document.body.style.userSelect = "none";
      document.body.style.cursor = mode === "move" ? "grabbing" : "nwse-resize";
    },
    [state, open],
  );

  const openWidget = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    const { vw, vh } = viewSize();
    setState((s) => {
      // Oyna joriy ekranga avto moslanadi va TUGMA qaysi burchakda bo'lsa
      // o'sha burchakka suriladi — qo'lda chetlab qolmaydi.
      const size = autoSize("fit", vw, vh);
      const dock = dockOf(s.x, s.y, s.minimized ? FAB : s.width, s.minimized ? FAB : s.height);
      const next = clampState({
        ...s,
        ...size,
        ...dockPos(dock, size.width, size.height),
        minimized: false,
        sizeMode: "fit",
      });
      liveRect.current = next;
      return next;
    });
    setOpen(true);
  };

  if (!ready) return null;

  const collapsed = !open || state.minimized;
  const { vw, vh } = viewSize();
  const compactTarget = autoSize("compact", vw, vh);
  const isCompact = state.sizeMode === "compact" || Math.abs(state.width - compactTarget.width) < 24;
  const panelWidth = state.width;
  const panelHeight = state.height;
  const left = collapsed ? state.x : Math.min(state.x, Math.max(0, vw - panelWidth));
  const top = collapsed ? state.y : Math.min(state.y, Math.max(0, vh - panelHeight));

  // Kattalashtirish / ixchamlash — ikkala holat ham EKRANDAN hisoblanadi,
// shuning uchun tugma har doim to'gri yo'nalishni ko'rsatadi va ishlaydi.
  const toggleFit = () =>
    setState((s) => {
      const size = s.sizeMode === "compact" ? autoSize("fit", vw, vh) : autoSize("compact", vw, vh);
      const mode = s.sizeMode === "compact" ? "fit" : "compact";
      // Oyna o'z burchagida qoladi, o'sha burchakka tekislanadi
      const dock = dockOf(s.x, s.y, s.width, s.height);
      const next = clampState({ ...s, ...size, ...dockPos(dock, size.width, size.height), sizeMode: mode });
      liveRect.current = next;
      return next;
    });

  return (
    <>
      {/* Tugma holati */}
      <AnimatePresence>
        {collapsed && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ left, top }}
            onPointerDown={startDrag("move")}
            onClick={(e) => {
              // Oddiy ko'chish (drag) bilan tushirib yuborish — oyna OCHILMAYDI.
              // Shunga qaramay tugmani istalgan joyga surish mumkin.
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              openWidget();
            }}
            onDoubleClick={() => {
              dragged.current = false;
              openWidget();
            }}
            title="AI yordamchisini ochish (surtib joyini o'zgartiring)"
            // `fixed` majburiy: `relative` bo'lsa tugma DOM oqimida, sahifa
            // oxirida (scroll pastida) qoladi va ko'rinmaydi.
            className={`group fixed z-50 flex h-14 w-14 touch-none items-center justify-center rounded-2xl transition hover:scale-105 ${
              flash ? "scale-110" : ""
            }`}
          >
            {/* Tugmaning o'zi — qattiq fon va pulsatsiya halqasi yo'q.
   Sfera yumshoq gradientli, shuning uchun orqasidagi to'rtburchak yoki
   aniq halqa uni kvadrat ko'rsatib turardi. O'rniga atrofga yumshoq
   ambient nur tarqaladi: u qat'iy chegarasiz, sfera bilan birga
   nafas oladi (sikl 3.125 s — lottie bilan bir xil). */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <motion.span
                animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.92, 1.08, 0.92] }}
                transition={{ duration: 3.125, repeat: Infinity, ease: "easeInOut" }}
                className="absolute h-12 w-12 rounded-full bg-[radial-gradient(circle,rgba(129,140,248,0.75),rgba(56,189,248,0.35)_45%,rgba(56,189,248,0)_70%)] blur-lg"
              />
            </span>
            <AiMotionOrb mode="idle" size={52} />
            {/* Yangi xabar indikatori */}
            {!caps && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
              </span>
            )}
            {caps && !caps.provider.live && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-400" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Oyna */}
      <AnimatePresence>
        {open && !state.minimized && (
          <>
            {/* Yumshoq orqa fon */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setOpen(false);
                setState((s) => ({ ...s, minimized: true }));
              }}
              className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px]"
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.86, y: 24, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.9, y: 18, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              style={{ left, top, width: panelWidth, height: panelHeight }}
              className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/25"
            >
              {/* Sarlavha — surish uchun */}
              <header
                onPointerDown={startDrag("move")}
                className="relative flex shrink-0 cursor-grab touch-none items-center gap-2.5 bg-gradient-to-r from-indigo-700 via-blue-700 to-violet-700 px-3.5 py-2.5 text-white active:cursor-grabbing"
              >
                <span className="flex h-8 w-8 items-center justify-center">
                  <AiMotionOrb mode="idle" size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold leading-tight">Akela AI</p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-blue-100">
                    {caps ? (
                      <>
                        {caps.provider.live ? (
                          <Wifi className="h-3 w-3" />
                        ) : (
                          <WifiOff className="h-3 w-3" />
                        )}
                        <span className="truncate">
                          {caps.provider.live ? caps.provider.model : "o'rnatilgan rejim"}
                        </span>
                      </>
                    ) : capsError ? (
                      <button
                        onClick={() => {
                          setCapsError(null);
                          setAttempt((a) => a + 1);
                        }}
                        className="flex items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-white hover:bg-white/25"
                        title={capsError}
                      >
                        <WifiOff className="h-3 w-3" /> Qayta yuklash
                      </button>
                    ) : (
                      "yuklanmoqda..."
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                  {tab === "chat" && (
                    <button
                      onClick={() => setTab("caps")}
                      title="Imkoniyatlar ro'yxati"
                      className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  )}
                  {tab === "caps" && (
                    <button
                      onClick={() => setTab("chat")}
                      title="Chatga qaytish"
                      className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setState((s) => ({ ...s, minimized: true }))}
                    title="Kichiklashtirish"
                    className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={toggleFit}
                    title={isCompact ? "Ekranga sig'adigancha kattalashtirish" : "Ixchamlashtirish"}
                    className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                  >
                    {isCompact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setState((s) => ({ ...s, minimized: true }));
                    }}
                    title="Yopish"
                    className="rounded-lg p-1.5 text-white/80 transition hover:bg-rose-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <GripVertical className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white/25" />
              </header>

              {/* Tanlovi chiziq */}
              <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
                {(
                  [
                    { key: "chat", label: "Chat", icon: Sparkles },
                    { key: "caps", label: "Imkoniyatlar", icon: LayoutGrid },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`relative flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition ${
                      tab === t.key ? "text-indigo-700" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab === t.key && (
                      <motion.span
                        layoutId="ai-widget-tab"
                        className="absolute inset-0 rounded-lg bg-white shadow-sm"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                      <t.icon className="h-3.5 w-3.5" /> {t.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Mazmun */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {!caps ? (
                  capsError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                      <WifiOff className="h-6 w-6 text-amber-500" />
                      <p className="text-[13px] font-semibold text-slate-700">
                        Ma'lumotni yuklab bo'lmadi
                      </p>
                      <p className="text-[11.5px] text-slate-500">{capsError}</p>
                      <button
                        onClick={() => {
                          setCapsError(null);
                          setAttempt((a) => a + 1);
                        }}
                        className="mt-1 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow"
                      >
                        Qayta urinish
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center gap-2 text-[13px] text-slate-500">
                      <Sparkles className="h-4 w-4 animate-pulse text-indigo-500" /> Yuklanmoqda...
                    </div>
                  )
                ) : tab === "chat" ? (
                  <div className="flex h-full min-h-0 flex-col px-3 pb-3 pt-3">
                    <AiChatPanel caps={caps} compact />
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto px-3 pb-3 pt-3">
                    <CapabilitiesCompact caps={caps} onOpenFull={() => setOpen(false)} />
                  </div>
                )}
              </div>

              {/* O'lchash burchagi — ekranga sig'adigan oynani bo'lib kerak */}
              <div
                onPointerDown={startDrag("resize")}
                title="O'lchamini o'zgartirish (burchakdan suring)"
                className="absolute bottom-0 right-0 z-10 h-7 w-7 cursor-nwse-resize touch-none opacity-70 hover:opacity-100"
              >
                <svg viewBox="0 0 20 20" className="h-full w-full text-slate-700">
                  <path
                    d="M20 20 L20 12 L12 20 Z M20 20 L20 16 L16 20 Z"
                    fill="currentColor"
                    opacity="0.45"
                  />
                </svg>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/** Oynada ixcham ko'rinishdagi imkoniyatlar ro'yxati. */
function CapabilitiesCompact({ caps, onOpenFull }: { caps: Capabilities; onOpenFull: () => void }) {
  const [query, setQuery] = useState("");
  const tools = caps.tools.filter((t) => {
    if (!t.adminOnly || caps.actor.isAdmin) return true;
    return false;
  });

  const filtered = tools.filter(
    (t) =>
      !query.trim() ||
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.name.includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-2.5">
      <p className="rounded-xl bg-indigo-50 px-3 py-2 text-[12px] leading-relaxed text-indigo-900">
        {caps.tools.length} ta vosita mavjud. Tanlang — AI harakatingizni o'zi bajaradi.
        Batafsyl uchun <button onClick={onOpenFull} className="font-semibold underline">AI markazni oching</button>.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Vosita qidirish..."
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] outline-none focus:border-indigo-400"
      />
      <div className="space-y-1.5">
        {filtered.map((tool) => (
          <button
            key={tool.name}
            onClick={() => onOpenFull()}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50"
          >
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-800">
              {tool.title}
              {tool.needsConfirm && (
                <span className="rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">tasdiq</span>
              )}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-slate-500">
              {tool.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export { AiFloatingWidget as default };