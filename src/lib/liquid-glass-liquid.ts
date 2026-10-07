"use client";

/**
 * Liquid Glass — yagona boshqaruvchi.
 *
 * Bitta kod butun saytni qamrab oladi: hech qanday elementga alohida kod
 * yozilmaydi. Element avtomatik kashf etiladi (registr), uning geometriyasi
 * GPU renderer'ga (liquid-glass-gl.ts) uzatiladi, u yerda repo formulalari
 * bo'yicha chiziladi. Orqa fon quyuqlashtirish esa CSS `backdrop-filter`
 * orqali (liquid-glass-shader.ts -> SVG displacement) — haqiqiy sahifa matni siljiydi.
 *
 * Fizika (repo sxemasi + DOM uchun moslashtirilgan):
 *   * qo'shni shakllar yaqinlashganda `smin` bilan birlashadi (MERGE masofa);
 *   * sichqoncha/kalkalyustek faqat glass ustida linza bo'lib paydo bo'ladi;
 *   * tugma bosib surilganda suvga o'xshab cho'zilib, qo'yib yuborilganda
 *     tezlikka bog'liq inertsiya bilan qaytadi;
 *   * scroll/resize o'zgarishlari kadr ichida sinxronlanadi.
 */

import { GLASS_DEFAULTS, type GlassSettings } from "@/lib/liquid-glass-settings";
import { createGlRenderer, MAX_GPU_SHAPES, type GlRenderer, type GpuShape } from "@/lib/liquid-glass-gl";

const SEL = ".glass,.glass-strong,.glass-card,.glass-pill,.lg-auto,.glass-panel";
const MERGE = 11; // px — shakllar shu masofadan boshlab suvday birlashadi (repo mergeRate 0.05 ga mos)
const ROUNDNESS = GLASS_DEFAULTS.shapeRoundness;
const MIN_SIDE = 12;

type Entry = {
  el: HTMLElement;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  r: number;
  k: number;
  alpha: number;
  ox: number; // cho'zilish siljishi (drag)
  oy: number;
  sx: number; // cho'zilish koeffitsienti
  sy: number;
  vx: number; // inertsiya tezligi
  vy: number;
};

const registry = new Map<HTMLElement, Entry>();
let renderer: GlRenderer | null = null;
let raf = 0;
let running = false;
let vw = 0;
let vh = 0;
let lastFrame = 0;
let lastScan = 0;
let settings: GlassSettings = GLASS_DEFAULTS;

const cursor = { x: -9999, y: -9999, tx: -9999, ty: -9999, r: 0, target: 0, on: false, active: false };
let drag: Entry | null = null;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ---------------------------------------------------------------- kashfiyot */

function readRadius(el: HTMLElement, w: number, h: number) {
  const v = getComputedStyle(el).borderTopLeftRadius || "0";
  if (v.includes("%")) return (parseFloat(v) / 100) * Math.min(w, h);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function measure(e: Entry) {
  const r = e.el.getBoundingClientRect();
  if (r.width < MIN_SIDE && r.height < MIN_SIDE) return false;
  e.hw = r.width / 2;
  e.hh = r.height / 2;
  e.cx = r.left + r.width / 2 + e.ox;
  e.cy = r.top + r.height / 2 + e.oy;
  e.r = readRadius(e.el, r.width, r.height);
  return true;
}

function discover() {
  const els = document.querySelectorAll<HTMLElement>(SEL);
  const seen = new Set<HTMLElement>();
  for (const el of els) {
    if (!el.isConnected) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_SIDE || rect.height < 8) continue;
    if (rect.bottom < -80 || rect.top > vh + 80 || rect.right < -80 || rect.left > vw + 80) continue;
    seen.add(el);
    let e = registry.get(el);
    if (!e) {
      e = {
        el,
        cx: 0,
        cy: 0,
        hw: 0,
        hh: 0,
        r: 0,
        k: 0,
        alpha: 1,
        ox: 0,
        oy: 0,
        sx: 1,
        sy: 1,
        vx: 0,
        vy: 0,
      };
      registry.set(el, e);
    }
    measure(e);
  }
  for (const [el, e] of [...registry]) {
    if (!seen.has(el)) registry.delete(el);
  }
}

