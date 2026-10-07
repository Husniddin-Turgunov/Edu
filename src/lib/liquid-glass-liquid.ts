"use client";

/**
 * Liquid Glass "suv" qatlami — liquid-glass-studio (iyinchao) mexanikasining DOM porti.
 *
 * Repodagi asosiy g'oya: barcha shakllar bitta SDF maydonida `smin` (smooth min) bilan
 * birlashtiriladi — yaqin shakllar suv kabi qo'shiladi. Shu yerda:
 *   1) glass elementlari shakl sifatida kiritiladi (yaqinlik ~26px = birlashadi);
 *   2) sichqoncha linzasi faqat glass ustida paydo bo'ladi va shakllarga qo'shiladi;
 *   3) tugmani bosib surishda shakl suvga o'xshab cho'zilib, qo'yib yuborilganda
 *      inertsiya bilan qaytadi;
 *   4) render: har shakl faqat o'z kvadratida, faqat 2px kenglikdagi chekka yoritiladi
 *      (fon bo'yalmaydi — matn o'qiladi).
 *
 * Bitta canvas, bitta rAF, past o'lchamli SDF maydon (SCALE) — shuning uchun yengil.
 */

const SEL = ".glass,.glass-strong,.glass-card,.glass-pill,.lg-auto,.glass-panel";
const MERGE = 26; // px — shakllar shu masofada birlashadi
const SCALE = 0.25; // SDF maydoni o'lchami (ekran / SCALE)
const MAX_SHAPES = 56;
const RIM_PX = 2.2; // chekka yorug'ligi kengligi (ekran px)
const AA_PX = 0.9; // chekka yumshoqlik

type Shape = {
  el: HTMLElement;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  r: number;
  k: number;
  alpha: number;
};

const shapes: Shape[] = [];
const byEl = new Map<HTMLElement, Shape>();

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let field: HTMLCanvasElement | null = null;
let fctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let running = false;
let vw = 0;
let vh = 0;
let lastScan = 0;
let fieldW = 0;
let fieldH = 0;
let dist = new Float32Array(0);

const cursor = { x: -9999, y: -9999, tx: -9999, ty: -9999, r: 0, target: 0, active: false, onGlass: false };
let drag: {
  el: HTMLElement;
  shape: Shape;
  px: number;
  py: number;
  vx: number;
  vy: number;
  stretch: number;
} | null = null;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* reponame: lib/sdf.glsl — smooth min */
function smin(a: number, b: number, k: number) {
  if (k <= 0.001) return a < b ? a : b;
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b * (1 - h) + a * h - k * h * (1 - h);
}

function roundedSdf(px: number, py: number, hw: number, hh: number, cr: number) {
  const r = clamp(cr, 0, Math.min(hw, hh));
  const dx = Math.abs(px) - hw;
  const dy = Math.abs(py) - hh;
  const ex = Math.abs(px) - (hw - r);
  const ey = Math.abs(py) - (hh - r);
  if (ex > 0 && ey > 0) return Math.hypot(ex, ey) - r;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ex > 0 ? ex : 0, ey > 0 ? ey : 0);
}

