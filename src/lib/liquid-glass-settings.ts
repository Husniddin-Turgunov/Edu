// Liquid Glass sozlamalari — liquid-glass-studio (iyinchao) boshqaruvlari bilan bir xil nom,
// oraliq va standart qiymatlar (src/Controls.tsx). "Blursiz" defolt: blurRadius = 0.

export type GlassSettings = {
  enabled: boolean;
  refThickness: number;
  refDistance: number;
  refFactor: number;
  refDispersion: number;
  refFresnelRange: number;
  refFresnelHardness: number; // %
  refFresnelFactor: number; // %
  glareRange: number;
  glareHardness: number; // %
  glareFactor: number; // %
  glareConvergence: number; // %
  glareOppositeFactor: number; // %
  glareAngle: number;
  shapeRoundness: number;
  blurRadius: number; // px — defolt: 0 (blursiz)
  saturation: number; // %
};

export const GLASS_DEFAULTS: GlassSettings = {
  enabled: true,
  refThickness: 20,
  refDistance: 0.05,
  refFactor: 1.4,
  refDispersion: 7,
  refFresnelRange: 30,
  refFresnelHardness: 20,
  refFresnelFactor: 20,
  glareRange: 30,
  glareHardness: 20,
  glareFactor: 90,
  glareConvergence: 50,
  glareOppositeFactor: 80,
  glareAngle: -45,
  shapeRoundness: 5,
  blurRadius: 0,
  saturation: 180,
};

type Spec = { min: number; max: number; step: number; label: string; hint: string };

export const GLASS_SPECS: Record<Exclude<keyof GlassSettings, "enabled">, Spec> = {
  refThickness: { min: 1, max: 80, step: 0.01, label: "refThickness", hint: "Sinish zonasining chekkadan qalinligi, px" },
  refDistance: { min: 0, max: 0.2, step: 0.001, label: "refDistance", hint: "Sinish masofasi (0 = sinishsiz)" },
  refFactor: { min: 1, max: 4, step: 0.01, label: "refFactor", hint: "Sinish ko'rsatkichi (shisha ≈ 1.4–1.5)" },
  refDispersion: { min: 0, max: 50, step: 0.01, label: "refDispersion", hint: "Rang ajralishi (qizil/yashil/ko'k)" },
  refFresnelRange: { min: 0, max: 100, step: 0.01, label: "refFresnelRange", hint: "Fresnel yorug' chegarasi kengligi" },
  refFresnelHardness: { min: 0, max: 100, step: 0.01, label: "refFresnelHardness", hint: "Fresnel chegarasi keskinligi, %" },
  refFresnelFactor: { min: 0, max: 100, step: 0.01, label: "refFresnelFactor", hint: "Fresnel kuchi, %" },
  glareRange: { min: 0, max: 100, step: 0.01, label: "glareRange", hint: "Glare (specular) kengligi" },
  glareHardness: { min: 0, max: 100, step: 0.01, label: "glareHardness", hint: "Glare keskinligi, %" },
  glareFactor: { min: 0, max: 120, step: 0.01, label: "glareFactor", hint: "Glare kuchi, %" },
  glareConvergence: { min: 0, max: 100, step: 0.01, label: "glareConvergence", hint: "Glare yig'ilishi (torayishi), %" },
  glareOppositeFactor: { min: 0, max: 100, step: 0.01, label: "glareOppositeFactor", hint: "Qarama-qarshi tomon glare'i, %" },
  glareAngle: { min: -180, max: 180, step: 0.01, label: "glareAngle", hint: "Yorug'lik burchagi, daraja" },
  shapeRoundness: { min: 2, max: 7, step: 0.01, label: "shapeRoundness", hint: "Burchak yumaloqligi (superellipse)" },
  blurRadius: { min: 0, max: 60, step: 1, label: "blurRadius", hint: "Orqa fon xiraligi, px (defolt 0)" },
  saturation: { min: 100, max: 300, step: 5, label: "saturation", hint: "Orqa fon to'yinganligi, %" },
};

export function sanitizeGlass(input: unknown): GlassSettings {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: any = { ...GLASS_DEFAULTS };
  out.enabled = typeof src.enabled === "boolean" ? src.enabled : GLASS_DEFAULTS.enabled;
  for (const k of Object.keys(GLASS_SPECS) as (keyof typeof GLASS_SPECS)[]) {
    const v = Number(src[k]);
    if (Number.isFinite(v)) out[k] = Math.min(GLASS_SPECS[k].max, Math.max(GLASS_SPECS[k].min, v));
  }
  return out as GlassSettings;
}