/* -------------------------------------------------------------- birlashish */

function gap(a: Entry, b: Entry) {
  const dx = Math.max(0, Math.abs(a.cx - b.cx) - (a.hw + b.hw));
  const dy = Math.max(0, Math.abs(a.cy - b.cy) - (a.hh + b.hh));
  return Math.hypot(dx, dy);
}

/**
 * Bevosita DOM kosasiga sig'ib turgan element — alohida chizilmaydi.
 * Faqat to'g'ridan-to'g'ri ota element hisobga olinadi: aks holda qator ichidagi
 * kartalar ketma-ket "ichida" deb hisoblanib, o'rniga faqat tashqi karta chiziladi.
 */
function isNested(e: Entry) {
  const a = e.hw * e.hh;
  if (a <= 0) return false;
  for (let node = e.el.parentElement; node; node = node.parentElement) {
    const o = registry.get(node);
    if (!o) continue;
    const oa = o.hw * o.hh;
    if (oa <= a * 1.6) continue; // ota katta bo'lishi kerak
    if (
      e.cx > o.cx - o.hw - 2 &&
      e.cx < o.cx + o.hw + 2 &&
      e.cy > o.cy - o.hh - 2 &&
      e.cy < o.cy + o.hh + 2
    ) return true; // ichida joylashgan — ota shakli uni allaqachon chizadi
  }
  return false;
}

/** har element o'z qo'shnisiga qanchalik yaqinligiga qarab bog'lanadi */
function computeMerge() {
  const list = [...registry.values()].slice(0, MAX_GPU_SHAPES);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let nearest = Infinity;
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const b = list[j];
      if (Math.abs(a.cy - b.cy) > a.hh + b.hh + MERGE) continue;
      if (Math.abs(a.cx - b.cx) > a.hw + b.hw + MERGE) continue;
      const g = gap(a, b);
      if (g < nearest) nearest = g;
    }
    let k = nearest >= MERGE ? 0 : (MERGE - nearest) * 0.55;
    if (a.el.matches(":hover") || a === drag) k = Math.max(k, MERGE * 0.75);
    a.k = k;
  }
}

/* ------------------------------------------------------------------ fizika */

function spring(e: Entry) {
  // cho'zilish va inertsiyaning tabiiy qaytishi (kritik dampingdan yumshoq)
  const t = 0.14;
  e.sx += (1 - e.sx) * t;
  e.sy += (1 - e.sy) * t;
  if (Math.abs(e.vx) < 0.02 && Math.abs(e.vy) < 0.02) {
    e.ox = 0;
    e.oy = 0;
    e.vx = 0;
    e.vy = 0;
    return;
  }
  e.vx *= 0.88;
  e.vy *= 0.88;
  e.ox += e.vx;
  e.oy += e.vy;
}

function onMove(ev: PointerEvent) {
  cursor.tx = ev.clientX;
  cursor.ty = ev.clientY;
  const near = (ev.target as HTMLElement)?.closest?.(SEL) as HTMLElement | null;
  if (near) {
    const r = near.getBoundingClientRect();
    cursor.target = clamp(Math.min(r.width, r.height) * 0.55, 22, 64);
    cursor.on = true;
  } else {
    cursor.target = 0;
    cursor.on = false;
  }
  cursor.active = true;
  if (drag) {
    drag.vx = ev.clientX - (drag.cx - drag.hw);
    drag.vy = ev.clientY - (drag.cy - drag.hh);
  }
}

function onDown(ev: PointerEvent) {
  const el = (ev.target as HTMLElement)?.closest?.(SEL) as HTMLElement | null;
  if (!el) return;
  const e = registry.get(el);
  if (!e) return;
  drag = e;
  const r = el.getBoundingClientRect();
  cursor.r = clamp(Math.min(r.width, r.height), 40, 104);
  cursor.x = ev.clientX;
  cursor.y = ev.clientY;
  cursor.tx = ev.clientX;
  cursor.ty = ev.clientY;
  cursor.active = true;
  cursor.on = true;
}

