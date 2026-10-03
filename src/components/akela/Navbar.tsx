"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, GraduationCap, LogIn, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Locale, UiStrings } from "@/lib/akela-content";

const NAV_ITEMS: { id: string; key: keyof UiStrings; href?: string }[] = [
  { id: "home", key: "nav_home" },
  { id: "onboarding", key: "nav_onboarding" },
  { id: "structure", key: "nav_structure" },
  { id: "discipline", key: "nav_discipline" },
  // Bitrix24 darsliklari — avval "Yo'riqlar" edi, endi to'g'ri nom bilan
  // /guides sahifasiga boradi (maqolalar shu yerda oynanda ochiladi)
  { id: "bitrix-guides", key: "nav_guides", href: "/guides" },
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
  // Faol bo'lim dastlab URL dan olinadi — aks holda chiziq avval "Bosh sahifa"
  // ostida paydo bo'lib, keyin kerakli bo'limga sakrab ketardi (ba'zi sahifalarda
  // "Darslar" ga o'tganda bu sezilarli edi).
  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return "home";
    const h = window.location.hash.replace("#", "");
    return h && NAV_ITEMS.some((n) => n.id === h) ? h : "home";
  });
  // "Darslar" linki /courses ichida ham faol bo'lsin
  const pathname = usePathname() || "";
  const coursesActive = pathname.startsWith("/courses");
  // Bitrix24 darsliklari — /guides va /guides/[id] sahifalarida
  const guidesActive = pathname.startsWith("/guides");
  // Scroll chizig'i scroll hodisasidan ustun turmasligi uchun qisqa "quyiq"
  const lockUntil = useRef(0);
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      // Bosilgandan keyin smooth scroll davomida chiziqni qayta qaynatmaymiz
      if (Date.now() < lockUntil.current) return;
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

  // Bosh sahifaga /#id bilan kelganda — chiziq to'g'ri bo'limda tursin
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && NAV_ITEMS.some((n) => n.id === hash)) {
        setActive(hash);
        lockUntil.current = Date.now() + 900;
        requestAnimationFrame(() => {
          const el = document.getElementById(hash);
          if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
        });
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    // Chiziq darhol tanlangan bo'limga ko'chadi (scroll tugamasdan)
    setActive(id);
    lockUntil.current = Date.now() + 1200;
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
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`flex w-full max-w-7xl items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-500 sm:gap-4 sm:px-4 lg:gap-5 ${
          scrolled ? "glass-strong shadow-xl" : "glass"
        }`}
      >
        <button
          onClick={() => go("home")}
          className="flex shrink-0 items-center rounded-xl px-0 py-0 transition-transform hover:scale-[1.02]"
        >
          <span className="relative grid h-16 w-16 place-items-center sm:h-20 sm:w-20 -my-2">
            <img
              src="/akela/logo.png"
              alt="AKELA"
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          </span>
        </button>

        {/* Markaziy linklar: barchasi ko'rinadi (md+), hech qachon qirqilmaydi.
            Faol element "suyuqlik" effekti bilan siljiydi — framer-motion layoutId
            spring orqali eski holatdan yangisiga inersiya bilan o'tadi. */}
        {/* Markaziy linklar: lg (1024px) dan boshlab ko'rinadi. O'lchamlar
            clamp() bilan protsional — kenglikka qarab qisqaradi/kengayadi,
            shuning uchun "Darslar" hech qachon til tanlagichining ustiga
            chiqmaydi (RU/EN matnlari uzunroq bo'lganida ham). */}
        <div className="mx-auto hidden min-w-0 shrink items-center gap-[clamp(2px,0.28vw,7px)] lg:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href ? guidesActive : active === item.id;
            const cls = `relative shrink-0 whitespace-nowrap rounded-xl px-[clamp(5px,0.5vw,10px)] py-2 text-[clamp(10px,0.72vw,13px)] font-medium transition-colors`;
            const indicator = (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-liquid-pill"
                    className="absolute inset-0 -z-10 rounded-xl bg-black/[0.05]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                  />
                )}
                <span className={`relative transition-colors ${isActive ? "text-[color:var(--emerald-deep)]" : "text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"}`}>
                  {strings[item.key]}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="nav-liquid-underline"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600"
                    initial={false}
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                  />
                )}
              </>
            );

            // href bor elementlar Link (sahifaga olib boradi), qolganlari
            // scroll qiluvchi tugma (bosh sahifa bo'limlari)
            if (item.href) {
              return (
                <Link key={item.id} href={item.href} className={cls} prefetch>
                  {indicator}
                </Link>
              );
            }
            return (
              <button key={item.id} onClick={() => go(item.id)} className={cls}>
                {indicator}
              </button>
            );
          })}
          {/* "Darslar" — boshqa linklar bilan bir xil ko'rinishda (ajratuvchi chiziq yo'q) */}
          <Link
            href="/courses"
            className={`relative shrink-0 whitespace-nowrap rounded-xl px-[clamp(5px,0.5vw,10px)] py-2 text-[clamp(10px,0.72vw,13px)] font-medium transition-colors ${
              coursesActive
                ? "text-[color:var(--emerald-deep)]"
                : "text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
            }`}
          >
            {coursesActive && (
              <motion.span
                layoutId="nav-liquid-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-black/[0.05]"
                transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
              />
            )}
            <span className="relative">Darslar</span>
            {coursesActive && (
              <motion.span
                layoutId="nav-liquid-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600"
                transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
              />
            )}
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:gap-2">
          {/* Markaziy linklar va til tanlagichi o'rtasidagi aniq ajratgich */}
          <span className="hidden h-6 w-px shrink-0 bg-black/10 lg:block" aria-hidden="true" />
          <div className="hidden h-9 shrink-0 items-center gap-0.5 rounded-full bg-black/5 p-1 sm:flex" role="group" aria-label="Tilni tanlash">
            {(Object.keys(LANG_LABEL) as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => onLocaleChange(l)}
                className={`h-7 rounded-full px-[clamp(8px,0.66vw,12px)] text-[clamp(10px,0.72vw,12px)] font-semibold transition-all ${
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
              <Link href="/dashboard" className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3.5 text-[13px] font-medium text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-white lg:inline-flex" title="Dashboard" aria-label="Dashboard">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">Dashboard</span>
              </Link>
              {isAdmin && (
                <Link href="/admin" className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-purple-700 to-pink-600 px-3.5 text-[13px] font-medium text-white shadow-md transition-transform hover:scale-[1.02] lg:inline-flex">
                  <Shield className="h-4 w-4" aria-hidden="true" /> Admin
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3.5 text-[13px] font-medium text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-white lg:inline-flex">
                <LogIn className="h-4 w-4" aria-hidden="true" /> Kirish
              </Link>
              <Link href="/register" className="hidden h-9 shrink-0 items-center rounded-full bg-gradient-to-br from-indigo-700 to-indigo-600 px-3.5 text-[13px] font-medium text-white shadow-md shadow-indigo-900/15 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] lg:inline-flex">
                Ro'yxatdan o'tish
              </Link>
            </>
          )}

          <button
            onClick={() => go("onboarding")}
            className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-indigo-700 to-indigo-600 px-3 text-[13px] font-medium leading-none tracking-tight text-white shadow-md shadow-indigo-900/15 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] lg:inline-flex xl:px-4"
            title={strings.hero_cta_start}
          >
            <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline">{strings.hero_cta_start}</span>
            <span className="sr-only xl:hidden">{strings.hero_cta_start}</span>
          </button>

          {session && (
            <>
              <span className="hidden h-6 w-px shrink-0 bg-black/10 lg:block" aria-hidden="true" />
              <button onClick={() => signOut({ callbackUrl: "/login" })} className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-white hover:text-rose-600 lg:inline-flex" title="Chiqish" aria-label="Chiqish">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl glass lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
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
            className="absolute inset-x-3 top-[5.5rem] z-40 xl:hidden"
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
              <Link
                href="/courses"
                className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${
                  coursesActive ? "bg-indigo-50 text-[color:var(--emerald-deep)]" : "text-[color:var(--ink-soft)]"
                }`}
              >
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
                aria-pressed={locale === l}
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
