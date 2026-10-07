"use client";

import { GLASS_DEFAULTS, sanitizeGlass, type GlassSettings } from "@/lib/liquid-glass-settings";
import { renderGlass } from "@/lib/liquid-glass-shader";

export const GLASS_EVENT = "lg-settings";
const SEL = ".glass,.glass-strong,.glass-card,.glass-pill";
// Butun saytdagi tugma/karta/borderlarga avtomatik liquid glass:
// kiritiladigan elementlar (kichik o'lchamlilar chiqarib tashlanadi).
const AUTO_SEL = [
  "button",
  "a",
  "input:not([type=checkbox]):not([type=radio])",
  "select",
  "textarea",
  ".rounded-lg",
  ".rounded-xl",
  ".rounded-2xl",
  ".rounded-3xl",
  ".rounded-full",
  "[class*='card']",
  "[class*='panel']",
  // admin/loyiha yuzalaridagi oddiy yuzalar: chegara + yumaloq burchak + fon
  "[class*='rounded'][class*='bg-white']",
  "[class*='rounded'][class*='border']",
  "[class*='rounded-xl'][class*='bg-']",
  "[class*='rounded-2xl'][class*='bg-']",
  "[class*='rounded-3xl'][class*='bg-']",
].join(",");
// Sahifaning asosiy kontent yuzasi (admin p-8/p-6/max-w konteynerlari) — katta shisha panel
const PANEL_SEL = "main > div.p-8, main > div.p-6, main > div[class*='max-w-']";
const MIN_W = 46;
const MIN_H = 24;
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK = "http://www.w3.org/1999/xlink";

type Entry = { disp: string; rim: string; zone: string; maxDisp: number; id: string };

let settings: GlassSettings = GLASS_DEFAULTS;
let started = false;
let defs: SVGDefsElement | null = null;
let maps = new Map<string, Omit<Entry, "id">>();
const entries = new Map<HTMLElement, Entry>();
const tracked = new Set<HTMLElement>();
let counter = 0;
let pending = new Set<HTMLElement>();
let flushTimer = 0;
let syncRaf = 0;
let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;

const supported =
  typeof window !== "undefined" &&
  typeof CSS !== "undefined" &&
  CSS.supports?.("backdrop-filter", 'blur(1px) url("#x")') !== false;

