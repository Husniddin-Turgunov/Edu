/**
 * Hodim natijasi + darajasi → PDF (A4) hisobot.
 *
 * Brauzerning "PDF sifatida saqlash" (print) mexanizmidan foydalanadi — bu
 * qo'shimcha paketsiz, kirill/o'zbek harflarini to'liq to'g'ri chiqaradi.
 * Tugma bosilganda hisobot yangi oynada ochiladi va chop etish oynasi
 * avtomatik chaqiriladi (fayl nomi: akela-hisobot-<ism>.pdf).
 */

export type ReportAttempt = {
  testTitle?: string;
  title?: string;
  test?: { title?: string };
  score?: number | null;
  passed?: boolean;
  completedAt?: string | null;
  startedAt?: string | null;
  gradingStatus?: string;
};

export type ReportUser = {
  fullName?: string;
  name?: string;
  surname?: string;
  email?: string;
  department?: string | null;
  position?: string | null;
  level?: string;
  avgScore?: number;
  totalAttempts?: number;
  totalPassed?: number;
  passRate?: number;
  testResults?: ReportAttempt[];
};

export function reportFullName(user: ReportUser): string {
  return (
    [user.surname, user.name].filter(Boolean).join(" ").trim() ||
    user.fullName ||
    user.email ||
    "Noma'lum"
  );
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function levelOf(avgScore: number, level?: string): string {
  if (level) return level;
  if (avgScore >= 86) return "I daraja";
  if (avgScore >= 70) return "II daraja";
  if (avgScore > 0) return "III daraja";
  return "Baholanmagan";
}

function levelColor(level: string): string {
  if (level === "I daraja") return "#7c3aed";
  if (level === "II daraja") return "#2563eb";
  if (level === "III daraja") return "#d97706";
  return "#6b7280";
}

export function buildReportHtml(user: ReportUser): string {
  const fullName = reportFullName(user);
  const avgScore = typeof user.avgScore === "number" ? user.avgScore : 0;
  const level = levelOf(avgScore, user.level);
  const accent = levelColor(level);
  const attempts = Array.isArray(user.testResults) ? user.testResults : [];
  const completed = attempts.filter((a) => a.completedAt || a.startedAt);
  const totalAttempts =
    typeof user.totalAttempts === "number" ? user.totalAttempts : completed.length;
  const totalPassed =
    typeof user.totalPassed === "number"
      ? user.totalPassed
      : completed.filter((a) => a.passed).length;
  const passRate =
    typeof user.passRate === "number"
      ? user.passRate
      : totalAttempts
        ? Math.round((totalPassed / totalAttempts) * 100)
        : 0;

  const rows = completed
    .map((a) => {
      const title = a.test?.title || a.testTitle || a.title || "Test";
      const score = typeof a.score === "number" ? `${a.score}%` : "—";
      const status = a.completedAt
        ? a.passed
          ? "O'tdi"
          : "Yiqildi"
        : "Baholanmagan";
      const statusColor = a.completedAt ? (a.passed ? "#059669" : "#dc2626") : "#6b7280";
      return `<tr>
        <td>${esc(title)}</td>
        <td class="c">${esc(score)}</td>
        <td class="c" style="color:${statusColor};font-weight:700">${esc(status)}</td>
        <td class="c">${esc(fmt(a.completedAt || a.startedAt))}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<title>AKELA-hisobot-${esc(fullName.replace(/\s+/g, "-"))}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Noto Sans", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #0f172a;
    font-size: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .head {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #064e3b; padding-bottom: 12px; margin-bottom: 18px;
  }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #064e3b; }
  .brand small { display: block; font-size: 11px; font-weight: 500; letter-spacing: 0; color: #64748b; margin-top: 4px; }
  .doc-title { text-align: right; font-size: 13px; font-weight: 700; color: #0f172a; }
  .doc-title small { display: block; font-size: 10px; color: #64748b; font-weight: 400; margin-top: 4px; }
  .grid { display: flex; gap: 14px; margin-bottom: 16px; }
  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
  .card h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
  .kv { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; }
  .kv span:first-child { color: #64748b; }
  .kv span:last-child { font-weight: 600; text-align: right; }
  .score-box { text-align: center; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; width: 210px; }
  .score { font-size: 40px; font-weight: 800; line-height: 1; }
  .badge {
    display: inline-block; margin-top: 8px; padding: 5px 14px; border-radius: 999px;
    background: ${accent}; color: #fff; font-weight: 700; font-size: 12px;
  }
  .stats { display: flex; gap: 10px; margin: 14px 0 18px; }
  .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center; }
  .stat b { display: block; font-size: 20px; }
  .stat span { font-size: 10px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 9px; text-align: left; font-size: 11px; }
  th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: #475569; }
  td.c, th.c { text-align: center; white-space: nowrap; }
  .empty { padding: 16px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 10px; }
  .foot { margin-top: 22px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
  .sign { margin-top: 34px; display: flex; gap: 40px; font-size: 11px; color: #475569; }
  .sign div { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; }
  @media print { .noprint { display: none !important; } }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">AKELA GROUP<small>Malaka tekshirish tizimi</small></div>
    <div class="doc-title">HODIM NATIJASI HISOBOTI<small>${esc(fmt(new Date()))}</small></div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Hodim ma'lumotlari</h3>
      <div class="kv"><span>F.I.Sh</span><span>${esc(fullName)}</span></div>
      <div class="kv"><span>Email</span><span>${esc(user.email || "—")}</span></div>
      <div class="kv"><span>Bo'lim</span><span>${esc(user.department || "Belgilanmagan")}</span></div>
      <div class="kv"><span>Lavozim</span><span>${esc(user.position || "—")}</span></div>
    </div>
    <div class="score-box">
      <h3 style="margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#64748b">O'rtacha ball</h3>
      <div class="score" style="color:${accent}">${avgScore}%</div>
      <div class="badge">${esc(level)}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><b>${totalAttempts}</b><span>Topshirish</span></div>
    <div class="stat"><b style="color:#059669">${totalPassed}</b><span>O'tilgan</span></div>
    <div class="stat"><b>${passRate}%</b><span>Muvaffaqiyat</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Test nomi</th>
        <th class="c">Ball</th>
        <th class="c">Holat</th>
        <th class="c">Sana</th>
      </tr>
    </thead>
    <tbody>
      ${rows || ""}
    </tbody>
  </table>
  ${rows ? "" : `<div class="empty">Hodim hali test topshirmagan</div>`}

  <div class="sign">
    <div>Bo'lim rahbari imzosi</div>
    <div>HR / Malaka bo'limi imzosi</div>
  </div>

  <div class="foot">
    <div>AKELA GROUP · Malaka tekshirish tizimi</div>
    <div>Hisobot sanasi: ${esc(fmt(new Date()))}</div>
  </div>
</body>
</html>`;
}

/**
 * Hodim hisobotini PDF qilib yuklab olish (chop etish oynasi orqali).
 * Fayl nomi: akela-hisobot-<ism-familiya>.pdf
 */
export function downloadUserReportPdf(user: ReportUser): boolean {
  if (typeof window === "undefined") return false;

  const html = buildReportHtml(user);

  // 1) Yangi oyna — fayl nomi oyna sarlavhasidan olinadi (eng ishonchli)
  try {
    const win = window.open("", "akela_report", "width=920,height=1200");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      const run = () => {
        try {
          win.focus();
          win.print();
        } catch {
          /* foydalanuvchi o'zi Ctrl+P qiladi */
        }
      };
      if (win.document.readyState === "complete") {
        setTimeout(run, 400);
      } else {
        win.onload = () => setTimeout(run, 400);
      }
      return true;
    }
  } catch {
    /* pastdagi zaxira variantga o'tamiz */
  }

  // 2) Zaxira: yashirin iframe orqali chop etish (popup bloklanganda)
  try {
    const old = document.getElementById("akela-report-frame");
    if (old) old.remove();
    const frame = document.createElement("iframe");
    frame.id = "akela-report-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) return false;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        /* ignore */
      }
    }, 500);
    return true;
  } catch {
    return false;
  }
}

