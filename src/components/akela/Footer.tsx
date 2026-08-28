"use client";

import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import type { UiStrings } from "@/lib/akela-content";

export function Footer({ strings }: { strings: UiStrings }) {
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
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-amber-300/30 to-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-400/20 to-amber-300/20 blur-3xl" />

          <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            {/* Left: brand */}
            <div>
              <div className="flex items-center gap-3">
                <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-amber-500 shadow-xl">
                  <img
                    src="/akela/logo-white.png"
                    alt="AKELA"
                    className="h-7 w-7 object-contain"
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
                  label="hr@akelagroup.uz"
                />
                <ContactPill
                  icon={<Phone className="h-3.5 w-3.5" />}
                  label="+998 71 200 80 80"
                />
                <ContactPill
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label={strings.footer_address}
                />
              </div>
            </div>

            {/* Right: newsletter / CTA */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900/5 to-amber-500/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                HR department
              </div>
              <div className="mt-1 text-sm font-bold text-[color:var(--emerald-deep)]">
                {strings.nav_contact}
              </div>
              <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                {strings.footer_tagline}
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
                  className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
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
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-emerald-500" />
              <span>System status: operational</span>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

function ContactPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="glass-pill inline-flex items-center gap-2 text-[color:var(--emerald-deep)]">
      <span className="text-[color:var(--emerald-mid)]">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}
