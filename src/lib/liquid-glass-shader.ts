// liquid-glass-studio (iyinchao/liquid-glass-studio) fragment-main.glsl — STEP 9 (yakuniy pass)
// va lib/sdf.glsl ning CPU porti. Bitta DOM elementi uchun:
//   * sinish xaritasi (normal * edgeFactor * refDistance) — SVG feDisplacementMap uchun
//   * rim qatlami (fresnel + glare) — oq RGBA, elementning chekkasi bo'ylab
// Barcha masofalar CSS px da (shaderdagi merged * u_resolution1x.y).

import type { GlassSettings } from "@/lib/liquid-glass-settings";

const PI = Math.PI;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const safeAsin = (x: number) => Math.asin(clamp(x, -1, 1));

function makeSdf(w: number, h: number, cr: number, n: number) {
  const hw = w / 2;
  const hh = h / 2;
  return (x: number, y: number) => {
    const dx = Math.abs(x) - hw;
    const dy = Math.abs(y) - hh;
    if (dx > -cr && dy > -cr) {
      const cx = Math.sign(x) * (hw - cr);
      const cy = Math.sign(y) * (hh - cr);
      const qx = Math.abs(x - cx);
      const qy = Math.abs(y - cy);
      return Math.pow(Math.pow(qx, n) + Math.pow(qy, n), 1 / n) - cr;
    }
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  };
}

export type GlassRender = { disp: string; rim: string; zone: string; maxDisp: number };

export function renderGlass(w: number, h: number, radiusPx: number, p: GlassSettings): GlassRender | null {
  if (typeof document === "undefined" || w < 2 || h < 2) return null;
  const scale = Math.min(1, 320 / Math.max(w, h));
  const W = Math.max(2, Math.round(w * scale));
  const H = Math.max(2, Math.round(h * scale));
  const cr = Math.min(radiusPx, Math.min(w, h) / 2);
  const sdf = makeSdf(w, h, cr, p.shapeRoundness);

  const T = Math.max(0.01, p.refThickness);
  const fHard = p.refFresnelHardness / 100;
  const fFac = p.refFresnelFactor / 100;
  const gHard = p.glareHardness / 100;
  const gConv = p.glareConvergence / 100;
  const gOpp = p.glareOppositeFactor / 100;
  const gFac = p.glareFactor / 100;
  const gAngle = (p.glareAngle * PI) / 180;
  const fRange = Math.pow(500 / Math.max(1, p.refFresnelRange), 2);
  const gRange = Math.pow(500 / Math.max(1, p.glareRange), 2);

  const vx = new Float32Array(W * H);
  const vy = new Float32Array(W * H);
  const alpha = new Float32Array(W * H);
  const zone = new Float32Array(W * H);
  let maxDisp = 0;
  const e = 0.5;

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = ((i + 0.5) / W - 0.5) * w;
      const y = ((j + 0.5) / H - 0.5) * h;
      const d = sdf(x, y);
      const k = j * W + i;
      const aa = clamp(0.5 - d, 0, 1);
      if (aa <= 0) continue;

      let nx = sdf(x + e, y) - sdf(x - e, y);
      let ny = sdf(x, y + e) - sdf(x, y - e);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;

      const nm = -d;
      let edge = 0;
      if (nm < T) {
        const xr = 1 - nm / T;
        const thetaI = safeAsin(xr * xr);
        const thetaT = safeAsin((1 / p.refFactor) * Math.sin(thetaI));
        edge = -Math.tan(thetaT - thetaI);
        if (!(edge > 0)) edge = 0;
      }
      // Chekka tomonda namuna tashqaridan olinmasligi uchun siljish 0 ga tushadi
      const edgeFade = clamp(nm / 2.5, 0, 1);
      const maxDispPx = Math.min(p.refDistance * 1000, Math.min(w, h) * 0.14);
      const disp = edge * maxDispPx * edgeFade;
      vx[k] = -nx * disp;
      vy[k] = -ny * disp;
      maxDisp = Math.max(maxDisp, Math.abs(vx[k]), Math.abs(vy[k]));
      // sinish faqat chekka yaqin zona ichida (shaderdagidek edgeFactor > 0)
      zone[k] = aa * clamp(1 - nm / T, 0, 1) ** 0.6;

      const fresnelGeo = clamp(Math.pow(Math.max(0, 1 + (d / 1500) * fRange + fHard), 5), 0, 1);
      const aF = fresnelGeo * fFac * 0.35;

      const glareGeo = clamp(Math.pow(Math.max(0, 1 + (d / 1500) * gRange + gHard), 5), 0, 1);
      let ang = Math.atan2(-ny, nx);
      if (ang < 0) ang += 2 * PI;
      const ga = (ang - PI / 4 + gAngle) * 2;
      const far = (ga > PI * 1.5 && ga < PI * 3.5) || ga < -PI * 0.5;
      let gaf = (0.5 + Math.sin(ga) * 0.5) * (far ? 1.2 * gOpp : 1.2) * gFac;
      gaf = clamp(Math.pow(Math.max(0, gaf), 0.1 + gConv * 2), 0, 1);
      const aG = gaf * glareGeo * 0.6;

      alpha[k] = (1 - (1 - aF) * (1 - aG)) * aa;
    }
  }

  const dc = document.createElement("canvas");
  const rc = document.createElement("canvas");
  const zc = document.createElement("canvas");
  dc.width = rc.width = zc.width = W;
  dc.height = rc.height = zc.height = H;
  const dctx = dc.getContext("2d");
  const rctx = rc.getContext("2d");
  const zctx = zc.getContext("2d");
  if (!dctx || !rctx || !zctx) return null;
  const di = dctx.createImageData(W, H);
  const ri = rctx.createImageData(W, H);
  const zi = zctx.createImageData(W, H);
  const S = Math.max(maxDisp * 2, 1e-3);
  for (let k = 0; k < W * H; k++) {
    const o = k * 4;
    di.data[o] = Math.round(clamp(0.5 + vx[k] / S, 0, 1) * 255);
    di.data[o + 1] = Math.round(clamp(0.5 - vy[k] / S, 0, 1) * 255);
    di.data[o + 2] = 128;
    di.data[o + 3] = 255;
    ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = 255;
    ri.data[o + 3] = Math.round(clamp(alpha[k], 0, 1) * 255);
    zi.data[o] = zi.data[o + 1] = zi.data[o + 2] = 255;
    zi.data[o + 3] = Math.round(clamp(zone[k], 0, 1) * 255);
  }
  dctx.putImageData(di, 0, 0);
  rctx.putImageData(ri, 0, 0);
  zctx.putImageData(zi, 0, 0);
  return { disp: dc.toDataURL("image/png"), rim: rc.toDataURL("image/png"), zone: zc.toDataURL("image/png"), maxDisp };
}
