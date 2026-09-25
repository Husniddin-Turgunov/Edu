"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, GraduationCap, BookOpen, LogIn, LogOut, User, LayoutDashboard, Shield, Home, Users, Building2, ScrollText, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Locale, UiStrings } from "@/lib/akela-content";

const NAV_ITEMS: { id: string; key: keyof UiStrings; href?: string }[] = [
  { id: "home", key: "nav_home" },
  { id: "onboarding", key: "nav_onboarding" },
  { id: "structure", key: "nav_structure" },
  { id: "discipline", key: "nav_discipline" },
  { id: "bitrix-guides", key: "nav_guides" },
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
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

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
    const path = window.location.pathname;
    // Bitrix yo'riqlari — avval joriy sahifada bo'lim bo'lsa scroll, aks holda /
    if (id === "bitrix-guides") {
      const el = document.getElementById("bitrix-guides");
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      router.push("/#bitrix-guides");
      return;
    }
    // If not on homepage, navigate to homepage first
    if (path !== "/") {
      router.push(`/#${id}`);
      return;
    }
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
          className="flex items-center rounded-xl px-0 py-0 transition-transform hover:scale-[1.02]"
        >
          <span className="relative grid h-16 w-16 place-items-center sm:h-20 sm:w-20 -my-2">
            <img
              src="/akela/logo.png"
              alt="AKELA"
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
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
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600"
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          ))}
          <Link
            href="/courses"
            className="relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
          >
            Darslar
          </Link>
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

          {session ? (
            <>
              <Link href="/dashboard" className="hidden h-8 items-center gap-1.5 rounded-full glass px-3 text-[13px] font-medium text-[color:var(--emerald-deep)] shadow-sm lg:inline-flex" title="Dashboard">
                <LayoutDashboard className="h-3.5 w-3.5" />
              </Link>
              {isAdmin && (
                <Link href="/admin" className="hidden h-8 items-center gap-1 rounded-full bg-gradient-to-br from-purple-700 to-pink-600 px-3.5 text-[13px] font-medium text-white shadow-md lg:inline-flex">
                  <Shield className="h-3.5 w-3.5" /> Admin
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className="hidden h-8 items-center gap-1.5 rounded-full glass px-3.5 text-[13px] font-medium text-[color:var(--emerald-deep)] shadow-sm lg:inline-flex">
                <LogIn className="h-3.5 w-3.5" /> Kirish
              </Link>
              <Link href="/register" className="hidden h-8 items-center rounded-full bg-gradient-to-br from-indigo-700 to-indigo-600 px-3.5 text-[13px] font-medium text-white shadow-md shadow-indigo-900/15 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] lg:inline-flex">
                Ro'yxatdan o'tish
              </Link>
            </>
          )}

          <button
            onClick={() => go("onboarding")}
            className="hidden h-8 items-center gap-1.5 rounded-full bg-gradient-to-br from-indigo-700 to-indigo-600 px-3.5 text-[13px] font-medium leading-none tracking-tight text-white shadow-md shadow-indigo-900/15 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] lg:inline-flex"
          >
            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
            {strings.hero_cta_start}
          </button>

          {session && (
            <>
              <span className="hidden lg:block h-6 w-px bg-black/10 ml-1" aria-hidden="true" />
              <button onClick={() => signOut({ callbackUrl: "/login" })} className="hidden h-8 w-8 items-center justify-center rounded-full glass text-[color:var(--emerald-deep)] shadow-sm lg:inline-flex" title="Chiqish">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}

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
                      ? "bg-indigo-50 text-[color:var(--emerald-deep)]"
                      : "text-[color:var(--ink-soft)]"
                  }`}
                >
                  {strings[item.key]}
                </button>
              ))}
              <Link href="/courses" className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[color:var(--ink-soft)]">
                Darslar
              </Link>
              <div className="my-2 h-px bg-black/10" />
              {session ? (
                <>
                  <Link href="/dashboard" className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[color:var(--ink-soft)]">
                    📊 Dashboard
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-purple-700">
                      🛠 Admin panel
                    </Link>
                  )}
                  <button onClick={() => signOut({ callbackUrl: "/login" })} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-rose-600">
                    🚪 Chiqish
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[color:var(--emerald-deep)]">
                    🔑 Kirish
                  </Link>
                  <Link href="/register" className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-indigo-600">
                    ✍️ Ro'yxatdan o'tish
                  </Link>
                </>
              )}
              <div className="my-2 h-px bg-black/10" />
              <div className="flex items-center justify-around px-2 py-1">
                {(Object.keys(LANG_LABEL) as Locale[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => onLocaleChange(l)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      locale === l
                        ? "bg-indigo-700 text-white"
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
