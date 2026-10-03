"use client";

// components/admin/ai/AiAccessMatrix.tsx
// "Kimga ko'rinadi" va "kimga qayta topshirishga ruxsat" matritsasi.
// DENY ustun turadi: agar kimdirga yashirilgan bo'lsa, ALLOW qoidasi uni
// ochmaydi. Shuning uchun ikkalasi bir yerda ko'rsatiladi.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import type { Capabilities } from "./types";

type Rule = {
  id: string;
  subjectType: string;
  subjectValue: string;
  subjectLabel: string;
  resourceType: string;
  resourceId: string;
  resourceLabel: string;
  effect: string;
  allowRetake: boolean;
  maxAttempts: number | null;
  reason: string | null;
  createdByName: string | null;
  expiresAt: string | null;
  createdAt: string;
  expired: boolean;
};

const SUBJECT_LABEL: Record<string, string> = {
  user: "Xodim",
  department: "Bo'lim",
  position: "Lavozim",
  role: "Rol",
};

const RESOURCE_LABEL: Record<string, string> = {
  test: "Test",
  lesson: "Dars",
  course: "Kurs",
  module: "Modul",
  job: "Kasbiy kurs",
};

export function AiAccessMatrix({ caps }: { caps: Capabilities }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    subjectType: "user",
    subjectValue: "",
    resourceType: "test",
    resourceId: "",
    effect: "deny",
    allowRetake: false,
    maxAttempts: "",
    reason: "",
    expiresAt: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/access", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRules(data.rules || []);
    } catch (err: any) {
      setError(err?.message || "Qoidalarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: form.subjectType,
          subjectValue: form.subjectValue,
          resourceType: form.resourceType,
          resourceId: form.resourceId,
          effect: form.effect,
          allowRetake: form.allowRetake,
          maxAttempts: form.maxAttempts === "" ? null : Number(form.maxAttempts),
          reason: form.reason,
          expiresAt: form.expiresAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Qoida saqlanmadi");
      await load();
      setShowForm(false);
      setForm({ ...form, subjectValue: "", resourceId: "", reason: "", maxAttempts: "", expiresAt: "" });
    } catch (err: any) {
      setError(err?.message || "Xato");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/ai/access?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch {
      load();
    }
  };

  const filtered = filter === "all" ? rules : rules.filter((r) => r.resourceType === filter);
  const resourceOptions =
    form.resourceType === "test"
      ? caps.pickers.tests
      : form.resourceType === "lesson"
        ? caps.pickers.lessons
        : form.resourceType === "course"
          ? caps.pickers.courses
          : caps.pickers.jobs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow transition hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" /> Yangi qoida
        </button>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] outline-none"
        >
          <option value="all">Barcha resurslar</option>
          {Object.entries(RESOURCE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] text-slate-600">
          {filtered.length} ta qoida
        </span>
        <p className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          DENY ustun turadi: yashirilgan resursni ALRUx ochmaydi
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </p>
      )}

      {showForm && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Kimga"
              value={form.subjectType}
              onChange={(v) => setForm({ ...form, subjectType: v, subjectValue: "" })}
              options={Object.entries(SUBJECT_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />

            {form.subjectType === "user" ? (
              <Select
                label="Xodim"
                value={form.subjectValue}
                onChange={(v) => setForm({ ...form, subjectValue: v })}
                placeholder="Xodimni tanlang"
                options={caps.pickers.users.map((u) => ({ value: u.id, label: `${u.label} (${u.email})` }))}
              />
            ) : (
              <Select
                label={form.subjectType === "department" ? "Bo'lim" : form.subjectType === "position" ? "Lavozim" : "Rol"}
                value={form.subjectValue}
                onChange={(v) => setForm({ ...form, subjectValue: v })}
                placeholder="— tanlang —"
                options={
                  form.subjectType === "department"
                    ? caps.pickers.departments.map((d) => ({ value: d, label: d }))
                    : form.subjectType === "position"
                      ? caps.pickers.positions.map((d) => ({ value: d, label: d }))
                      : ["user", "admin", "grader"].map((r) => ({ value: r, label: r }))
                }
              />
            )}

            <Select
              label="Resurs turi"
              value={form.resourceType}
              onChange={(v) => setForm({ ...form, resourceType: v, resourceId: "" })}
              options={Object.entries(RESOURCE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            />

            <Select
              label="Resurs"
              value={form.resourceId}
              onChange={(v) => setForm({ ...form, resourceId: v })}
              placeholder="— tanlang —"
              options={resourceOptions.map((r) => ({ value: r.id, label: r.title }))}
            />

            <Select
              label="Amal"
              value={form.effect}
              onChange={(v) => setForm({ ...form, effect: v })}
              options={[
                { value: "deny", label: "Yashirish (deny)" },
                { value: "allow", label: "Ko'rsatish (allow)" },
              ]}
            />

            <div>
              <label className="block text-[12px] font-semibold text-slate-700">Qayta topshirish</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, allowRetake: !form.allowRetake })}
                className={`mt-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[13px] transition ${
                  form.allowRetake
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{form.allowRetake ? "Ruxsat berilgan" : "Yo'q"}</span>
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            <Input
              label="Urinish limiti (bo'sh = o'zgarmaydi)"
              type="number"
              value={form.maxAttempts}
              onChange={(v) => setForm({ ...form, maxAttempts: v })}
            />
            <Input label="Sabab" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />
            <Input
              label="Muddat (YYYY-MM-DD)"
              type="date"
              value={form.expiresAt}
              onChange={(v) => setForm({ ...form, expiresAt: v })}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] text-slate-600 hover:bg-slate-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={create}
              disabled={busy || !form.subjectValue || !form.resourceId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Saqlash
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-12 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-[13px] text-slate-500">
          Maxsus qoidalar yo'q. Barcha xodimlar asosiy sozlamalar bo'yicha ishlaydi.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Kim</th>
                <th className="px-3 py-2 font-medium">Resurs</th>
                <th className="px-3 py-2 font-medium">Amal</th>
                <th className="px-3 py-2 font-medium">Retake</th>
                <th className="px-3 py-2 font-medium">Sabab</th>
                <th className="px-3 py-2 font-medium">Kim bergan</th>
                <th className="px-3 py-2 font-medium">Sana</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`border-b border-slate-100 ${r.expired ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-slate-800">{r.subjectLabel}</span>
                    <span className="block text-[11px] text-slate-400">{SUBJECT_LABEL[r.subjectType]}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block text-slate-700">{r.resourceLabel}</span>
                    <span className="block text-[11px] text-slate-400">{RESOURCE_LABEL[r.resourceType]}</span>
                  </td>
                  <td className="px-3 py-2">
                    {r.effect === "deny" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
                        <EyeOff className="h-3 w-3" /> yashirilgan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <Eye className="h-3 w-3" /> ko'rinadi
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.allowRetake ? (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-indigo-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {r.maxAttempts ? `${r.maxAttempts} urinish` : "ruxsat bor"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-400">
                        <XCircle className="h-3.5 w-3.5" /> yo'q
                      </span>
                    )}
                  </td>
                  <td className="max-w-[200px] px-3 py-2 text-slate-600">{r.reason || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{r.createdByName || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString("uz-UZ")}
                    {r.expiresAt && (
                      <span className="ml-1 text-[11px] text-amber-600">
                        (muddati {new Date(r.expiresAt).toLocaleDateString("uz-UZ")})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="O'chirish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] outline-none focus:border-indigo-400"
      >
        <option value="">{placeholder || "— tanlang —"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] outline-none focus:border-indigo-400"
      />
    </div>
  );
}

export { AiAccessMatrix as default };