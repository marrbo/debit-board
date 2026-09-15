# ============================================================
# 1. deps — instala node_modules a partir do lockfile
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ============================================================
# 2. builder — compila o Next em modo standalone
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /src

# Variáveis usadas em build time (Next inlines NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_ADMIN_EMAIL
ENV NEXT_PUBLIC_ADMIN_EMAIL=${NEXT_PUBLIC_ADMIN_EMAIL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV RUNNING_IN_CONTAINER=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ============================================================
# 3. runner — imagem final enxuta
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
 && adduser  -S nextjs -u 1001

# Diretório persistente para os dumps
RUN mkdir -p /var/lib/debit-board/dumps \
 && chown -R nextjs:nodejs /var/lib/debit-board

# Artefatos do standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]