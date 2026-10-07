# Akela EDU — bir xil production image (istalgan serverda bir xil natija)
# Ishlatish:  docker compose up -d --build
# Runtime env compose/.env dan keladi — image ichida HECH qanday maxfiy qiymat yo'q.

# ---- 1 bosqich: bog'liqliklar (dev ham, build uchun kerak) ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- 2 bosqich: prisma generate + next build ----
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Build deterministik bo'lsin: .env'siz ham serverda bir xil natija
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NEXTAUTH_SECRET=build-time-placeholder \
    NEXTAUTH_URL=http://localhost:3000 \
    DATABASE_URL=placeholder:mysql://build:build@127.0.0.1:3306/build
RUN npx prisma generate
COPY . .
# Turbopack Linux build'da dynamic import'ni uzatmaydi — webpack (netlify.toml bilan bir xil)
RUN npx next build --webpack

# ---- 3 bosqich: minimal runtime ----
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && adduser nextjs nodejs \
    && mkdir -p /home/nextjs && chown nextjs:nodejs /home/nextjs
ENV HOME=/home/nextjs

# Prisma CLI (db push/migrate deploy) + production bog'liqliklari
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# Builder'da generate qilingan client (platformasi builder bilan bir xil)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Next.js standalone server
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# ishga tushirish skripti (CRLF himoyasi bilan)
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

# nextjs yozadigan yagona joy — ruxsat beriladi
RUN mkdir -p /app/.next/cache \
    && chown -R nextjs:nodejs /app/.next /app/node_modules/.prisma /app/prisma

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=8s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
