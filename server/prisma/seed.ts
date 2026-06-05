/**
 * Phase 1 seed — birinchi Super Admin'ni yaratadi.
 * Idempotent: bir necha marta ishga tushsa ham dublikat yaratmaydi.
 *
 * Ishga tushirish:  npm run db:seed   (yoki: npx prisma db seed)
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { uuidv7 } from 'uuidv7';

const prisma = new PrismaClient();

interface PlanSeed {
  name: string;
  price: string;
  billingCycle: string;
  limits: Record<string, number>;
  features: Record<string, boolean>;
}

const DEFAULT_PLANS: PlanSeed[] = [
  {
    name: 'BASIC',
    price: '199000.00',
    billingCycle: 'MONTHLY',
    limits: { maxStaff: 5, maxPatients: 1000, storageGb: 5, smsCount: 200 },
    features: { pharmacy: false, telegram: false },
  },
  {
    name: 'STANDARD',
    price: '499000.00',
    billingCycle: 'MONTHLY',
    limits: { maxStaff: 20, maxPatients: 10000, storageGb: 25, smsCount: 1000 },
    features: { pharmacy: true, telegram: true },
  },
  {
    name: 'PREMIUM',
    price: '999000.00',
    billingCycle: 'MONTHLY',
    limits: { maxStaff: 100, maxPatients: 100000, storageGb: 100, smsCount: 5000 },
    features: { pharmacy: true, telegram: true },
  },
];

async function seedSuperAdmin(): Promise<void> {
  const name = process.env.SUPER_ADMIN_NAME ?? 'Platform Owner';
  const email = (process.env.SUPER_ADMIN_EMAIL ?? 'admin@clinic-crm.uz').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin12345!';

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // Partial unique index (WHERE deleted_at IS NULL) tufayli findUnique emas,
  // findFirst bilan tekshiramiz.
  const existing = await prisma.superAdmin.findFirst({
    where: { email, deletedAt: null },
  });

  if (existing) {
    await prisma.superAdmin.update({
      where: { id: existing.id },
      data: { fullName: name, passwordHash, isActive: true },
    });
    console.log(`✓ Super Admin yangilandi: ${email}`);
  } else {
    await prisma.superAdmin.create({
      data: { id: uuidv7(), fullName: name, email, passwordHash, isActive: true },
    });
    console.log(`✓ Super Admin yaratildi: ${email}`);
  }
  console.log('  (parol .env -> SUPER_ADMIN_PASSWORD orqali belgilanadi)');
}

async function seedPlans(): Promise<void> {
  for (const p of DEFAULT_PLANS) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { name: p.name, deletedAt: null },
    });
    if (existing) {
      await prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: {
          price: p.price,
          billingCycle: p.billingCycle,
          limits: p.limits,
          features: p.features,
          isActive: true,
        },
      });
      console.log(`✓ Tarif yangilandi: ${p.name}`);
    } else {
      await prisma.subscriptionPlan.create({
        data: {
          id: uuidv7(),
          name: p.name,
          price: p.price,
          currency: 'UZS',
          billingCycle: p.billingCycle,
          limits: p.limits,
          features: p.features,
          isActive: true,
        },
      });
      console.log(`✓ Tarif yaratildi: ${p.name}`);
    }
  }
}

async function main(): Promise<void> {
  await seedSuperAdmin();
  await seedPlans();
}

main()
  .catch((err) => {
    console.error('Seed xatosi:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
