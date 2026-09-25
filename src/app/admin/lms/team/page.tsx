"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Users, Loader2, Shield, ShieldOff } from "lucide-react";

type Member = {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function AdminTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const myId = (session?.user as any)?.id as string | undefined;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Yuklab bo'lmadi");
      setMembers(data.users);
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const toggleRole = async (m: Member) => {
    const nextRole = m.role === "admin" ? "user" : "admin";
    const isSelf = myId && String(myId) === String(m.id);
    const selfWarn = isSelf && nextRole === "user"
      ? " DIQQAT: o'z adminligingizni olsangiz, admin panelga kira olmaysiz!"
      : "";
    if (!confirm(`"${m.name}" ${nextRole === "admin" ? "admin qilinsinmi" : "adminlikdan olinsinmi"}?${selfWarn}`)) return;
    setActing(m.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.id, role: nextRole }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Xatolik");
      load();
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setActing(null);
    }
  };

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const admins = members.filter((m) => m.role === "admin");

  return (
    <div className="flex bg-transparent min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="p-8 max-w-6xl">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Jamoani boshqarish</h1>
          <p className="text-sm text-neutral-500 mb-8">Adminlar va ruxsatlar — {admins.length} admin · {members.length} foydalanuvchi</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...
            </div>
          ) : error ? (
            <div className="bg-white border border-rose-200 rounded-2xl p-6 text-sm font-semibold text-rose-700">
              {error}
              <button onClick={load} className="ml-3 underline">Qayta urinish</button>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Jamoa jadvali">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th scope="col" className="text-left p-4 text-xs font-bold text-neutral-500 uppercase">A'zo</th>
                      <th scope="col" className="text-left p-4 text-xs font-bold text-neutral-500 uppercase hidden sm:table-cell">Rol</th>
                      <th scope="col" className="text-left p-4 text-xs font-bold text-neutral-500 uppercase hidden md:table-cell">Holat</th>
                      <th scope="col" className="text-right p-4 text-xs font-bold text-neutral-500 uppercase">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {members.map((m) => {
                      const isSelf = myId && String(myId) === String(m.id);
                      return (
                        <tr key={m.id} className="hover:bg-neutral-50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-900 text-white font-bold text-sm">
                                {m.name?.[0]}{m.surname?.[0] || ""}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-neutral-900">{m.name} {m.surname}</p>
                                <p className="text-xs text-neutral-500">{m.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 hidden sm:table-cell">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-neutral-100 text-neutral-600"}`}>
                              {m.role === "admin" && <Shield className="w-3 h-3" />}
                              {m.role === "admin" ? "Admin" : "Xodim"}
                            </span>
                          </td>
                          <td className="p-4 hidden md:table-cell">
                            <span className="text-xs text-neutral-600">{m.status === "approved" ? "Tasdiqlangan" : m.status === "pending" ? "Kutilayotgan" : "Rad etilgan"}</span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {isSelf && (
                                <span className="text-[11px] font-bold text-blue-600">Bu siz</span>
                              )}
                              <button
                                onClick={() => toggleRole(m)}
                                disabled={acting === m.id}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${m.role === "admin" ? "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50" : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"}`}
                              >
                                {acting === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : m.role === "admin" ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                {m.role === "admin" ? "Adminlikdan olish" : "Admin qilish"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {members.length === 0 && (
                <div className="p-10 text-center">
                  <Users className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
                  <p className="text-sm text-neutral-500">Foydalanuvchi topilmadi</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

