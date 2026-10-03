"use client";

// components/admin/ai/AiToolForm.tsx
// Vosita maydonlari serverdan keladi (ToolDef.fields) — shuning uchun chat va
// "imkoniyatlar" kartalari bir xil shakl ishlatadi va yangi vosita qo'shilsa
// shu yerda o'zgartirish kerak bo'lmaydi.

import { useMemo, useState } from "react";
import { Loader2, Search, X, Check, AlertTriangle, ChevronDown } from "lucide-react";
import type { Capabilities, ToolField, ToolMeta } from "./types";

type Props = {
  tool: ToolMeta;
  caps: Capabilities;
  onSubmit: (tool: string, args: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  busy?: boolean;
};

export function AiToolForm({ tool, caps, onSubmit, onCancel, busy }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(tool));
  const [error, setError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");

  const users = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return caps.pickers.users.slice(0, 60);
    return caps.pickers.users
      .filter(
        (u) =>
          u.label.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q) ||
          u.position.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [caps.pickers.users, userQuery]);

  const set = (key: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const missing = tool.fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.key];
      if (f.type === "multiselect") return !Array.isArray(v) || v.length === 0;
      if (f.type === "boolean") return v !== true;
      return v === undefined || v === null || v === "";
    })
    .map((f) => f.label);

  const handleSubmit = async () => {
    if (missing.length > 0) {
      setError(`To'ldirish kerak: ${missing.join(", ")}`);
      return;
    }
    setError(null);
    await onSubmit(tool.name, values);
  };

  const usesUserPicker = tool.fields.some((f) => f.entity === "user" || f.type === "multiselect");

  return (
    <div className="space-y-4">
      {tool.needsConfirm && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Bu amal <strong>qaytarib bo'lmaydi</strong>. bajarishdan oldin ro'yxatni yana bir bor tekshiring.
          </span>
        </div>
      )}

      {tool.fields.length === 0 && (
        <p className="rounded-lg bg-slate-50 px-3.5 py-3 text-[13px] text-slate-600">
          Bu vosita qo'shimcha argument talab qilmaydi — tugmani bosing.
        </p>
      )}

      {tool.fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label field={field} />
          <Control
            field={field}
            value={values[field.key]}
            onChange={(v) => set(field.key, v)}
            caps={caps}
            users={users}
          />
          {field.hint && <p className="text-[11.5px] leading-snug text-slate-500">{field.hint}</p>}
        </div>
      ))}

      {usesUserPicker && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Xodim qidirish: ism, pochta, bo'lim..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <p className="text-[11.5px] text-slate-500">
            Xodimni tanlang — u yuqoridagi maydonlardagi tanlangan ro'yxatga qo'shiladi.
          </p>
          <div className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
            {users.length === 0 && (
              <p className="px-1 py-2 text-[12.5px] text-slate-500">Hech kim topilmadi.</p>
            )}
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => addUser(tool.fields, values, set, u.id)}
                className="flex w-full items-center justify-between rounded-md border border-transparent bg-white px-2.5 py-1.5 text-left text-[12.5px] transition hover:border-indigo-200 hover:bg-indigo-50/60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{u.label}</span>
                  <span className="block truncate text-[11.5px] text-slate-500">
                    {u.email}
                    {u.department ? ` · ${u.department}` : ""}
                  </span>
                </span>
                <Check className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Bekor qilish
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-indigo-900/15 transition hover:brightness-110 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? "Bajarilmoqda..." : "Bajarish"}
        </button>
      </div>
    </div>
  );
}

