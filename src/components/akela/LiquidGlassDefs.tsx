"use client";

import { useEffect, useRef } from "react";
import { applyGlassSettings, GLASS_EVENT, startLiquidGlass, stopLiquidGlass } from "@/lib/liquid-glass-client";
import type { GlassSettings } from "@/lib/liquid-glass-settings";
import { startLiquidLayer, stopLiquidLayer } from "@/lib/liquid-glass-liquid";

/**
 * Liquid Glass — liquid-glass-studio shaderi (CPU porti): sinish/dispersiya SVG
 * filtri orqali, fresnel + glare chegarasi raster orqali. Sozlamalar
 * /api/liquid-glass dan olinadi; admin paneldan jonli o'zgaradi.
 */
export function LiquidGlassDefs() {
  const defs = useRef<SVGDefsElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { if (defs.current) startLiquidGlass(defs.current); startLiquidLayer(); }, 900);
    let alive = true;
    fetch("/api/liquid-glass", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.ok) applyGlassSettings(d.settings); })
      .catch(() => {});
    const onLive = (e: Event) => applyGlassSettings((e as CustomEvent<GlassSettings>).detail);
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
