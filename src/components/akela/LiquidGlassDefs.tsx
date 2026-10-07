"use client";

import { useEffect, useRef } from "react";
import { applyGlassSettings, GLASS_EVENT, startLiquidGlass, stopLiquidGlass } from "@/lib/liquid-glass-client";
import { setLiquidSettings, startLiquidLayer, stopLiquidLayer } from "@/lib/liquid-glass-liquid";
import { GLASS_DEFAULTS, type GlassSettings } from "@/lib/liquid-glass-settings";

/**
 * Liquid Glass — bitta nuqtadan boshqariladigan tizim.
 *
 * Ikki qatlam bir xil sozlamalardan oziqlanadi:
 *   1. GPU qatlami (liquid-glass-liquid.ts -> liquid-glass-gl.ts, WebGL2) —
 *      birlasgan shakl, fresnel, specular va suv fiziikasi;
 *   2. Orqa fon quyuqlashtirish (liquid-glass-client.ts) — CSS `backdrop-filter`
 *      orqali haqiqiy sahifa matnini siljitadi (SVG feDisplacementMap).
 *
 * Sozlamalar /api/liquid-glass dan olinadi, admin paneldan jonli yangilanadi.
 */
export function LiquidGlassDefs() {
  const defs = useRef<SVGDefsElement>(null);

  useEffect(() => {
    let alive = true;
    // sozlamalarni darhol sinxron qilamiz
    setLiquidSettings(GLASS_DEFAULTS);
    const t = window.setTimeout(() => {
      if (!defs.current || !alive) return;
      startLiquidGlass(defs.current);
      startLiquidLayer();
    }, 700);

    fetch("/api/liquid-glass", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.ok) return;
        applyGlassSettings(d.settings);
        setLiquidSettings(d.settings);
      })
      .catch(() => {});

    const onLive = (e: Event) => {
      const detail = (e as CustomEvent<GlassSettings>).detail;
      applyGlassSettings(detail);
      setLiquidSettings(detail);
    };
    window.addEventListener(GLASS_EVENT, onLive);

    return () => {
      alive = false;
      window.clearTimeout(t);
      window.removeEventListener(GLASS_EVENT, onLive);
      stopLiquidGlass();
      stopLiquidLayer();
    };
  }, []);

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
      <defs ref={defs} />
    </svg>
  );
}