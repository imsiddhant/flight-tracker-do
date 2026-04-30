# ── Stage 1: install production dependencies only ──────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: lean runtime image ────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Non-root user — required for Kubernetes PodSecurity compliance
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --chown=appuser:appgroup --from=deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup server.js ./
COPY --chown=appuser:appgroup public ./public

EXPOSE 3000
ENV NODE_ENV=production PORT=3000

CMD ["node", "server.js"]
