/**
 * akela-staffing.json dan bo'limlar va lavozimlarni DB ga import qiladi.
 * Department va Position jadvallariga yozadi.
 *
 * Ishga tushirish: npx tsx scripts/seed-departments.ts
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

type Member = {
  code: string;
  role: string;
  department: string;
  name: string;
};

type DeptGroup = {
  department: string;
  members: Member[];
};

// Bo'lim ranglari — har bir bo'lim uchun alohida
const DEPT_COLORS: Record<string, string> = {
  "AKELA GROUP": "#6366f1",
  "Департамент управления AGM/101": "#8b5cf6",
  "Отдел управления AGM/101/01": "#a78bfa",
  "Отдел офиса AGM/101/02": "#06b6d4",
  "Отдел корпоративной безопасности AGM/101/03": "#ef4444",
  "Административно-хозяйственный отдел (АХО) AGM/101/04": "#f97316",
  "Колл-центр AGM/101/05": "#22c55e",
  "Департамент по работе с персоналом AGM/102": "#ec4899",
  "Департамент Маркетинга и продаж AGM/103": "#3b82f6",
  "Отдел проектных продаж AGM/103/01": "#0ea5e9",
  "Отдел продуктных продаж AGM/103/02": "#14b8a6",
  "Отдел продаж запасных частей AGM/103/03": "#10b981",
  "Отдел продаж услуг логистики и контрактации AGM/103/04": "#84cc16",
  "Отдел Маркетинга AGM/103/08": "#6366f1",
  "Финансовый департамент AGM/104": "#eab308",
  "Отдел бухгалтерии и финансового учёта AGM/104/03": "#f59e0b",
  "Операционный департамент AGM/105": "#8b5cf6",
  "Отдел закупа AGM/105/01": "#a855f7",
  "Отдел логистики и контрактации AGM/105/02": "#d946ef",
  "Отдел склада AGM/105/03": "#f43f5e",
  "Oтдел технической поддержки AGM/105/04": "#64748b",
};

// Bo'lim ikonalari
const DEPT_ICONS: Record<string, string> = {
  "AKELA GROUP": "briefcase",
  "Департамент управления AGM/101": "shield",
  "Отдел управления AGM/101/01": "shield",
  "Отдел офиса AGM/101/02": "headphones",
  "Отдел корпоративной безопасности AGM/101/03": "shield",
  "Административно-хозяйственный отдел (АХО) AGM/101/04": "truck",
  "Колл-центр AGM/101/05": "headphones",
  "Департамент по работе с персоналом AGM/102": "graduation",
  "Департамент Маркетинга и продаж AGM/103": "chart",
  "Отдел проектных продаж AGM/103/01": "chart",
  "Отдел продуктных продаж AGM/103/02": "chart",
  "Отдел продаж запасных частей AGM/103/03": "wrench",
  "Отдел продаж услуг логистики и контрактации AGM/103/04": "truck",
  "Отдел Маркетинга AGM/103/08": "megaphone",
  "Финансовый департамент AGM/104": "chart",
  "Отдел бухгалтерии и финансового учёта AGM/104/03": "chart",
  "Операционный департамент AGM/105": "cpu",
  "Отдел закупа AGM/105/01": "briefcase",
  "Отдел логистики и контрактации AGM/105/02": "truck",
  "Отдел склада AGM/105/03": "truck",
  "Oтдел технической поддержки AGM/105/04": "wrench",
};

function extractDeptCode(name: string): string {
  const m = name.match(/AGM\/[\d\/]+/);
  return m ? m[0] : "";
}

async function main() {
  console.log("[seed-departments] Boshladi...");

  // JSON ni o'qish
  const jsonPath = path.join(process.cwd(), "src", "data", "akela-staffing.json");
  const raw = await fs.readFile(jsonPath, "utf8");
  const data = JSON.parse(raw) as { departments: DeptGroup[] };

  let deptOrder = 0;
  let totalPositions = 0;
  let totalDepts = 0;

  for (const deptGroup of data.departments) {
    const deptName = deptGroup.department;
    const color = DEPT_COLORS[deptName] || "#6366f1";
    const icon = DEPT_ICONS[deptName] || "briefcase";

    // Bo'limni topish yoki yaratish
    let department = await prisma.department.findUnique({
      where: { name: deptName },
    });

    if (!department) {
      department = await prisma.department.create({
        data: {
          name: deptName,
          description: `Tashkilot tuzilmasidagi bo'lim — ${extractDeptCode(deptName)}`,
          color,
          icon,
          order: deptOrder,
        },
      });
      totalDepts++;
      console.log(`  + Bo'lim: ${deptName}`);
    } else {
      // Rang va ikonani yangilash
      await prisma.department.update({
        where: { id: department.id },
        data: { color, icon, order: deptOrder },
      });
    }

    deptOrder++;

    // Unique lavozimlar (role) ni aniqlash
    const uniqueRoles = new Map<string, Member[]>();
    for (const member of deptGroup.members) {
      const role = member.role;
      if (!uniqueRoles.has(role)) {
        uniqueRoles.set(role, []);
      }
      uniqueRoles.get(role)!.push(member);
    }

    let posOrder = 0;
    for (const [roleName, _members] of uniqueRoles) {
      // Lavozim allaqachon bormi?
      const existingPos = await prisma.position.findFirst({
        where: {
          departmentId: department.id,
          name: roleName,
        },
      });

      if (!existingPos) {
        await prisma.position.create({
          data: {
            departmentId: department.id,
            name: roleName,
            description: `${_members.length} nafar xodim`,
            order: posOrder,
          },
        });
        totalPositions++;
        console.log(`    + Lavozim: ${roleName} (${_members.length} nafar)`);
      }

      posOrder++;
    }
  }

  console.log(`\n[seed-departments] Tugadi!`);
  console.log(`  Yangi bo'limlar: ${totalDepts}`);
  console.log(`  Yangi lavozimlar: ${totalPositions}`);
  console.log(`  Jami bo'limlar: ${data.departments.length}`);
}

main()
  .catch((e) => {
    console.error("[seed-departments] Xato:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
