# Infisical — maxfiy kalitlarni markazlash

Maqsad: `.env` fayl diskdan yo'qoladi, qiymatlar **Infisical**'dan `infisical run` orqali
uzatiladi. Ilova kodi o'zgarmaydi — u avvalgidek `process.env.DATABASE_URL` kabi
o'zgaruvchilarni o'qiydi.

Muhit slug'lari: `dev` (Development), `staging` (Staging), `prod` (Production).

## Bu repoda nima o'zgardi

- [package.json](package.json): `dev`, `start`, `db:push`, `db:migrate`, `db:reset`,
  `db:seed`, `db:seed:onboarding` endi `infisical run --env=<muhit> --` bilan o'ralgan.
- [.gitignore](.gitignore): `.env*` yopiq; `!.env.example` bilan qiymatsiz shablon ochildi.
- [.env.example](.env.example): kerakli kalitlar ro'yxati + `INFISICAL_*` o'zgaruvchilar.

Qolgan qadamlar (hisob, CLI, chet muhitlar) sizning hisobingizni talab qiladi.

## 1. Hisob va loyiha (faqat siz bajara olasiz)

1. <https://app.infisical.com> → ro'yxatdan o'tish.
2. **Secrets Management → + Add New Project** → nomi: `akela-edu`.
   Har bir yangi loyihada 3 muhit bor: Development, Staging, Production.
3. Kalitlarni birdaniga ko'chirish: **Secrets Overview** sahifasiga `.env` faylni
   drag & drop qiling (yoki *Paste Secrets*), Target Environment: `Development`.
   `Staging`/`Production` uchun shu amalni alohida takrorlang.

## 2. CLI o'rnatish va kirish

```powershell
winget install infisical            # Windows
# brew install infisical/get-cli/infisical   # macOS
# npm install -g @infisical/cli              # npm orqali (istalgan OS)
infisical --version
```

Brauzer bor mashinada:

```powershell
infisical login
```

Brauzersiz muhitda (WSL 2, Codespaces, remote SSH) `-i` bilan:

```powershell
infisical login -i
```

## 3. Kodni bog'lash

Loyiha ildizida:

```powershell
infisical init
```

Bu `.infisical.json` yozadi — faqat loyiha ID'si va muhit sozlamasi, **maxfiy qiymat yo'q**,
shuning uchun commit qilish mumkin. Foydali variant:

```json
{
  "workspaceId": "<project-id>",
  "defaultEnvironment": "dev",
  "gitBranchToEnvironmentMapping": { "main": "prod", "staging": "staging" }
}
```

## 4. Ishlatish

```powershell
npm run dev                  # infisical run --env=dev  -- next dev -p 3000
npm run start                # infisical run --env=prod -- next start ...
```

## 5. CI/CD, Docker, Kubernetes, production

Interaktiv login bu muhitlarga to'g'ri kelmaydi. **Machine identity + Universal Auth**
ishlatiladi:

1. Infisical: **Access Control → Machine Identities → Create** (Universal Auth yoqiq).
2. **Add Client Secret** → *Client ID* va *Client Secret* olinadi.
3. Identitetni loyihaga qo'shing (**Access Control → Machine Identities → Add Machine
   Identity to Project**) va **faqat kerakli environment**ga (masalan `prod`),
   minimal rol (Viewer) bering.
4. Client ID/Secret platformaning **o'z** secret store'iga qo'ying — repoga emas:
   - Docker/compose: `INFISICAL_UNIVERSAL_AUTH_CLIENT_ID` /
     `INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET` env o'zgaruvchilari sifatida;
   - GitHub Actions / GitLab CI: repository secrets;
   - Vercel / Netlify: Environment Variables (yoki Infisical'ning Vercel integratsiyasi).
5. Buyruqni o'rang:

   ```bash
   infisical run --env=prod -- <buyruq>
   ```

   Docker uchun konteyner ichida CLI kerak bo'ladi: image'ga pinlangan versiyani
   o'rnatib (releases sahifasidagi aniq versiya), `entrypoint.sh`dagi bajariladigan
   buyruqni `infisical run --env=prod -- node server.js` ga o'zgartiring. Bu qadam
   hozircha [Dockerfile](Dockerfile) va [docker-compose.yml](docker-compose.yml) ga
   tegmagan — identity yaratilgandan keyin qilinadi. Ungacha `docker compose` eski
   `env_file: .env` yo'lida ishlayveradi.
   Vercel: [vercel.json](vercel.json) build buyrug'i `--webpack` qolishi shart
   (qarang: [VERCEL-DEPLOY.md](VERCEL-DEPLOY.md)); Infisical'ga o'tishda `.env`ni
   `vercel` CLI bilan yuklash o'rniga Vercel env'ida machine identity bering.

## 6. Tekshirish (hali bajarilmadi)

Infisical CLI bu mashinada o'rnatilmagan va login qilinmagan, shuning uchun
qiymatlar Infisical'dan kelayotganini **siz** tasdiqlashingiz kerak:

```powershell
# 1) qiymatning uzunligini ko'rsatamiz (qiymatni emas)
infisical run --env=dev -- node -e "console.log('NEXTAUTH_SECRET len =', (process.env.NEXTAUTH_SECRET||'').length)"
# 2) lokal .env'ni chetga oling va qayta ishga tushiring
ren .env .env.backup
npm run dev
```

Ilova `.env` bo'lmasa ham ishga tushsa — qiymatlar Infisical'dan kelmoqda.

## 7. Xavfsizlik: albatta bajaring

- `.env` **git tarixida bor** (repo'da tracked). Shuning uchun undagi barcha qiymatlar
  oshkor bo'lgan deb hisoblanadi va **hammasini almashtirish (rotate) shart**:
  MySQL paroli (`DATABASE_URL`), `NEXTAUTH_SECRET`, `TELEGRAM_BOT_TOKEN`,
  `OSNOVAEDU_PASSWORD`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`.
- Kodda hard-coded qiymatlar ham uchraydi — masalan
  [src/lib/telegram-bot.ts](src/lib/telegram-bot.ts), [src/lib/ai/provider.ts](src/lib/ai/provider.ts)
  va ildizdagi `e2e-*.js` skriptlarida. Ulardagi kalitlar/parollar ham rotate qilinishi
  kerak (qiymatlarni bu faylga yozmang).
- Faylni indeksdan chiqarish (o'zingiz bajaring, push qilmang):
  `git rm --cached .env` — tarixdan butunlay o'chirish uchun `git filter-repo`/BFG kerak.
- Sizib chiqqan kalitlarni skanerlash: `infisical scan` —
  <https://infisical.com/docs/cli/scanning-overview>
- Hech qachon maxfiy qiymatni commit qilmang, chatga yoki faylga yozmang.