/** Refraction + dispersion: R/G/B kanallari turlicha siljish (repodagi refDispersion) */
function makeFilter(id: string, disp: string, S: number, dispersion: number) {
  if (!defs) return;
  const f = document.createElementNS(SVG_NS, "filter");
  f.setAttribute("id", id);
  f.setAttribute("x", "-6%");
  f.setAttribute("y", "-6%");
  f.setAttribute("width", "112%");
  f.setAttribute("height", "112%");
  f.setAttribute("color-interpolation-filters", "sRGB");
  const img = document.createElementNS(SVG_NS, "feImage");
  img.setAttribute("preserveAspectRatio", "none");
  img.setAttribute("result", "map");
  img.setAttribute("href", disp);
  img.setAttributeNS(XLINK, "xlink:href", disp);
  f.appendChild(img);
  const ch: [string, string, number][] = [
    ["r", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", 1 + 0.02 * dispersion],
    ["g", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", 1],
    ["b", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0", Math.max(0.1, 1 - 0.02 * dispersion)],
  ];
  for (const [name, m, k] of ch) {
    const dm = document.createElementNS(SVG_NS, "feDisplacementMap");
    dm.setAttribute("in", "SourceGraphic");
    dm.setAttribute("in2", "map");
    dm.setAttribute("scale", String(S * k));
    dm.setAttribute("xChannelSelector", "R");
    dm.setAttribute("yChannelSelector", "G");
    dm.setAttribute("result", `d${name}`);
    f.appendChild(dm);
    const cm = document.createElementNS(SVG_NS, "feColorMatrix");
    cm.setAttribute("in", `d${name}`);
    cm.setAttribute("type", "matrix");
    cm.setAttribute("values", m);
    cm.setAttribute("result", name);
    f.appendChild(cm);
  }
  const b1 = document.createElementNS(SVG_NS, "feBlend");
  b1.setAttribute("in", "r");
  b1.setAttribute("in2", "g");
  b1.setAttribute("mode", "screen");
  b1.setAttribute("result", "rg");
  f.appendChild(b1);
  const b2 = document.createElementNS(SVG_NS, "feBlend");
  b2.setAttribute("in", "rg");
  b2.setAttribute("in2", "b");
  b2.setAttribute("mode", "screen");
  f.appendChild(b2);
  defs.appendChild(f);
}

function radiusOf(el: HTMLElement, w: number, h: number): number {
  const v = getComputedStyle(el).borderTopLeftRadius || "0";
  if (v.includes("%")) return (parseFloat(v) / 100) * Math.min(w, h);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function build(el: HTMLElement): Entry | null {
  const r = el.getBoundingClientRect();
  const w = Math.round(r.width);
  const h = Math.round(r.height);
  if (w < 20 || h < 20) return null;
  const radius = Math.round(radiusOf(el, w, h));
  const key = `${w}x${h}r${radius}`;
  let m = maps.get(key);
  if (!m) {
    const out = renderGlass(w, h, radius, settings);
    if (!out) return null;
    m = out;
    maps.set(key, m);
  }
  const id = `lg-f-${++counter}`;
  // kichik elementlarda SVG filtrini yaratmaymiz (tezlik) — faqat rim + blur
  const canRefract = supported && settings.enabled && settings.refDistance > 0 && m.maxDisp > 0.5 && w >= 170 && h >= 90;
  if (canRefract) makeFilter(id, m.disp, Math.max(m.maxDisp * 2, 1), settings.refDispersion);
  return { ...m, id };
}

function flush() {
  flushTimer = 0;
  const list = [...pending];
  pending.clear();
  for (const el of list) {
    if (!el.isConnected) continue;
    let e = entries.get(el);
    if (!e) {
      const built = build(el);
      if (!built) continue;
      e = built;
      entries.set(el, e);
    }
    if (getComputedStyle(el).position === "static") {
      if (el.matches(SEL)) el.style.position = "relative";
      else el.classList.add("lg-rel");
    }
    // fresnel + glare chegarasi (repodagi STEP 9 formulasi bo'yicha CPU xaritasi)
    el.style.setProperty("--lg-rim", `url(${e.rim})`);
    // sinish zonasi (edgeFactor > 0 bo'lgan chegara halqasi)
    el.style.setProperty("--lg-zone", `url(${e.zone})`);
    const refract = supported && settings.enabled && settings.refDistance > 0 && e.maxDisp > 0.5;
    const bf = `${refract ? `blur(${settings.blurRadius}px) url(#${e.id})` : `blur(${settings.blurRadius}px)`} saturate(${settings.saturation}%)`;
    el.style.setProperty("--lg-bf", bf);
    // LibreCSS/Tailwind var()li shorthandni tashlab yuboradi — inline style to'g'ri
    el.style.backdropFilter = bf;
    (el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = bf;
  }
}

function schedule(el: HTMLElement) {
  pending.add(el);
  if (!flushTimer) flushTimer = window.setTimeout(flush, 32);
}

function track(el: HTMLElement) {
  if (!el.matches?.(SEL) && !el.matches?.(AUTO_SEL)) return;
  const cs0 = getComputedStyle(el);
  // bezak qatlamlari (absolute/fixed) — yuzaga emas, ularni buzmaymiz
  if (cs0.position === "absolute" || cs0.position === "fixed") {
    el.classList.remove("lg-auto");
    return;
  }
  const isPanel = el.matches(PANEL_SEL);
  const isAuto = !el.matches(SEL);
  if (isPanel) {
    el.classList.add("glass-panel");
  }
  if (isAuto) {
    const r = el.getBoundingClientRect();
    if (r.width < MIN_W || r.height < MIN_H) return;
    if (el.querySelector(":scope > img, :scope > svg.h-full")) return; // rasmga tegilmaydi
    // shaffof fonli elementga qo'yilmaydi — aks holda orqadagi matn cho'zilib ketadi.
    // Fon ba'zan bolalar span/div da bo'ladi (masalan sidebar menyusi) — ularni ham hisobga olamiz.
    const painted = (n: Element) => {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
      const bg = cs.backgroundColor;
      if (!bg || bg === "transparent") return false;
      const alpha = bg.startsWith("rgba") ? parseFloat(bg.split(",")[3]) : 1;
      return alpha >= 0.08;
    };
    let hasBg = painted(el);
    if (!hasBg) {
      for (const kid of Array.from(el.querySelectorAll(":scope > span, :scope > div")).slice(0, 4)) {
        if (painted(kid)) { hasBg = true; break; }
      }
    }
    if (!hasBg && !isPanel) return;
    el.classList.add("lg-auto");
  }
  if (!tracked.has(el)) ro?.observe(el);
  tracked.add(el);
  schedule(el);
}

function scan(root: ParentNode) {
  if (root instanceof HTMLElement) {
    if (root.matches?.(PANEL_SEL)) track(root);
    track(root);
  }
  root.querySelectorAll?.<HTMLElement>(PANEL_SEL).forEach(track);
  root.querySelectorAll?.<HTMLElement>(AUTO_SEL).forEach(track);
  root.querySelectorAll?.<HTMLElement>(SEL).forEach(track);
}

function rebuild() {
  maps = new Map();
  entries.clear();
  if (defs) defs.innerHTML = "";
  document.querySelectorAll<HTMLElement>(AUTO_SEL).forEach((el) => {
    const bf0 = `blur(${settings.blurRadius}px) saturate(${settings.saturation}%)`;
    el.style.setProperty("--lg-bf", bf0);
    el.style.backdropFilter = bf0;
    (el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = bf0;
    el.style.setProperty("--lg-rim", "none");
    schedule(el);
  });
}

export function startLiquidGlass(svgDefs: SVGDefsElement) {
  defs = svgDefs;
  if (started) return;
  started = true;
  document.documentElement.classList.add("lg-on");
  ro = new ResizeObserver((list) => list.forEach((e) => schedule(e.target as HTMLElement)));
  mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "childList") m.addedNodes.forEach((n) => n instanceof HTMLElement && scan(n));
      else if (m.target instanceof HTMLElement && m.target.matches(SEL)) schedule(m.target);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  scan(document.body);
  window.addEventListener("resize", () => rebuild(), { passive: true });
  window.setInterval(() => { if (document.hidden) return; }, 1000);
}

export function stopLiquidGlass() {
  started = false;
  cancelAnimationFrame(syncRaf);
  ro?.disconnect();
  mo?.disconnect();
  tracked.clear();
  entries.clear();
  document.documentElement.classList.remove("lg-on");
}

export function applyGlassSettings(input: Partial<GlassSettings> | GlassSettings) {
  if (typeof document === "undefined") return;
  settings = sanitizeGlass({ ...GLASS_DEFAULTS, ...input });
  if (started) rebuild();
}