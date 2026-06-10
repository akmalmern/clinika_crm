/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * Phase 9B — Mavjud ochiq matnli nozik maydonlarni shifrlash (backfill).
 *
 * EXPAND-CONTRACT xavfsizligi:
 *   1) Ilova deploy qilinadi: yangi yozuvlar shifrlanadi, o'qishda decrypt ochiq
 *      matnni HAM o'qiydi (backward-compat).
 *   2) Shu skript ESKI ochiq qatorlarni joyida shifrlaydi (XOM Prisma client —
 *      extension YO'Q, shuning uchun ikki marta shifrlanmaydi).
 *   3) Qaytarish: encrypt-rollback.ts (deshifrlaydi).
 *
 * Ishga tushirish (server/ ichidan):  npx tsx scripts/encrypt-backfill.ts
 * BACKUP OLINGAN bo'lsin (ops/backup) — bu ma'lumotni o'zgartiradi.
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

/** model nomi -> Prisma delegate. */
function delegates(prisma: PrismaClient): Record<string, any> {
  return {
    MedicalRecord: prisma.medicalRecord,
    Patient: prisma.patient,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const crypto = makeCrypto();
  if (!crypto.enabled) {
    console.error('XATO: FIELD_ENCRYPTION_KEY yo`q — backfill bekor qilindi.');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const map = delegates(prisma);

  let totalRows = 0;
  let changedRows = 0;

  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const delegate = map[model];
    if (!delegate) continue;
    const select: Record<string, boolean> = { id: true };
    for (const f of fields) select[f] = true;

    const rows: any[] = await delegate.findMany({ select });
    console.log(`[${model}] ${rows.length} qator tekshirilmoqda...`);

    for (const row of rows) {
      totalRows++;
      const data: Record<string, string> = {};
      for (const f of fields) {
        const v = row[f];
        if (typeof v === 'string' && v.length > 0 && !crypto.isEncrypted(v)) {
          data[f] = crypto.encrypt(v);
        }
      }
      if (Object.keys(data).length > 0) {
        await delegate.update({ where: { id: row.id }, data });
        changedRows++;
      }
    }
  }

  await prisma.$disconnect();
  console.log(
    `Backfill tugadi: ${totalRows} qator ko'rildi, ${changedRows} qator shifrlandi.`,
  );
}

main().catch((e) => {
  console.error('Backfill xatosi:', e);
  process.exit(1);
});
