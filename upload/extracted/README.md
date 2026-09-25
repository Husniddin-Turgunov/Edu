# AKELA Assess

Платформа HR: тесты сотрудников, уровни Junior→Expert, маршрут развития.

## Локальный запуск (без прода / без деплоя)

Пока разрабатываем **только локально**, чтобы не трогать живой сайт и Turso.

В `.env.local` должно быть:

```bash
AKELA_USE_LOCAL_DB=1
```

Затем:

```bash
npm install
npm run dev
```

Откройте http://localhost:3000

Локальная БД: `data/akela-local.db` (создаётся автоматически, в git не попадает).  
Вход админа по умолчанию: `admin` / `akela-admin`.

Turso (`TURSO_DATABASE_URL`) при `AKELA_USE_LOCAL_DB=1` **не используется**.

## Онлайн (edu.akelagroup.uz + Turso) — позже

Продакшен: **https://edu.akelagroup.uz** — свой сервер (Passenger + Node 20).  
Деплой делать **только когда локальная версия полностью готова**.

1. БД на [Turso](https://turso.tech): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
2. На сервере **не** ставить `AKELA_USE_LOCAL_DB=1`
3. Деплой: `AKELA_SSH_PASSWORD=... ./deploy-edu.sh`

## Google Drive — автозагрузка тестов и уроков

Платформа подхватывает файлы из Drive **только** по кнопке «Проверить Drive сейчас» (не при каждом открытии страницы).

- **Тесты (Excel / Sheets)** — раздел «Тесты» (`/assessments`)
- **Уроки (Word / Google Docs)** — раздел «Обучение» (`/learning`), затем назначьте уроки на должности

### Настройка (один раз)

1. [Google Cloud Console](https://console.cloud.google.com/) → создайте проект.
2. **APIs & Services → Enable APIs** → включите **Google Drive API**.
3. **IAM & Admin → Service Accounts** → Create → скачайте JSON-ключ.
4. В Drive создайте папку, например `AKELA Tests` (и при желании отдельную `AKELA Lessons`).
5. Откройте папку → **Share** → добавьте email сервис-аккаунта (`...@...iam.gserviceaccount.com`) с правом **Viewer**.
6. Скопируйте **Folder ID** из URL:
   `https://drive.google.com/drive/folders/FOLDER_ID`
7. На Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|----------|--------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` из JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` из JSON (с `\n`) |
| `GOOGLE_DRIVE_FOLDER_ID` | ID папки с Excel-тестами (также fallback для Word, если нет отдельной) |
| `GOOGLE_DRIVE_LESSONS_FOLDER_ID` | опционально: отдельная папка только с Word-уроками |
| `CRON_SECRET` | опционально: защита `/api/cron/sync-drive` |
| `LOCAL_STORAGE_ROOT` | локальное хранилище файлов на сервере |

8. Redeploy. Кладите в папку тестов `.xlsx` / `.xls` (или Google Sheets); в папку уроков — `.docx` / Google Docs.

Уже импортированные файлы не дублируются. Если файл в Drive обновили — контент на платформе обновится (назначение на должности не сбрасывается).

## Локальное хранилище на сервере (edu.akelagroup.uz)

Если Google Drive не нужен, положите файлы прямо на диск сервера и нажмите «Проверить» в разделе Обучение / Тесты / Аттестации.

### Настройка (один раз)

1. На сервере создайте папку, например:
   `/home/akelagro/domains/edu.akelagroup.uz/storage`
2. В `app/.env` добавьте:
   ```
   LOCAL_STORAGE_ROOT=/home/akelagro/domains/edu.akelagroup.uz/storage
   ```
   (или укажите этот путь в **Интеграции → Хранилище → Локальный сервер / путь**)
3. Внутри появятся подпапки:
   - `tests/` — Excel-тесты (имя: Кандидат…, Пробный…, Стажёр…, Уровень…)
   - `lessons/` — Word/Excel уроки (имя начинается с «Урок»)
   - `attestations/` — Excel аттестации (имя: Аттестация…)
   - `design/` — картинки и видео из редактора дизайна
   - `reports/` — резерв для экспортов
4. Загружайте файлы через SFTP/FTP в нужную папку, затем в админке нажмите синхронизацию.

Локальное хранилище имеет **приоритет** над Google Drive: если `LOCAL_STORAGE_ROOT` задан, синхронизация читает только с диска.

Медиа доступны по URL вида `/api/files/design/...`.

## Стек

Next.js · TypeScript · Tailwind · Drizzle · libSQL/Turso · Google Drive API
