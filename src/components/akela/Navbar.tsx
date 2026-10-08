"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  GraduationCap,
  LogOut,
  LayoutDashboard,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Locale, UiStrings } from "@/lib/akela-content";
import { LanguageSwitcher } from "@/components/akela/LanguageSwitcher";

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

// Til tanlagichida bayroq emoji ("stiker") ishlatilmaydi — dizaynga mos
// matnli tugmalar: UZ / RU / EN.
const LANG_LABEL: Record<Locale, { label: string; full: string }> = {
  uz: { label: "UZ", full: "O'zbek" },
  ru: { label: "RU", full: "Русский" },
  en: { label: "EN", full: "English" },
};

/** Mobil menyu elementlari ketma-ket (stagger) paydo bo'ladi. */
const MENU_LIST = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const MENU_ITEM = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 30 },
  },
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
  // Tablet/desktop "3 chiziq" menyusi (lg..xl): pastga ochiladigan glass oyna.
  const [deskOpen, setDeskOpen] = useState(false);
  // Linklar sig'ganmi? Ekranga QARAB emas, haqiqiy o'lchamga qarab qaror
  // qabul qilinadi: RU/EN matnlari UZdan uzun, shuning uchun breakpoint
  // "taxmin" qilib ishlamaydi — sigmasa "3 chiziq" avtomatik chiqadi.
  const [needsMenu, setNeedsMenu] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const logoRef = useRef<HTMLButtonElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);

  /** [logo] + [linklar] + [o'ng guruh] sig'mi? */
  const measureFit = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
    const gap = parseFloat(cs.columnGap || "0") || 0;
    const logo = logoRef.current?.offsetWidth ?? 0;
    const right = rightRef.current?.offsetWidth ?? 0;
    const center = rulerRef.current?.offsetWidth ?? 0;
    // 2 ta bo'shliq (logo|linklar, linklar|o'ng guruh) + 12px zaxira
    const need = logo + center + right + gap * 2 + padX + 12;
    setNeedsMenu(need > el.clientWidth + 0.5);
  }, []);

  useEffect(() => {
    measureFit();
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measureFit);
    ro.observe(el);
    if (rightRef.current) ro.observe(rightRef.current);
    return () => ro.disconnect();
  }, [measureFit, locale, strings]);
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

  /**
   * Chiqish — JORIY domen ichida `/login` ga.
   *
   * Nima uchun `signOut({ callbackUrl: "/login" })` yetarli emas:
   * NextAuth redirect manzilini `NEXTAUTH_URL` dan quradi. Agar brauzer
   * boshqa domen/manzil bo'lsa (masalan Netlify va Vercel bir vaqtda
   * ishlamoqda), chiqish butunlay BOSQA saytga olib ketardi.
   * `redirect: false` — sessiyani shu domen ichida tozalaydi, keyin
   * `router.replace` joriy domenning `/login` siga olib boradi.
   */
  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

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

  // Mobil menyu: Escape bilan yopish va orqa fon scroll'ini qulflash
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Sahifa almashganda menyu yopiladi (ochiq qolib "ikki marta" ko'rinmasin)
  useEffect(() => {
    setOpen(false);
    setDeskOpen(false);
  }, [pathname]);

  // "3 chiziq" oynasi: Escape bilan yopiladi
  useEffect(() => {
    if (!deskOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeskOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deskOpen]);

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

  /**
   * Mobil menyu elementi klasslari. Emoji ("stiker") yo'q: lucide ikonkasi
   * + matn, tugma ko'rinishida; faol element "suyuqlik" effekti bilan
   * siljiydi (layoutId).
   */
  const mobileItemCls = (current: boolean, tone?: string) =>
    `relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
      current
        ? "text-[color:var(--emerald-deep)]"
        : `${tone || "text-[color:var(--ink-soft)]"} hover:bg-black/[0.04]`
    }`;

  /** Faol element ostidagi "suyuqlik" belgisi (barcha elementlar uchun bitta). */
  const mobileActivePill = (current: boolean) =>
    current ? (
      <motion.span
        layoutId="nav-mobile-active"
        className="absolute inset-0 -z-10 rounded-xl bg-black/[0.05]"
        initial={false}
        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
      />
    ) : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
      <motion.nav
        ref={navRef}
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`relative flex w-full max-w-7xl items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-500 sm:gap-4 sm:px-4 lg:gap-5 ${
          scrolled ? "glass-strong bg-white/97 shadow-xl" : "glass bg-white/85"
        }`}
      >
        {/* "Chizg'ich": linklarning joriy tildagi HAQIQIY kengligi. Ko'rinmaydi,
            lekin doim DOM da turadi — shuning uchun linklar sig'ish-qo'shish
            qarori ekranga emas, matnning uzunligiga qarab qabul qilinadi.
            Har bir til (UZ/RU/EN) o'z o'lchamini beradi. */}
        <div
          ref={rulerRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 z-[-1] flex h-0 items-center gap-1 py-1"
        >
          {NAV_ITEMS.map((item) => (
            <span
              key={item.id}
              className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium 2xl:px-3.5"
            >
              {strings[item.key]}
            </span>
          ))}
          <span className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium 2xl:px-3.5">
            Darslar
          </span>
        </div>

        <button
          ref={logoRef}
          onClick={() => go("home")}
          className="flex shrink-0 items-center rounded-xl px-0 py-0 transition-transform hover:scale-[1.02]"
        >
          <span className="relative grid h-16 w-16 place-items-center sm:h-[4.5rem] sm:w-[4.5rem] -my-2">
            <img
              src="/akela/logo.png"
              alt="AKELA"
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          </span>
        </button>

        {/* Markaziy linklar FAQAT sigsa ko'rinadi (o'lchamga qarab qaror —
            `needsMenu`). Sigmasa ular "3 chiziq" orqali ochiladigan glass
            oynada qoladi. Shuning uchun navbar chegarasi hech qachon
            buzilmaydi: o'ng guruh tashqariga chiqib keta olmaydi. */}
        <nav
          className={`mx-auto shrink-0 items-center justify-center gap-1 py-1 ${
            needsMenu ? "hidden" : "hidden lg:flex"
          }`}
          aria-label="Asosiy"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.href ? guidesActive : active === item.id;
            const cls = `relative shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-[colors,transform] duration-200 ease-out hover:bg-black/[0.04] hover:scale-[1.03] active:scale-[0.97] 2xl:px-3.5`;
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
              </>
            );
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
          <Link
            href="/courses"
            className={`relative shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-[colors,transform] duration-200 ease-out hover:bg-black/[0.04] hover:scale-[1.03] active:scale-[0.97] 2xl:px-3.5 ${
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
          </Link>
        </nav>

        {/* "3 chiziq": linklar sigmagan o'lchamlarda (lg..xl) — pastda ochiladigan
            glass morfizm oynasi. Chiziqlar yopilganda X ga aylanadi. */}
        <button
          type="button"
          onClick={() => setDeskOpen((v) => !v)}
          className={`h-9 w-9 shrink-0 place-items-center rounded-xl glass border border-white/70 text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-white/90 ${
            needsMenu ? "hidden lg:grid" : "hidden"
          }`}
          aria-label={deskOpen ? "Menyuni yopish" : "Menyuni ochish"}
          aria-expanded={deskOpen}
        >
          <span className="relative block h-4 w-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute left-0 block h-[2px] w-full rounded-full bg-current transition-all duration-300 ease-out"
                style={{
                  top: deskOpen ? 7 : i * 6 + 1,
                  transform: deskOpen
                    ? i === 1
                      ? "scaleX(0)"
                      : `rotate(${i === 0 ? 45 : -45}deg)`
                    : "none",
                  transformOrigin: "center",
                }}
              />
            ))}
          </span>
        </button>

        <div ref={rightRef} className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:gap-2">
          {/* Markaziy linklar va til tanlagichi o'rtasidagi aniq ajratgich */}
          <span className="hidden h-6 w-px shrink-0 bg-black/10 lg:block" aria-hidden="true" />
          {/* Til tanlagich: "suv tomchisi" — faol til aniq ko'rinadi, ko'rsatkich
              spring bilan siljiydi, cho'ziladi va barmoq bilan suriladi.
              Mobil menyudagi tanlagich esa `sm` dan pastda ko'rinadi. */}
          <LanguageSwitcher locale={locale} labels={LANG_LABEL} onChange={onLocaleChange} />

          {/* "Kirish" va "Ro'yxatdan o'tish" tugmalari OLIB TASHLANDI:
              sayt endi faqat login qilganlarga ko'rinadi (middleware hamma
              sahifani qo'riqlaydi), ya'ni bu yerda sessiyasiz holat bo'lmaydi.
              Ro'yxatdan o'tish kerak bo'lsa — /login sahifasidagi
              "Yangi akkaunt ochish" havolasi ishlatiladi. */}
          {session && (
            <>
              <Link href="/dashboard" className="glass hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/70 px-3.5 text-[13px] font-medium text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-white/90 lg:inline-flex" title="Dashboard" aria-label="Dashboard">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Dashboard</span>
              </Link>
              {isAdmin && (
                <Link href="/admin" className="glass hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-fuchsia-300/50 bg-gradient-to-br from-purple-700/85 to-pink-600/85 px-3.5 text-[13px] font-medium text-white shadow-md transition-transform hover:scale-[1.02] lg:inline-flex">
                  <Shield className="h-4 w-4" aria-hidden="true" /> Admin
                </Link>
              )}
            </>
          )}

          <button
            onClick={() => go("onboarding")}
            className="glass hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-indigo-300/45 bg-gradient-to-br from-indigo-700/85 to-indigo-600/85 px-3 text-[13px] font-medium leading-none tracking-tight text-white shadow-md shadow-indigo-900/15 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] lg:inline-flex 2xl:px-4"
            title={strings.hero_cta_start}
          >
            <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">{strings.hero_cta_start}</span>
          </button>

          {session && (
            <>
              <span className="hidden h-6 w-px shrink-0 bg-black/10 lg:block" aria-hidden="true" />
              <button onClick={() => void handleSignOut()} className="glass hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-white/90 hover:text-rose-600 lg:inline-flex" title="Chiqish" aria-label="Chiqish">
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
      {/* Tablet/desktop "3 chiziq" oynasi: glass morfizm paneli pastga
            animatsiya bilan ochiladi. Inline linklar sigmagan o'lchamlarda
            (lg..xl) faol bo'ladi; xl+ da esa panel yopiq qoladi. */}
        <AnimatePresence>
          {deskOpen && (
            <motion.div
              key="desk-menu"
              initial={{ opacity: 0, y: -12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -12, height: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.7 }}
              data-nav-panel=""
              className="absolute inset-x-0 top-[calc(100%+8px)] z-40 hidden overflow-hidden lg:block"
            >
              <motion.div
                variants={MENU_LIST}
                initial="hidden"
                animate="show"
                className="glass-strong max-h-[min(70vh,32rem)] overflow-y-auto rounded-2xl bg-white/95 p-2 shadow-2xl shadow-black/10 backdrop-blur-2xl"
              >
                {/* Asosiy harakat — CTA (pagedagi "Tanishtirishni boshlash") */}
                <motion.div variants={MENU_ITEM} className="mb-1">
                  <button
                    onClick={() => { setDeskOpen(false); go("onboarding"); }}
                    className="flex w-full items-center gap-3 rounded-xl border border-indigo-300/45 bg-gradient-to-br from-indigo-700/85 to-indigo-600/85 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-900/15 transition-transform active:scale-[0.98]"
                  >
                    <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">{strings.hero_cta_start}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
                  </button>
                </motion.div>

                {/* Sahifadagi BARCHA bo'limlar — hech biri tashqarida qolmaydi.
                    (Dashboard/Admin/Chiqish boshqa sahifaga olib ketadi, shuning
                    uchun ular ataylab shu oynaga kirmaydi.) */}
                {NAV_ITEMS.map((item) => {
                  const isCurrent = item.href ? guidesActive : active === item.id;
                  const inner = (
                    <>
                      {mobileActivePill(isCurrent)}
                      <span className="relative flex-1">{strings[item.key]}</span>
                      {isCurrent && <ChevronRight className="relative h-4 w-4 shrink-0" aria-hidden="true" />}
                    </>
                  );
                  return (
                    <motion.div key={item.id} variants={MENU_ITEM}>
                      {item.href ? (
                        <Link href={item.href} className={mobileItemCls(isCurrent)}>
                          {inner}
                        </Link>
                      ) : (
                        <button onClick={() => go(item.id)} className={mobileItemCls(isCurrent)}>
                          {inner}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
                <motion.div variants={MENU_ITEM}>
                  <Link
                    href="/courses"
                    className={mobileItemCls(coursesActive)}
                  >
                    {mobileActivePill(coursesActive)}
                    <span className="relative flex-1">Darslar</span>
                    {coursesActive && <ChevronRight className="relative h-4 w-4 shrink-0" aria-hidden="true" />}
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Mobil menyu orqasidagi parda: matn sahifa kontenti bilan
          aralashib ketmasligi uchun va tashqariga bosganda yopilish uchun. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[2px] lg:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.7 }}
            /* `lg:hidden`: burger tugma ham `lg:hidden` — shuning uchun menyu
               hech qachon yuqoridagi linklar bilan BIR VAQTDA ko'rinmaydi
               (avval `xl:hidden` edi va 1024-1280px da ikki nusxa chiqardi). */
            className="absolute inset-x-3 top-[5.5rem] z-40 lg:hidden"
          >
            <motion.div
              variants={MENU_LIST}
              initial="hidden"
              animate="show"
              /* `bg-white/95` — glass-strong fon yarim shaffof bo'lgani uchun
                 matn orqadan ko'rinib o'qilmas edi; endi panel deyarli oq. */
              className="glass-strong max-h-[calc(100vh-7.5rem)] overflow-y-auto rounded-2xl bg-white/95 p-2 shadow-2xl shadow-black/10 backdrop-blur-2xl"
            >
              {/* Asosiy harakat — gradient tugma */}
              <motion.div variants={MENU_ITEM} className="mb-1">
                <button
                  onClick={() => go("onboarding")}
                  className="glass flex w-full items-center gap-3 rounded-xl border border-indigo-300/45 bg-gradient-to-br from-indigo-700/85 to-indigo-600/85 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-900/15 transition-transform active:scale-[0.98]"
                >
                  <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-left">{strings.hero_cta_start}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
                </button>
              </motion.div>

              {NAV_ITEMS.map((item) => {
                const isCurrent = item.href ? guidesActive : active === item.id;
                const cls = mobileItemCls(isCurrent);
                const inner = (
                  <>
                    {mobileActivePill(isCurrent)}
                    <span className="relative flex-1">{strings[item.key]}</span>
                    {isCurrent && (
                      <ChevronRight className="relative h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                  </>
                );
                return (
                  <motion.div key={item.id} variants={MENU_ITEM}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        prefetch
                        className={cls}
                        onClick={() => setOpen(false)}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        onClick={() => go(item.id)}
                        className={cls}
                        aria-current={isCurrent ? "true" : undefined}
                      >
                        {inner}
                      </button>
                    )}
                  </motion.div>
                );
              })}

              {/* Darslar */}
              <motion.div variants={MENU_ITEM}>
                <Link
                  href="/courses"
                  prefetch
                  className={mobileItemCls(coursesActive)}
                  onClick={() => setOpen(false)}
                >
                  {mobileActivePill(coursesActive)}
                  <span className="relative flex-1">Darslar</span>
                  {coursesActive && (
                    <ChevronRight className="relative h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </Link>
              </motion.div>

              <div className="my-2 h-px bg-black/10" />

              {/* Kirish/Ro'yxatdan o'tish olib tashlandi — sayt faqat sessiya
                  bilan ochiladi. Faqat tizimga kirgan foydalanuvchi uchun
                  Dashboard / Admin panel / Chiqish ko'rinadi. */}
              {session && (
                <>
                  <motion.div variants={MENU_ITEM}>
                    <Link
                      href="/dashboard"
                      prefetch
                      className={mobileItemCls(false)}
                      onClick={() => setOpen(false)}
                    >
                      <LayoutDashboard className="relative h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="relative flex-1">Dashboard</span>
                    </Link>
                  </motion.div>
                  {isAdmin && (
                    <motion.div variants={MENU_ITEM}>
                      <Link
                        href="/admin"
                        prefetch
                        className={mobileItemCls(false, "text-purple-700 hover:bg-purple-50")}
                        onClick={() => setOpen(false)}
                      >
                        <Shield className="relative h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="relative flex-1">Admin panel</span>
                      </Link>
                    </motion.div>
                  )}
                  <motion.div variants={MENU_ITEM}>
                    <button
                      onClick={() => {
                        setOpen(false);
                        void handleSignOut();
                      }}
                      className={mobileItemCls(false, "text-rose-600 hover:bg-rose-50")}
                    >
                      <LogOut className="relative h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="relative flex-1">Chiqish</span>
                    </button>
                  </motion.div>
                </>
              )}

              <div className="my-2 h-px bg-black/10" />

              {/* Til tanlagich mobil menyuda — faqat `sm` dan KICHIK ekranlarda.
                  sm va undan yuqorida sarlavhadagi tanlagich ko'rinadi, shu sabab
                  ikkalasi hech qachon bir vaqtda chiqmaydi (ikkinchi nusxa yo'q). */}
              <motion.div
                variants={MENU_ITEM}
                role="group"
                aria-label="Tilni tanlash"
                className="flex items-center gap-1 rounded-xl bg-black/[0.04] p-1 sm:hidden"
              >
                {(Object.keys(LANG_LABEL) as Locale[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => onLocaleChange(l)}
                    aria-pressed={locale === l}
                    title={LANG_LABEL[l].full}
                    className={`relative flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                      locale === l
                        ? "text-white"
                        : "text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
                    }`}
                  >
                    {locale === l && (
                      <motion.span
                        layoutId="nav-lang-pill-mobile"
                        className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-600 shadow"
                        initial={false}
                        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                      />
                    )}
                    <span className="relative">{LANG_LABEL[l].label}</span>
                  </button>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
