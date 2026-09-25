"use client";

import { useEffect, useRef } from "react";

/**
 * LiquidBackground — YAGONA global fon (barcha oynalarda bir xil).
 * Ko'k uyg'un palitra: chuqur ko'k gradient + suzuvchi ko'k bloblar
 * + nozik grid overlay + canvas-particle qatlami.
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
      // Faqat ko'k oilasi: 210 (sky) / 222 (blue) / 235 (indigo) / 250 (deep indigo)
      const BLUE_HUES = [210, 222, 232, 245, 250];
      blobs = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.max(120, Math.random() * 280 + 120),
        hue: BLUE_HUES[Math.floor(Math.random() * BLUE_HUES.length)],
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
        // Ko'k uyg'unlik: bir xil to'yinganlik/yorqinlik — faqat hue o'zgaradi
        const sat = 72;
        const light = 60;
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
      {/* Base gradient — bir xil ko'k: och osmon → muz ko'k → indigo tus */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 0%, oklch(0.96 0.03 240) 0%, oklch(0.93 0.045 250) 42%, oklch(0.89 0.06 258) 78%, oklch(0.86 0.07 262) 100%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-grid-paper opacity-40" />
      {/* Yuqori ko'k nuri */}
      <div
        className="absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.62 0.19 258 / 0.22) 0%, oklch(0.7 0.15 250 / 0.08) 55%, transparent 100%)",
        }}
      />
      {/* Pastki chuqur ko'k soyasi */}
      <div
        className="absolute inset-x-0 bottom-0 h-96"
        style={{
          background:
            "linear-gradient(0deg, oklch(0.38 0.16 262 / 0.22) 0%, oklch(0.55 0.14 258 / 0.08) 55%, transparent 100%)",
        }}
      />
      {/* Chap/o'ng yumshoq ko'k vinetka — chuqurlik uchun */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 8% 30%, oklch(0.68 0.16 240 / 0.14) 0%, transparent 60%), radial-gradient(90% 70% at 92% 70%, oklch(0.6 0.17 258 / 0.14) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}
