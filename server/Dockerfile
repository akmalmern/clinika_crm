# Phase 1 — soddalashtirilgan dev image.
# Production uchun ko'p bosqichli (multi-stage) build Phase 9'da qo'shiladi.
FROM node:20-alpine

# Prisma engine'lari uchun kerakli kutubxona
RUN apk add --no-cache openssl

WORKDIR /app

# Avval bog'liqliklar — Docker layer cache uchun
COPY package*.json ./
RUN npm install

# Prisma client generatsiya qilish uchun schema
COPY prisma ./prisma
RUN npx prisma generate

# Qolgan kod
COPY . .

EXPOSE 3000

# Konteyner ishga tushganda: migratsiyani qo'llaydi -> seed -> serverni ishga tushiradi.
# migrate deploy va seed idempotent (qayta ishga tushsa ham xavfsiz).
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm run start:dev"]