function radiusOf(el: HTMLElement) {
  const v = getComputedStyle(el).borderTopLeftRadius || "0";
  const rr = el.getBoundingClientRect();
  if (v.includes("%")) return (parseFloat(v) / 100) * Math.min(rr.width, rr.height);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function syncShape(s: Shape) {
  const el = s.el;
  const r = el.getBoundingClientRect();
  s.hw = r.width / 2;
  s.hh = r.height / 2;
  s.cx = r.left + r.width / 2;
  s.cy = r.top + r.height / 2;
  s.r = radiusOf(el);
}

function visible(r: DOMRect) {
  return r.width >= 30 && r.height >= 18 && r.bottom > -60 && r.top < vh + 60 && r.right > -60 && r.left < vw + 60;
}

/** yangi elementlarni topadi, yo'qolganlarni tozalaydi */
function discover() {
  const els = document.querySelectorAll<HTMLElement>(SEL);
  const seen = new Set<HTMLElement>();
  for (const el of els) {
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    if (!visible(r)) continue;
    seen.add(el);
    let s = byEl.get(el);
    if (!s) {
      s = { el, cx: 0, cy: 0, hw: 0, hh: 0, r: 0, k: 0, alpha: 1 };
      byEl.set(el, s);
      shapes.push(s);
    }
    syncShape(s);
  }
  for (const [el, s] of [...byEl]) {
    if (!seen.has(el)) {
      byEl.delete(el);
      const i = shapes.indexOf(s);
      if (i >= 0) shapes.splice(i, 1);
    }
  }
  if (shapes.length > MAX_SHAPES) {
    // kichik/yon elementlar chizilmaydi: katta yuzalarni qoldiramiz
    const keep = shapes
      .slice()
      .sort((a, b) => b.hw * b.hh - a.hw * a.hh)
      .slice(0, MAX_SHAPES);
    for (const s of shapes) {
      if (!keep.includes(s)) {
        byEl.delete(s.el);
        const i = shapes.indexOf(s);
        if (i >= 0) shapes.splice(i, 1);
      }
    }
  }
}

/** Ikki shakl orasidagi bo'shliq (negativ = qisman ustma-ust) */
function gap(a: Shape, b: Shape) {
  const dx = Math.max(0, Math.abs(a.cx - b.cx) - (a.hw + b.hw));
  const dy = Math.max(0, Math.abs(a.cy - b.cy) - (a.hh + b.hh));
  return Math.hypot(dx, dy);
}

/**
 * Har bir shaklning `k` qiymati haqiqiy qo'shni masofasidan hisoblanadi:
 * yaqinlashganda kichik, uzoqlashganda 0. Shuning uchun birlashish
 * sichqonchadan tashqari ham — qo'shni elementlar yaqinlashganda — paydo bo'ladi.
 */
function computeMerge() {
  const list = shapes;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    let nearest = Infinity;
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const o = list[j];
      if (Math.abs(s.cy - o.cy) > s.hh + o.hh + MERGE) continue;
      if (Math.abs(s.cx - o.cx) > s.hw + o.hw + MERGE) continue;
      const g = gap(s, o);
      if (g < nearest) nearest = g;
    }
    // masofa -> merge kuchayishi (0 = far, MERGE = touching)
    let k = nearest >= MERGE ? 0 : (MERGE - nearest) * 0.9;
    // hover / drag yanada kuchliroq bog'laydi
    if (s.el.matches(":hover") || (drag && drag.el === s.el)) k = Math.max(k, MERGE * 0.8);
    s.k = k;
  }
}

