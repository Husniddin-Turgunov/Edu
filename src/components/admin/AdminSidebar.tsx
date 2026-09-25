"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
  PenLine,
  Award,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/admin/lms", label: "Kurslar", icon: BookOpen, exact: true },
  { href: "/admin/jobs", label: "Kasbiy kurslar", icon: Briefcase },
  { href: "/admin/onboarding", label: "Tanishtiruv", icon: GraduationCap },
  { href: "/admin/lms/tests", label: "Testlar", icon: ListChecks },
  { href: "/admin/skills", label: "Malaka tekshirish", icon: Award },
  { href: "/admin/videos", label: "Videolar", icon: Clapperboard },
  { href: "/admin/students", label: "O'quvchilar", icon: UserCheck },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { href: "/admin/departments", label: "Bo'limlar", icon: Building2 },
  { href: "/admin/lms/statistics", label: "Statistika", icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname?.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <aside className="w-64 shrink-0 bg-[#EAF1FE]/85 backdrop-blur-xl border-r border-blue-200/60 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-neutral-200">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <img src="/akela/logo.png" alt="AKELA" className="h-12 w-auto object-contain shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[15px] text-neutral-900 leading-none">AKELA</span>
            <span className="text-[10px] text-neutral-500 tracking-wider uppercase">Admin Panel</span>
          </div>
        </Link>
      </div>

      {/* Back to dashboard */}
      <div className="px-3 pt-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Asosiy sahifa</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20"
                  : "text-neutral-700 hover:bg-blue-100/70"
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active && (
                <motion.div
                  layoutId="admin-nav-indicator"
                  className="absolute right-2"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </motion.div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-neutral-200 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {((session?.user as any)?.name?.[0] || "A").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-neutral-900 truncate">
              System Admin
            </div>
            <div className="text-xs text-neutral-500 truncate">
              Akela Group
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-md text-neutral-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Chiqish"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 bg-[#EAF1FE]/80 backdrop-blur-md border-b border-blue-200/60 px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
          {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
