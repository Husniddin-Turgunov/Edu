"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Settings, Loader2, Save, CheckCircle2 } from "lucide-react";

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ registrationOpen: true, supportContact: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setForm({ registrationOpen: data.settings.registrationOpen !== false, supportContact: data.settings.supportContact || "" });
    } catch {
      // standart qiymatlar qoladi
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setForm({ registrationOpen: data.settings.registrationOpen, supportContact: data.settings.supportContact || "" });
        setMsg({ kind: "ok", text: "Sozlamalar saqlandi" });
      } else {
        setMsg({ kind: "err", text: data.error || "Saqlab bo'lmadi" });
      }
    } catch {
      setMsg({ kind: "err", text: "Tarmoq xatosi" });
    } finally {
      setSaving(false);
    }
  };

  if (status !== "authenticated") {
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
        <div className="p-8 max-w-3xl">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Sozlamalar</h1>
          <p className="text-sm text-neutral-500 mb-8">Tizim parametrlari</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-900 text-white shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900">Portal sozlamalari</p>
                  <p className="text-xs text-neutral-500 mt-0.5">O'zgarishlar darhol kuchga kiradi</p>
                </div>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 px-4 py-3 cursor-pointer hover:bg-neutral-50">
                <span>
                  <span className="block text-sm font-bold text-neutral-900">Ro'yxatdan o'tish ochiq</span>
                  <span className="block text-xs text-neutral-500 mt-0.5">O'chiq bo'lsa, yangi xodimlar ro'yxatdan o'ta olmaydi</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.registrationOpen}
                  onChange={(e) => setForm({ ...form, registrationOpen: e.target.checked })}
                  className="h-5 w-5 accent-neutral-900"
                />
              </label>

              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-1.5">Yordam kontakti</label>
                <input
                  type="text"
                  value={form.supportContact}
                  onChange={(e) => setForm({ ...form, supportContact: e.target.value })}
                  placeholder="Masalan: +998 90 123 45 67"
                  className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
                <p className="text-xs text-neutral-500 mt-1">Login sahifasida "Yordam" qatorida ko'rinadi</p>
              </div>

              {msg && (
                <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${msg.kind === "ok" ? "bg-indigo-50 border border-indigo-200 text-indigo-700" : "bg-rose-50 border border-rose-200 text-rose-700"}`}>
                  {msg.kind === "ok" && <CheckCircle2 className="w-4 h-4" />}
                  {msg.text}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 rounded-xl hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Saqlash
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

