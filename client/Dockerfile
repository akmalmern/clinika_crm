# =============================================================================
# Klinika CRM — Frontend (Next.js App Router) PRODUCTION image (standalone)
# =============================================================================
# next.config.mjs: output: 'standalone' -> minimal server (.next/standalone).
# BACKEND_INTERNAL_URL runtime env orqali beriladi (build'ga kirmaydi).
# =============================================================================

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone server + statik fayllar (minimal).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER nextjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/login || exit 1

CMD ["node", "server.js"]
