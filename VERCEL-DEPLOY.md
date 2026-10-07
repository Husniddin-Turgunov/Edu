# Vercel deploy qo'llanmasi

Loyiha: **Akela EDU** (`akela-app`)
Domain: `https://edu.akelagroup.uz`

Bu qo'llanma "No more than 12 Serverless Functions" xatosini yechish usuli.
**Barcha agentlar shu faylni o'qib, aynan shu qoidalarga amal qilishi shart.**

---

## 1. Muammo: 12 Serverless Function limiti

Next.js `16.1.1` da `next build` **Turbopack** bilan ishlaydi. Vercel shu build
natijasini oladi va har bir `route.ts` ni alohida Serverless Function sifatida
hisoblaydi. Loyihada **89 ta `route.ts`** bor, Hobby plan limiti esa **12**.

```
Error: No more than 12 Serverless Functions can be added to a Deployment
on the Hobby plan. Create a team (Pro plan) to deploy more.
```

Turbopack buildidan kelib chiqqan ikkinchi xato:

```
Error: ENOENT: no such file or directory,
open '/vercel/path0/.next/next-server.js.nft.json'
```

**Sabab — route soni emas, build turi.** Route'larni o'chirish kerak emas.

---

## 2. Yechim: `vercel.json` bilan Webpack'ni majburlash

Vercel o'zining to'liq route'larni bitta funksiyaga konsolidatsiya qiladigan build
qoidasini faqat **Webpack** natijasida qo'llaydi. `next build --webpack` shuni
yoqadi va 89 ta route ham bitta paketga sig'adi.

Loyiha ildizida `vercel.json` **mavjud bo'lishi shart**:

```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && npx next build --webpack",
  "installCommand": "npm ci --ignore-scripts",
  "outputDirectory": ".next"
}
```

> **OGOHLANTIRISH:** `--webpack` ni olib tashlash yoki `buildCommand` ni
> `next build` ga qaytarish — limit xatosi darhol qaytadi.

---

## 3. Deploy buyruqlari

Buyruq **faqat `main` papkasidan** bajariladi. Worktree'da `.vercel` bog'lanishi yo'q.

```powershell
cd "C:\Users\user\Documents\Ish\ish kuni\Osnova new\akela-app"

# 1) Tur tekshiruvi — 0 bo'lishi shart
npx tsc --noEmit

# 2) Production deploy
vercel --prod --yes
```

### Loyiha bog'lanishi

`.vercel/project.json`:

```json
{
  "projectId": "prj_0h5MRB40KuGq6CzgFFvCLVnNuqfg",
  "orgId": "team_PoW1hQWtNIaXfimKeB3Ix3NN",
  "projectName": "akela-app"
}
```

CLI: `Vercel CLI 59.11.2`

---

## 4. Kutilayotgan natija

| Qurilma | Natija |
|---|---|
| `src/app/**/route.ts` soni | **89** (12 dan ko'p — normal) |
| `npx tsc --noEmit` | `TSC_EXIT=0` |
| `vercel --prod --yes` | `VERCEL_EXIT=0` |
| Deploy chiqishi | `▲ Aliased https://edu.akelagroup.uz` · `✓ Ready in 5m` |
| `/admin` | `200` |
| `/api/health` | `200` → `{"ok":true,"status":"healthy"}` |
| `/login` | `200` |

So'nggi 6 deploy (ham `--webpack`) — hammasi exit 0, 12-function xatosi qaytmagan.

---

## 5. Deploy'dan keyin tekshiruv

```powershell
Invoke-WebRequest -Uri "https://edu.akelagroup.uz/api/health" -TimeoutSec 25 -UseBasicParsing
```

Muvaffaqiyat belgisi: `200` va `{"ok":true,"status":"healthy"}`.

Login tekshiruvi (buyrumni to'g'ridan-to'g'ri kiritish kerak emas):

```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$csrf = Invoke-RestMethod -Uri "https://edu.akelagroup.uz/api/auth/csrf" -WebSession $s
# keyin /admin ga o'tish — 307 BO'LSA muammo bor, 200 bo'lishi kerak
Invoke-WebRequest -Uri "https://edu.akelagroup.uz/admin" -WebSession $s -MaximumRedirection 0
```

> `-MaximumRedirection 0` muhim: aks holda redirect yashirilib, har doim
> `200` ko'rinadi va muammo sezilmaydi.

---

## 6. `.env` talablari

Vercel CLI `.env` faylni upload qiladi va Next.js uni **build paytida** o'qiydi
(`Environment variables loaded from .env`). Shu sababli `.env` noto'g'ri bo'lsa
build butunlay sindiradi.

| Kalit | Qiymat | Izoh |
|---|---|---|
| `DATABASE_URL` | `mysql://...` | **Qoshtirnoqsiz** yoziladi. `"mysql://..."` qo'yilsa build xatosi: `the URL must start with the protocol mysql://` |
| `NEXTAUTH_URL` | `https://edu.akelagroup.uz` | Boshqa qiymat session va chiqish redirect'ini noto'g'ri domenga yuboradi |
| `NEXTAUTH_SECRET` | ixtiyoriy uzun matn | Bo'sh bo'lsa NextAuth xato beradi |

**Kalit hech qachon javob, log yoki shu faylga yozilmaydi.**

---

## 7. Uchta muhit bir xil build ishlatadi

| Muhit | Fayl | Build buyrug'i |
|---|---|---|
| Vercel | `vercel.json` | `npx prisma generate && npx next build --webpack` |
| Netlify | `netlify.toml` | `npx prisma generate && npx next build --webpack` |
| Docker | `Dockerfile` | `npx prisma generate && npx next build --webpack` |

Bitta joyda `--webpack` ni almashtirilsa, uchala muhit bir-biriga moslashmaydi.

---

## 8. `.vercelignore`

Upload hajmini kamaytiradi (6056 fayl emas, faqat kerakli kod):

```
node_modules
.next
.git
.github
.kilo
.kilocode
.playwright-mcp
strix_runs
tmp-icons
tmp-*
*.log
*.tsbuildinfo
start-modal.png
```

---

## 9. Tez-tez uchrash xatolari

| Xato | Sabab | Yechim |
|---|---|---|
| `No more than 12 Serverless Functions` | Turbopack build | `vercel.json` → `--webpack` |
| `next-server.js.nft.json` ENOENT | `output: "standalone"` + Turbopack | `--webpack` + `outputDirectory: ".next"` |
| `the URL must start with the protocol mysql://` | `.env` da qoshtirnoq bor | `.env` ni qo'lda tozalang |
| `/admin` → `307 /login?reason=not-approved` | JWT da `status` yo'q | `auth-options.ts` da `status`/`isActive` ni qaytaring |
| Chiqish boshqa saytga olib ketadi | `signOut({ callbackUrl })` | `signOut({ redirect: false })` + `router.replace("/login")` |
| Video ko'rinmaydi | CSP `frame-src 'self'` | `next.config.ts` da YouTube/Vimeo/TikTok domenlari |

---

## 10. Majburiy qoidalar (qisqa)

1. `vercel.json` ni o'chirmang, `--webpack` ni olib tashlamang.
2. Route'larni o'chirish kerak emas — sabab build turi.
3. Deploy faqat `main` papkasidan.
4. `npx tsc --noEmit` → 0 bo'lmasa deploy qilmang.
5. `.env` da `DATABASE_URL` qoshtirnoqsiz, `NEXTAUTH_URL` to'g'ri.
6. Tekshiruvda `-MaximumRedirection 0` ishlating.
7. Maxfiy kalitlarni javob/log/faylda ko'rsatma.