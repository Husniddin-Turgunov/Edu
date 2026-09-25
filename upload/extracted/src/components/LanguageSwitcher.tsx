"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePreferredLocaleAction } from "@/db/actions";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[1];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function pick(code: Locale) {
    setLocale(code);
    setOpen(false);
    void savePreferredLocaleAction(code).then(() => router.refresh());
  }

  return (
    <div className={`lang-switcher ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lang-flag" aria-hidden>
          {current.flag}
        </span>
      </button>

      {open ? (
        <ul className="lang-menu" role="listbox" aria-label={t("lang")}>
          {LOCALES.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === locale}>
              <button
                type="button"
                className={
                  l.code === locale ? "lang-option active" : "lang-option"
                }
                onClick={() => pick(l.code)}
              >
                <span className="lang-flag sm" aria-hidden>
                  {l.flag}
                </span>
                <span>{l.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