function drawShapes(dist: Float32Array, W: number, H: number, kx: number, ky: number) {
  const list = shapes;
  const lens = cursor.active && cursor.onGlass && cursor.r > 1 ? cursor : null;
  computeMerge();

  const stamp = (s: Shape) => {
    const pad = MERGE + RIM_PX + 2;
    const x0 = Math.max(0, Math.floor((s.cx - s.hw - pad) / kx));
    const x1 = Math.min(W - 1, Math.ceil((s.cx + s.hw + pad) / kx));
    const y0 = Math.max(0, Math.floor((s.cy - s.hh - pad) / ky));
    const y1 = Math.min(H - 1, Math.ceil((s.cy + s.hh + pad) / ky));
    for (let j = y0; j <= y1; j++) {
      const sy = (j + 0.5) * ky;
      for (let i = x0; i <= x1; i++) {
        const sx = (i + 0.5) * kx;
        const k = j * W + i;
        dist[k] = smin(dist[k], roundedSdf(sx - s.cx, sy - s.cy, s.hw, s.hh, s.r), s.k);
      }
    }
  };

  for (const s of list) {
    if (drag && drag.shape === s && drag.stretch > 0.01) {
      // suvga o'xshab cho'zilish: harakat vektori bo'yicha uzayadi
      const pad = MERGE + RIM_PX + 30;
      const ang = Math.atan2(drag.vy, drag.vx);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const growX = drag.stretch * Math.abs(ca) * 24;
      const growY = drag.stretch * Math.abs(sa) * 24;
      const x0 = Math.max(0, Math.floor((s.cx - s.hw - growX - pad) / kx));
      const x1 = Math.min(W - 1, Math.ceil((s.cx + s.hw + growX + pad) / kx));
      const y0 = Math.max(0, Math.floor((s.cy - s.hh - growY - pad) / ky));
      const y1 = Math.min(H - 1, Math.ceil((s.cy + s.hh + growY + pad) / ky));
      for (let j = y0; j <= y1; j++) {
        const sy = (j + 0.5) * ky;
        for (let i = x0; i <= x1; i++) {
          const sx = (i + 0.5) * kx;
          const dx = sx - s.cx;
          const dy = sy - s.cy;
          const rx = dx * ca + dy * sa;
          const ry = -dx * sa + dy * ca;
          const k = j * W + i;
          dist[k] = smin(
            dist[k],
            roundedSdf(rx, ry, s.hw + growX, s.hh + growY, s.r),
            MERGE,
          );
        }
      }
      continue;
    }
    stamp(s);
  }

  // kursor linzasi (repo usuli) — faqat glass ustida
  if (lens) {
    const pad = MERGE + RIM_PX + 2;
    const x0 = Math.max(0, Math.floor((lens.x - lens.r - pad) / kx));
    const x1 = Math.min(W - 1, Math.ceil((lens.x + lens.r + pad) / kx));
    const y0 = Math.max(0, Math.floor((lens.y - lens.r - pad) / ky));
    const y1 = Math.min(H - 1, Math.ceil((lens.y + lens.r + pad) / ky));
    for (let j = y0; j <= y1; j++) {
      const sy = (j + 0.5) * ky;
      for (let i = x0; i <= x1; i++) {
        const sx = (i + 0.5) * kx;
        const k = j * W + i;
        dist[k] = smin(dist[k], Math.hypot(sx - lens.x, sy - lens.y) - lens.r, MERGE * 0.7);
      }
    }
  }
}

function render(now: number) {
  raf = requestAnimationFrame(render);
  if (now - last < 1000 / 40) return;
  last = now;
  if (!ctx || !field || !fctx || !canvas) return;
  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
  }
  const W = Math.max(2, Math.round(vw * SCALE));
  const H = Math.max(2, Math.round(vh * SCALE));
  if (W !== fieldW || H !== fieldH) {
    field.width = W;
    field.height = H;
    fieldW = W;
    fieldH = H;
  }

  // kursor spring (radius va pozitsiya yumshoq)
  cursor.r += (cursor.target - cursor.r) * 0.16;
  cursor.x += (cursor.tx - cursor.x) * 0.4;
  cursor.y += (cursor.ty - cursor.y) * 0.4;
  if (cursor.r < 0.5 && cursor.target === 0) cursor.active = false;

  if (now - lastScan > 350) {
    lastScan = now;
    discover();
  } else {
    // joylashuv har kadrda — scroll'da iz qolmaydi
    for (const s of shapes) {
      if (!s.el.isConnected) continue;
      const r = s.el.getBoundingClientRect();
      if (visible(r)) syncShape(s);
    }
  }

  if (dist.length !== W * H) dist = new Float32Array(W * H);
  dist.fill(1e9);
  const kx = vw / W;
  const ky = vh / H;
  drawShapes(dist, W, H, kx, ky);

  // masofa -> faqat chegara yorug'ligi (ichi shaffof, matn o'qiladi)
  const img = fctx.createImageData(W, H);
  const d = img.data;
  const band = Math.max(1.2, RIM_PX / Math.min(kx, ky));
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const dv = dist[k];
      if (dv > band) continue;
      const t = 1 - Math.abs(dv) / band; // 0 = chegara, 1 = ichi
      const a = Math.pow(clamp(t, 0, 1), 1.9) * 232;
      if (a < 2) continue;
      const o = k * 4;
      d[o] = 255;
      d[o + 1] = 255;
      d[o + 2] = 255;
      d[o + 3] = Math.round(a);
    }
  }
  fctx.putImageData(img, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(field, 0, 0, vw, vh);
}