function Label({ field }: { field: ToolField }) {
  return (
    <label className="block text-[12.5px] font-semibold text-slate-700">
      {field.label}
      {field.required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}

function Control({
  field,
  value,
  onChange,
  caps,
  users,
}: {
  field: ToolField;
  value: unknown;
  onChange: (v: unknown) => void;
  caps: Capabilities;
  users: Capabilities["pickers"]["users"];
}) {
  const base =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  if (field.type === "boolean") {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[13px] transition ${
          value === true
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <span>{value === true ? "Ha" : "Yo'q"}</span>
        <span
          className={`h-5 w-9 rounded-full p-0.5 transition ${value === true ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white transition ${value === true ? "translate-x-4" : ""}`}
          />
        </span>
      </button>
    );
  }

  if (field.type === "select") {
    const options = field.options || [];
    return (
      <div className="relative">
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} appearance-none pr-8`}
        >
          <option value="">— tanlang —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    );
  }

  if (field.type === "multiselect") {
    const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
    const source = sourceFor(field, caps);
    return (
      <div className="space-y-2">
        <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {source.length === 0 && (
            <p className="px-3 py-3 text-[12.5px] text-slate-500">Ro'yxat bo'sh.</p>
          )}
          {source.map((opt) => {
            const isOn = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onChange(isOn ? selected.filter((v) => v !== opt.id) : [...selected, opt.id])
                }
                className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-[12.5px] transition last:border-0 ${
                  isOn ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-slate-800">{opt.label}</span>
                  <span className="block truncate text-[11.5px] text-slate-500">{opt.meta}</span>
                </span>
                {isOn ? (
                  <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded border border-slate-300" />
                )}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((id) => {
              const opt = source.find((s) => s.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11.5px] text-indigo-700"
                >
                  <span className="max-w-[180px] truncate">{opt?.label || id}</span>
                  <button
                    type="button"
                    onClick={() => onChange(selected.filter((v) => v !== id))}
                    className="hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (field.type === "entity") {
    // entity bir qiymatli: matn orqali kiritiladi (serverda bazadan topiladi)
    return (
      <input
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholderFor(field)}
        className={base}
      />
    );
  }

  if (field.type === "textarea") {
    const list = Array.isArray(value) ? (value as string[]) : String(value ?? "").split("\n");
    const onBlur = () => onChange(list.filter(Boolean));
    return (
      <textarea
        defaultValue={Array.isArray(value) ? (value as string[]).join("\n") : String(value ?? "")}
        onBlur={onBlur}
        rows={4}
        placeholder={placeholderFor(field)}
        className={`${base} resize-y`}
      />
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={base}
      />
    );
  }

  return (
    <input
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderFor(field)}
      className={base}
    />
  );
}

function sourceFor(field: ToolField, caps: Capabilities): { id: string; label: string; meta: string }[] {
  const p = caps.pickers;
  switch (field.entity) {
    case "attachment":
      return p.attachments.map((a) => ({
        id: a.id,
        label: a.title,
        meta: `${a.words} so'z · ${a.parser}`,
      }));
    case "test":
      return p.tests.map((t) => ({
        id: t.id,
        label: t.title,
        meta: `${t.questions} savol · ${t.status}`,
      }));
    case "lesson":
      return p.lessons.map((l) => ({ id: l.id, label: l.title, meta: l.module }));
    case "course":
      return p.courses.map((c) => ({ id: c.id, label: c.title, meta: "Kurs" }));
    case "job":
      return p.jobs.map((j) => ({ id: j.id, label: j.title, meta: "Kasbiy kurs" }));
    default:
      return p.users.map((u) => ({
        id: u.id,
        label: u.label,
        meta: `${u.email}${u.department ? ` · ${u.department}` : ""}`,
      }));
  }
}

function placeholderFor(field: ToolField) {
  switch (field.entity) {
    case "test":
      return "Test nomi yoki ID (bir nechta — vergul bilan)";
    case "lesson":
      return "Dars nomi yoki ID";
    case "course":
      return "Kurs nomi";
    case "job":
      return "Kasbiy kurs nomi";
    case "user":
      return "Xodim pochta yoki ismi";
    case "attachment":
      return "Fayl nomi";
    default:
      return "";
  }
}

function initialValues(tool: ToolMeta): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of tool.fields) {
    if (field.type === "multiselect") values[field.key] = [];
    if (field.type === "boolean") values[field.key] = false;
  }
  return values;
}

function addUser(
  fields: ToolField[],
  values: Record<string, unknown>,
  set: (key: string, value: unknown) => void,
  userId: string,
) {
  const target = fields.find((f) => f.entity === "user" && f.type !== "multiselect");
  if (target) {
    set(target.key, userId);
    return;
  }
  const list = fields.find((f) => f.type === "multiselect" && !f.entity);
  if (list) {
    const current: string[] = Array.isArray(values[list.key]) ? (values[list.key] as string[]) : [];
    if (!current.includes(userId)) set(list.key, [...current, userId]);
  }
}

export { AiToolForm as default };