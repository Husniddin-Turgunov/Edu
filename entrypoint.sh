#!/bin/sh
# Akela EDU container kirişi: env tekshiruvi -> DB sinxronizatsiyasi -> Next.js server
set -e
# kontenerda /app, lokal testda APP_DIR beriladi
cd "${APP_DIR:-/app}"

fail() { echo "[akela] XATO: $1" >&2; exit 1; }

# --- majburiy env (xato aniq ko'rinadi, kriptik crash emas) ---
[ -n "$DATABASE_URL" ] || fail "DATABASE_URL bo'sh. .env ichida DATABASE_URL bering (yoki compose db xizmatidan foydalaning)."
[ -n "$NEXTAUTH_SECRET" ] || fail "NEXTAUTH_SECRET bo'sh. .env ichida NEXTAUTH_SECRET bering (openssl rand -base64 32)."
[ -n "$NEXTAUTH_URL" ] || fail "NEXTAUTH_URL bo'sh. .env ichiga https://sayt-holati bering."

# --- DB sinxronizatsiyasi (DB_SYNC=push|migrate|skip) ---
sync="${DB_SYNC:-push}"
if [ "$sync" = "push" ]; then
  echo "[akela] prisma db push boshlandi (DB_SYNC=push)"
  if ! npx prisma db push --skip-generate; then
    fail "prisma db push bajarilmadi. Agar DB mavjud bo'lsa DB_SYNC=skip qo'ying, migration uchun DB_SYNC=migrate."
  fi
elif [ "$sync" = "migrate" ]; then
  echo "[akela] prisma migrate deploy boshlandi (DB_SYNC=migrate)"
  npx prisma migrate deploy || fail "prisma migrate deploy bajarilmadi."
else
  echo "[akela] DB_SYNC=$sync — DB sinxronizatsiyasi o'tkazildi"
fi

echo "[akela] Next.js server ishga tushmoqda (:$PORT)"
exec node server.js