function onMove(e: PointerEvent) {
  cursor.tx = e.clientX;
  cursor.ty = e.clientY;
  const near = (e.target as HTMLElement)?.closest?.(SEL) as HTMLElement | null;
  if (near) {
    const rr = near.getBoundingClientRect();
    cursor.target = clamp(Math.min(rr.width, rr.height) * 0.8, 40, 96);
    cursor.onGlass = true;
  } else {
    cursor.target = 0;
    cursor.onGlass = false;
  }
  cursor.active = true;
  if (drag) {
    drag.vx = e.clientX - drag.px;
    drag.vy = e.clientY - drag.py;
    drag.px = e.clientX;
    drag.py = e.clientY;
  }
}

function onDown(e: PointerEvent) {
  const el = (e.target as HTMLElement)?.closest?.(SEL) as HTMLElement | null;
  if (!el || !byEl.has(el)) return;
  const rr = el.getBoundingClientRect();
  drag = {
    el,
    shape: byEl.get(el)!,
    px: e.clientX,
    py: e.clientY,
    vx: 0,
    vy: 0,
    stretch: 0,
  };
  cursor.r = clamp(Math.min(rr.width, rr.height), 48, 110);
  cursor.x = e.clientX;
  cursor.y = e.clientY;
  cursor.tx = e.clientX;
  cursor.ty = e.clientY;
  cursor.active = true;
  cursor.onGlass = true;
  // cho'zilish bosqichga bog'liq
  const t0 = performance.now();
  const grow = () => {
    if (!drag) return;
    drag.stretch = Math.min(1, (performance.now() - t0) / 160);
    if (drag.stretch < 1) requestAnimationFrame(grow);
  };
  grow();
}

function onUp() {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.stretch = 0;
  const sp = Math.hypot(d.vx, d.vy);
  // tez qo'yib yuborilgan shakl inertia bilan biroz siljiydi, keyin joyiga qaytadi
  if (sp > 5) {
    d.shape.cx += d.vx * 1.1;
    d.shape.cy += d.vy * 1.1;
  }
  const t0 = performance.now();
  const settle = () => {
    if (!d.shape.el.isConnected) return;
    const r = d.shape.el.getBoundingClientRect();
    const tx = r.left + r.width / 2;
    const ty = r.top + r.height / 2;
    const t = clamp((performance.now() - t0) / 420, 0, 1);
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic — tez, inertia
    d.shape.cx = d.shape.cx + (tx - d.shape.cx) * e * 0.4;
    d.shape.cy = d.shape.cy + (ty - d.shape.cy) * e * 0.4;
    if (t < 1) requestAnimationFrame(settle);
    else {
      d.shape.cx = tx;
      d.shape.cy = ty;
    }
  };
  settle();
}

export function startLiquidLayer() {
  if (running) return;
  running = true;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "lg-layer";
  field = document.createElement("canvas");
  fctx = field.getContext("2d");
  ctx = canvas.getContext("2d");
  if (!ctx || !fctx) return;
  document.body.appendChild(canvas);
  vw = window.innerWidth;
  vh = window.innerHeight;
  window.addEventListener("resize", () => { vw = window.innerWidth; vh = window.innerHeight; }, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  window.addEventListener("pointerout", (e) => {
    if (!(e as PointerEvent).relatedTarget) {
      cursor.target = 0;
      cursor.onGlass = false;
    }
  }, { passive: true });
  raf = requestAnimationFrame(render);
}

export function stopLiquidLayer() {
  running = false;
  cancelAnimationFrame(raf);
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerdown", onDown);
  window.removeEventListener("pointerup", onUp);
  canvas?.remove();
  canvas = null;
  shapes.length = 0;
  byEl.clear();
  field = null;
  fctx = null;
  ctx = null;
}