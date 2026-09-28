# ============================================================
# 1. deps — instala node_modules a partir do lockfile
# ============================================================
FROM cgr.dev/chainguard/node:latest-dev AS deps
WORKDIR /app
COPY --chown=65532:65532 package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,uid=65532,gid=65532 \
    npm ci --no-audit --no-fund

# ============================================================
# 2. builder — compila o Next em modo standalone
# ============================================================
FROM cgr.dev/chainguard/node:latest-dev AS builder
WORKDIR /app

ARG NEXT_PUBLIC_ADMIN_EMAIL
ENV NEXT_PUBLIC_ADMIN_EMAIL=${NEXT_PUBLIC_ADMIN_EMAIL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV RUNNING_IN_CONTAINER=true
ENV NODE_OPTIONS="--max-old-space-size=3072"

COPY --from=deps --chown=65532:65532 /app/node_modules ./node_modules
COPY --chown=65532:65532 . .

RUN mkdir -p /app/.next

RUN --mount=type=cache,target=/app/.next/cache,uid=65532,gid=65532 \
    --mount=type=cache,target=/root/.npm,uid=65532,gid=65532 \
    npm run build

USER root
RUN mkdir -p /var/lib/debit-board/dumps \
 && chown -R 65532:65532 /var/lib/debit-board
USER 65532:65532

# ============================================================
# 3. runner — imagem final distroless (sem shell)
# ============================================================
FROM cgr.dev/chainguard/node:latest-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder --chown=65532:65532 /app/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=builder --chown=65532:65532 /var/lib/debit-board /var/lib/debit-board

USER 65532:65532

EXPOSE 3000

# 🔑 Sem `node` — o ENTRYPOINT do Chainguard já é o binário.
#    `["node", "server.js"]` vira `node node server.js` e falha
#    com MODULE_NOT_FOUND. Só o argumento do script.
CMD ["server.js"]