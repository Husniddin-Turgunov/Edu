"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { installAdminCacheInvalidation } from "@/lib/admin-cache";
import {
  BookOpen,
  GraduationCap,
  Users,
  BarChart3,
  LogOut,
  ChevronRight,
  Home,
  ListChecks,
  Briefcase,
  UserCheck,
  Clapperboard,
  Award,
  Building2,
  KeyRound,
  Menu,
  X,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/lms", label: "Kurslar", icon: BookOpen, exact: true },
  { href: "/admin/jobs", label: "Kasbiy kurslar", icon: Briefcase },
  { href: "/admin/onboarding", label: "Tanishtiruv", icon: GraduationCap },
  { href: "/admin/lms/tests", label: "Testlar", icon: ListChecks },
  
  { href: "/admin/ai/models", label: "Kirish qoidalari", icon: KeyRound },
  { href: "/admin/skills", label: "Malaka tekshirish", icon: Award },
  { href: "/admin/videos", label: "Videolar", icon: Clapperboard },  { href: "/admin/students", label: "O'quvchilar", icon: UserCheck },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { href: "/admin/departments", label: "Bo'limlar", icon: Building2 },
  { href: "/admin/lms/statistics", label: "Statistika", icon: BarChart3 },
];

/** Mobil menyu: elementlar ketma-ket (stagger) paydo bo'ladi. */
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -14 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 30 },
  },
};

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Boshqa bo'limda o'zgartirish bo'lsa, bu sahifa ma'lumotlari keshini tozalash
  useEffect(() => {
    installAdminCacheInvalidation();
  }, []);

  // Sahifa almashganda mobil menyu yopiladi
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape bilan yopish + orqa fon scroll'ini qulflash
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

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname?.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  const initial = ((session?.user as any)?.name?.[0] || "A").toUpperCase();

  return (
    <>
      {/* ============ MOBIL: ochish tugmasi (FAB, pastda-chapda) ============ */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-5 left-4 z-[60] inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-900/30 transition-shadow hover:shadow-2xl lg:hidden"
        aria-label="Admin menyusini ochish"
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span>Menyu</span>
      </motion.button>

      {/* ============ DESKTOP: doimiy yon panel (avvalgidek) ============ */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-blue-200/60 glass lg:flex lg:sticky lg:top-0 lg:h-screen">
        {/* Logo */}
        <div className="border-b border-neutral-200 px-5 py-4">
          <Link href="/dashboard" className="group flex items-center gap-3">
            <img src="/akela/logo.png" alt="AKELA" className="h-12 w-auto shrink-0 object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold leading-none text-neutral-900">AKELA</span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Admin Panel</span>
            </div>
          </Link>
        </div>

        {/* Back to dashboard */}
        <div className="px-3 pt-3">
          <Link
            href="/dashboard"
            prefetch
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            <Home className="h-4 w-4" />
            <span>Asosiy sahifa</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                scroll={false}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-neutral-700 hover:bg-blue-100/70"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="admin-side-active"
                    className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 shadow-lg shadow-blue-900/20"
                    initial={false}
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                  />
                )}
                <Icon className="relative h-[18px] w-[18px] shrink-0" />
                <span className="relative flex-1">{item.label}</span>
                {active && <ChevronRight className="relative h-3.5 w-3.5" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-neutral-200 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-neutral-900">System Admin</div>
              <div className="truncate text-xs text-neutral-500">Akela Group</div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============ MOBIL: orqa fon (backdrop) ============ */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="admin-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[70] bg-slate-900/45 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ============ MOBIL: chapdan chiqadigan panel ============ */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="admin-nav-drawer"
            id="admin-mobile-nav"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-label="Admin bo'limlari"
            className="fixed inset-y-0 left-0 z-[80] flex w-[86%] max-w-[19rem] flex-col bg-[#EAF1FE] shadow-2xl shadow-slate-900/30 lg:hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b border-blue-200/70 px-4 py-3">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3"
              >
                <img src="/akela/logo.png" alt="AKELA" className="h-11 w-auto object-contain" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[15px] font-bold leading-none text-neutral-900">AKELA</span>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Admin Panel
                  </span>
                </span>
              </Link>
              <motion.button
                type="button"
                onClick={() => setOpen(false)}
                whileTap={{ scale: 0.92 }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-200 bg-white/70 text-neutral-600 transition-colors hover:bg-white hover:text-rose-600"
                aria-label="Menyuni yopish"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </motion.button>
            </div>

            <motion.nav
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
            >
              <motion.div variants={itemVariants}>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-white/70 hover:text-neutral-900"
                >
                  <Home className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">Asosiy sahifa</span>
                </Link>
              </motion.div>

              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);
                return (
                  <motion.div key={item.href} variants={itemVariants}>
                    <Link
                      href={item.href}
                      prefetch
                      scroll={false}
                      onClick={() => setOpen(false)}
                      className={`relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                        active
                          ? "text-white"
                          : "text-neutral-700 hover:bg-white/70 hover:text-neutral-900"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="admin-mobile-active"
                          className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 shadow-lg shadow-blue-900/20"
                          initial={false}
                          transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                        />
                      )}
                      <Icon className="relative h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      <span className="relative flex-1">{item.label}</span>
                      {active && (
                        <ChevronRight className="relative h-4 w-4" aria-hidden="true" />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.nav>

            <div className="border-t border-neutral-200 p-3">
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-neutral-900">
                    System Admin
                  </div>
                  <div className="truncate text-xs text-neutral-500">Akela Group</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  title="Chiqish"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 border-b border-blue-200/60 glass px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-neutral-900 sm:text-xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
