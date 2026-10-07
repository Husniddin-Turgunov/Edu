"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminSidebar, AdminHeader } from "@/components/admin/AdminSidebar";
import { Loader2, RotateCcw, Save, Copy, Check, Sparkles } from "lucide-react";
import { GLASS_DEFAULTS, GLASS_SPECS, sanitizeGlass, type GlassSettings } from "@/lib/liquid-glass-settings";
import { GLASS_EVENT } from "@/lib/liquid-glass-client";

const GROUPS: { title: string; keys: (keyof typeof GLASS_SPECS)[] }[] = [
  { title: "Sinish (refraction)", keys: ["refThickness", "refDistance", "refFactor", "refDispersion"] },
  { title: "Fresnel", keys: ["refFresnelRange", "refFresnelHardness", "refFresnelFactor"] },
  { title: "Glare", keys: ["glareRange", "glareHardness", "glareFactor", "glareConvergence", "glareOppositeFactor", "glareAngle"] },
  { title: "Shakl va xiralik", keys: ["shapeRoundness", "blurRadius", "saturation"] },
];

export default function AdminLiquidGlassPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [s, setS] = useState<GlassSettings>(GLASS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") router.push("/dashboard");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/liquid-glass", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d?.ok && setS(sanitizeGlass(d.settings)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const live = useCallback((next: GlassSettings) => {
    setS(next);
    window.dispatchEvent(new CustomEvent(GLASS_EVENT, { detail: next }));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/liquid-glass", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: s }),
      });
      const d = await res.json();
      if (!d?.ok) throw new Error(d?.error || "Saqlab bo'lmadi");
      setMsg({ ok: true, text: "Saqlandi — butun saytga qo'llanadi" });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || "Xatolik" });
    } finally {
      setSaving(false);
    }
  };

  if (status !== "authenticated" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex bg-transparent min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <AdminHeader
          title="Liquid Glass"
          subtitle="liquid-glass-studio parametrlari — o'zgarish butun saytda jonli ko'rinadi"
          action={
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => live({ ...GLASS_DEFAULTS })}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-600 hover:bg-neutral-50"
              >
                <RotateCcw className="w-4 h-4" /> Standart
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(s, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} JSON
              </button>
              <button
                onClick={save}
                disabled={saving}
                data-testid="glass-save"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Saqlash
              </button>
            </div>
          }
        />

        <div className="p-8 max-w-[1600px] grid gap-6 xl:grid-cols-[380px_1fr]">
          {/* ===== Boshqaruv ===== */}
          <div className="space-y-4">
            {msg && (
              <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {msg.text}
              </p>
            )}
            <label className="glass-card flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3">
              <span className="text-sm font-extrabold text-[color:var(--emerald-deep)]">Sinish va dispersiya (Chromium)</span>
              <input type="checkbox" checked={s.enabled} onChange={(e) => live({ ...s, enabled: e.target.checked })} className="h-5 w-5" />
            </label>
            {GROUPS.map((g) => (
              <section key={g.title} className="glass-card rounded-2xl p-4">
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-neutral-500">{g.title}</h3>
                <div className="space-y-3.5">
                  {g.keys.map((k) => {
                    const sp = GLASS_SPECS[k];
                    return (
                      <div key={k}>
                        <div className="flex items-baseline justify-between gap-2">
                          <label htmlFor={`gl-${k}`} className="text-[13px] font-bold text-neutral-800">{sp.label}</label>
                          <span className="font-mono text-xs font-bold text-blue-700">{Number(s[k]).toFixed(sp.step < 0.01 ? 3 : sp.step < 1 ? 2 : 0)}</span>
                        </div>
                        <input
                          id={`gl-${k}`}
                          data-testid={`glass-${k}`}
                          type="range"
                          min={sp.min}
                          max={sp.max}
                          step={sp.step}
                          value={s[k]}
                          onChange={(e) => live({ ...s, [k]: Number(e.target.value) })}
                          className="w-full accent-blue-600"
                        />
                        <p className="text-[11px] text-neutral-400">{sp.hint}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* ===== Jonli ko'rinish (studio kabi) ===== */}
          <div
            ref={stage}
            className="relative min-h-[620px] overflow-hidden rounded-3xl border border-white/60 shadow-inner"
            style={{
              backgroundColor: "#cfe3ff",
              backgroundImage:
                "radial-gradient(40% 50% at 15% 20%, #ff7a59 0%, transparent 60%), radial-gradient(45% 50% at 85% 25%, #7a5cff 0%, transparent 60%), radial-gradient(50% 55% at 55% 90%, #14c4a8 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 2px, transparent 2px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 2px, transparent 2px 28px)",
            }}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-5 text-center text-xs font-black uppercase tracking-[0.3em] text-white/80 mix-blend-overlay">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Jonli ko'rinish
            </div>

            <div
              className="glass-card absolute h-44 w-72 rounded-[3rem]"
              style={{ left: `calc(${pos.x * 100}% - 9rem)`, top: `calc(${pos.y * 100}% - 5.5rem)`, transition: "left .12s ease-out, top .12s ease-out" }}
            >
              <div className="relative z-10 grid h-full place-items-center text-sm font-black text-[color:var(--emerald-deep)]">Sichqonchani suring</div>
            </div>

            <div className="glass-strong absolute left-8 top-16 flex items-center gap-3 rounded-full px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-sm font-extrabold text-[color:var(--emerald-deep)]">Navbar (glass-strong)</span>
            </div>

            <div className="glass-card absolute bottom-10 left-10 w-72 rounded-3xl p-5">
              <h4 className="relative z-10 text-lg font-black text-[color:var(--emerald-deep)]">glass-card</h4>
              <p className="relative z-10 mt-1 text-sm text-[color:var(--ink-soft)]">Kartalar, modallar va panellar shu uslubda.</p>
            </div>

            <div className="absolute bottom-16 right-10 flex flex-wrap gap-2">
              {["glass-pill", "Tanishtirish", "Bitrix24"].map((t) => (
                <span key={t} className="glass-pill font-bold text-[color:var(--emerald-deep)]">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
