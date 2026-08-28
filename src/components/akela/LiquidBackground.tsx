"use client";

import { useEffect, useRef } from "react";

/**
 * LiquidBackground
 * — ta'lim tizimiga oid fon: deep emerald gradient + floating glass blobs
 *   + grid paper overlay (classroom feel) + canvas-particle layer
 */
export function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Blob = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      hue: number;
      alpha: number;
    };

    let blobs: Blob[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(5, Math.min(9, Math.round((w * h) / 180000)));
      blobs = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.max(120, Math.random() * 280 + 120),
        hue: Math.random() > 0.5 ? 165 : 80,
        alpha: 0.16 + Math.random() * 0.12,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (const b of blobs) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;

        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        const sat = b.hue === 80 ? 75 : 60;
        const light = b.hue === 80 ? 70 : 55;
        grad.addColorStop(0, `hsla(${b.hue}, ${sat}%, ${light}%, ${b.alpha})`);
        grad.addColorStop(
          0.6,
          `hsla(${b.hue}, ${sat}%, ${light}%, ${b.alpha * 0.3})`,
        );
        grad.addColorStop(1, `hsla(${b.hue}, ${sat}%, ${light}%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Base gradient — cream → soft emerald */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 100% 0%, oklch(0.96 0.04 130) 0%, oklch(0.98 0.015 95) 45%, oklch(0.94 0.03 165) 100%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-grid-paper opacity-40" />
      <div
        className="absolute inset-x-0 top-0 h-64"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.82 0.13 80 / 0.18) 0%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-80"
        style={{
          background:
            "linear-gradient(0deg, oklch(0.32 0.08 165 / 0.18) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
