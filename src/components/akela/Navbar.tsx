"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, GraduationCap } from "lucide-react";
import type { Locale, UiStrings } from "@/lib/akela-content";

const NAV_ITEMS: { id: string; key: keyof UiStrings }[] = [
  { id: "home", key: "nav_home" },
  { id: "onboarding", key: "nav_onboarding" },
  { id: "structure", key: "nav_structure" },
  { id: "discipline", key: "nav_discipline" },
  { id: "contact", key: "nav_contact" },
];

const LANG_LABEL: Record<Locale, { label: string; flag: string }> = {
  uz: { label: "O'z", flag: "🇺🇿" },
  ru: { label: "Ru", flag: "🇷🇺" },
  en: { label: "En", flag: "🇬🇧" },
};

export function Navbar({
  locale,
  strings,
  onLocaleChange,
}: {
  locale: Locale;
  strings: UiStrings;
  onLocaleChange: (l: Locale) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const sections = NAV_ITEMS.map((n) => document.getElementById(n.id));
      const y = window.scrollY + 120;
      let current = "home";
      for (const s of sections) {
        if (s && s.offsetTop <= y) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-all duration-500 sm:px-4 ${
          scrolled ? "glass-strong shadow-xl" : "glass"
        }`}
      >
        <button
          onClick={() => go("home")}
          className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition-transform hover:scale-[1.02]"
        >
          <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 to-amber-500 shadow-lg">
            <img
              src="/akela/logo-white.png"
              alt="AKELA"
              className="h-6 w-6 object-contain"
            />
            <span className="absolute inset-0 rounded-xl ring-1 ring-white/30" />
          </span>
          <span className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-sm font-extrabold tracking-tight text-[color:var(--emerald-deep)]">
              AKELA GROUP
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
              Onboarding Portal
            </span>
          </span>
        </button>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                active === item.id
                  ? "text-[color:var(--emerald-deep)]"
                  : "text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
              }`}
            >
              {strings[item.key]}
              {active === item.id && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-emerald-600"
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-0.5 rounded-xl bg-black/5 p-0.5 sm:flex">
            {(Object.keys(LANG_LABEL) as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => onLocaleChange(l)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  locale === l
                    ? "bg-white text-[color:var(--emerald-deep)] shadow"
                    : "text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
                }`}
              >
                {LANG_LABEL[l].label}
              </button>
            ))}
          </div>

          <button
            onClick={() => go("onboarding")}
            className="hidden rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-transform hover:scale-[1.03] active:scale-95 lg:inline-flex"
          >
            <GraduationCap className="mr-1.5 inline h-4 w-4" />
            {strings.hero_cta_start}
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-xl glass md:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-x-3 top-[5.5rem] z-40 md:hidden"
          >
            <div className="glass-strong rounded-2xl p-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${
                    active === item.id
                      ? "bg-emerald-50 text-[color:var(--emerald-deep)]"
                      : "text-[color:var(--ink-soft)]"
                  }`}
                >
                  {strings[item.key]}
                </button>
              ))}
              <div className="my-2 h-px bg-black/10" />
              <div className="flex items-center justify-around px-2 py-1">
                {(Object.keys(LANG_LABEL) as Locale[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => onLocaleChange(l)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      locale === l
                        ? "bg-emerald-700 text-white"
                        : "text-[color:var(--ink-soft)]"
                    }`}
                  >
                    {LANG_LABEL[l].flag} {LANG_LABEL[l].label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