function onUp() {
  if (!drag) return;
  const e = drag;
  drag = null;
  const sp = Math.hypot(e.vx, e.vy);
  // tez qo'yib yuborilgan element inertia bilan uzoqlashadi, keyin qaytadi
  if (sp > 6) {
    e.ox += e.vx * 1.6;
    e.oy += e.vy * 1.6;
    e.vx *= 1.6;
    e.vy *= 1.6;
  }
}

/* ------------------------------------------------------------------ render */

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (!renderer || !renderer.ok) return;
  if (now - lastFrame < 1000 / 60) return;
  lastFrame = now;

  if (now - lastScan > 320) {
    lastScan = now;
    discover();
  } else {
    for (const e of registry.values()) if (e.el.isConnected) measure(e);
  }

  // kursor spring
  cursor.r += (cursor.target - cursor.r) * 0.16;
  cursor.x += (cursor.tx - cursor.x) * 0.42;
  cursor.y += (cursor.ty - cursor.y) * 0.42;
  if (cursor.r < 0.4 && cursor.target === 0) cursor.active = false;

  for (const e of registry.values()) {
    spring(e);
    // hover/drag — shishaning o'zi kuchayadi (alohida CSS qatlami yo'q)
    const hot = e.el.matches(":hover") || e === drag;
    e.alpha = hot ? 1 : 0.86;
  }
  computeMerge();

  const all = [...registry.values()];
  const visible = all.filter((e) => !isNested(e));
  const list: GpuShape[] = [];
  for (const e of visible) {
    if (list.length >= MAX_GPU_SHAPES) break;
    list.push({
      cx: e.cx,
      cy: e.cy,
      hw: e.hw * e.sx,
      hh: e.hh * e.sy,
      radius: e.r,
      roundness: ROUNDNESS,
      k: e.k,
      alpha: e.alpha,
    });
  }

  const p = settings;
  renderer.render(list, { x: cursor.x, y: cursor.y, r: cursor.r, on: cursor.active && cursor.on }, {
    refThickness: p.refThickness,
    refDistance: p.refDistance,
    refFactor: p.refFactor,
    refDispersion: p.refDispersion,
    refFresnelRange: p.refFresnelRange,
    refFresnelHardness: p.refFresnelHardness,
    refFresnelFactor: p.refFresnelFactor,
    glareRange: p.glareRange,
    glareHardness: p.glareHardness,
    glareFactor: p.glareFactor,
    glareConvergence: p.glareConvergence,
    glareOppositeFactor: p.glareOppositeFactor,
    glareAngle: p.glareAngle,
    rimWidth: 1.8,
    tint: [1, 1, 1, 0.5],
  });
}

/* ------------------------------------------------------------------- API */

export function startLiquidLayer() {
  if (running) return;
  running = true;
  vw = window.innerWidth;
  vh = window.innerHeight;
  renderer = createGlRenderer();
  if (renderer?.ok) {
    renderer.resize(vw, vh, window.devicePixelRatio || 1);
    document.body.appendChild(renderer.canvas);
  }
  window.addEventListener("resize", () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    renderer?.resize(vw, vh, window.devicePixelRatio || 1);
  }, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  window.addEventListener("scroll", () => { lastScan = 0; }, { passive: true, capture: true });
  raf = requestAnimationFrame(frame);
}

export function stopLiquidLayer() {
  running = false;
  cancelAnimationFrame(raf);
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerdown", onDown);
  window.removeEventListener("pointerup", onUp);
  registry.clear();
  renderer?.dispose();
  renderer = null;
}

/** GPU qatlami sozlamalarni shu funksiya orqali oladi (bitta manba — LiquidGlassDefs) */
export function setLiquidSettings(next: GlassSettings) {
  settings = next;
}