/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * Phase 9B — Shifrlangan maydonlarni QAYTA OCHIQ matnga aylantirish (rollback).
 * encrypt-backfill.ts ning teskarisi — migratsiya REVERSIBLE bo'lishi uchun.
 *
 * Ishga tushirish (server/ ichidan):  npx tsx scripts/encrypt-rollback.ts
 * (FIELD_ENCRYPTION_KEY + kerak bo'lsa eski kalitlar mavjud bo'lsin.)
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CryptoService } from '../src/core/crypto/crypto.service';
import { ENCRYPTED_FIELDS } from '../src/core/prisma/prisma-extensions';

function loadEnv(): void {
  const p = resolve(__dirname, '..', '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

function makeCrypto(): CryptoService {
  const cfg = {
    getOrThrow: () => ({
      fieldKey: process.env.FIELD_ENCRYPTION_KEY || undefined,
      fieldKeyId: process.env.FIELD_ENCRYPTION_KEY_ID ?? 'k1',
      fieldKeysOld: process.env.FIELD_ENCRYPTION_KEYS_OLD || undefined,
    }),
  };
  return new CryptoService(cfg as never);
}

function delegates(prisma: PrismaClient): Record<string, any> {
  return { MedicalRecord: prisma.medicalRecord, Patient: prisma.patient };
}

async function main(): Promise<void> {
  loadEnv();
  const crypto = makeCrypto();
  if (!crypto.enabled) {
    console.error('XATO: FIELD_ENCRYPTION_KEY yo`q — deshifrlab bo`lmaydi.');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const map = delegates(prisma);

  let changed = 0;
  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const delegate = map[model];
    if (!delegate) continue;
    const select: Record<string, boolean> = { id: true };
    for (const f of fields) select[f] = true;

    const rows: any[] = await delegate.findMany({ select });
    for (const row of rows) {
      const data: Record<string, string> = {};
      for (const f of fields) {
        const v = row[f];
        if (typeof v === 'string' && crypto.isEncrypted(v)) {
          data[f] = crypto.decrypt(v);
        }
      }
      if (Object.keys(data).length > 0) {
        await delegate.update({ where: { id: row.id }, data });
        changed++;
      }
    }
  }
  await prisma.$disconnect();
  console.log(`Rollback tugadi: ${changed} qator ochiq matnga qaytarildi.`);
}

main().catch((e) => {
  console.error('Rollback xatosi:', e);
  process.exit(1);
});
