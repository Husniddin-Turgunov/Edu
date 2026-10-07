"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import type { UiStrings } from "@/lib/akela-content";

export function Footer({ strings }: { strings: UiStrings }) {
  const [showCredit, setShowCredit] = useState(false);
  const creditRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showCredit) return;
    const onDown = (e: MouseEvent) => {
      if (creditRef.current && !creditRef.current.contains(e.target as Node)) {
        setShowCredit(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCredit(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showCredit]);

  return (
    <footer id="contact" className="relative mt-10 px-4 pb-10 pt-16">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card relative overflow-hidden rounded-[2rem] p-8 sm:p-12"
        >
          {/* Background flourish */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-amber-300/30 to-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-indigo-400/20 to-amber-300/20 blur-3xl" />

          <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            {/* Left: brand */}
            <div>
              <div className="flex items-center gap-3">
                <span className="relative grid h-16 w-16 place-items-center rounded-2xl">
                  <img
                    src="/akela/logo.png"
                    alt="AKELA"
                    className="h-12 w-12 object-contain"
                  />
                </span>
                <div>
                  <div className="text-lg font-extrabold tracking-tight text-[color:var(--emerald-deep)]">
                    {strings.footer_company}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                    Onboarding Portal
                  </div>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-[color:var(--ink-soft)]">
                {strings.footer_tagline}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                 <ContactPill
                   icon={<Mail className="h-3.5 w-3.5" />}
                   label="info@akelagroup.uz"
                 />
                 <ContactPill
                   icon={<Phone className="h-3.5 w-3.5" />}
                   label="+(998) 97 0009561"
                 />
                 <ContactPill
                   icon={<MapPin className="h-3.5 w-3.5" />}
                   label={strings.footer_address}
                   href="https://maps.google.com/maps?q=41.229627,69.149295&ll=41.229627,69.149295&z=16"
                 />
              </div>
            </div>

            {/* Right: newsletter / CTA */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-900/5 to-amber-500/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                {strings.footer_contact_category}
              </div>
              <div className="mt-1 text-sm font-bold text-[color:var(--emerald-deep)]">
                {strings.nav_contact}
              </div>
              <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                {strings.footer_contact_blurb}
              </p>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="mt-4 flex items-center gap-2 rounded-2xl bg-white/60 p-1.5 backdrop-blur"
              >
                <input
                  type="email"
                  placeholder="email@akelagroup.uz"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]/60 focus:outline-none"
                />
                <button
                  type="submit"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="relative mt-10 flex flex-col items-center justify-between gap-3 border-t border-black/10 pt-6 text-xs text-[color:var(--ink-soft)] sm:flex-row">
            <div>
              © {new Date().getFullYear()} {strings.footer_company}.{" "}
              {strings.footer_rights}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-indigo-500" />
              <span>System status: operational</span>
            </div>
          </div>
        </motion.div>

        {/* Powered by SvRvS — click the "R" for creator credit — subtle, compact gap */}
        <div className="mt-3 flex justify-center opacity-60 hover:opacity-80 transition-opacity">
          <span className="text-[10px] tracking-wide text-[color:var(--ink-soft)]/60">
            Powered by{" "}
            <span className="font-normal">
              Sv
              <button
                type="button"
                ref={creditRef}
                onClick={() => setShowCredit((v) => !v)}
                className="relative rounded px-0.5 transition-colors hover:text-[color:var(--ink-soft)] focus:outline-none"
                aria-label="Creator credit"
              >
                R
                <AnimatePresence>
                  {showCredit && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.92 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-2xl glass-strong p-4 text-center shadow-2xl"
                    >
                      <div className="text-xs font-medium text-[color:var(--emerald-deep)]">
                        Abdurashidov Saidakbar tomonidan yaratilgan
                      </div>
                      <a
                        href="https://t.me/SvRvS_3003"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-indigo-700 to-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow transition-transform hover:scale-105"
                      >
                        @SvRvS_3003
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
              vS
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function ContactPill({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="text-[color:var(--emerald-mid)]">{icon}</span>
      <span className="font-medium">{label}</span>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="glass-pill inline-flex items-center gap-2 text-[color:var(--emerald-deep)]"
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="glass-pill inline-flex items-center gap-2 text-[color:var(--emerald-deep)]">
      {inner}
    </div>
  );
}
