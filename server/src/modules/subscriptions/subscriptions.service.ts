import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import {
  BillingCycle,
  SubscriptionStatus,
} from '../../common/constants/subscription.constant';

export interface SubscriptionResponse {
  id: string;
  clinicId: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  nextBillingDate: Date | null;
  graceUntil: Date | null;
  plan: {
    id: string;
    name: string;
    price: string;
    billingCycle: string;
  } | null;
}

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

/** Boshlang'ich obuna ma'lumotini (status + sanalar) hisoblaydi. DB'siz, sof. */
export interface InitialSubscriptionInput {
  trial: boolean;
  trialDays: number;
  billingCycle: string;
  now?: Date;
}

export interface InitialSubscriptionData {
  status: string;
  startDate: Date;
  endDate: Date | null;
  nextBillingDate: Date | null;
  graceUntil: Date | null;
}

export function computeInitialSubscription(
  input: InitialSubscriptionInput,
): InitialSubscriptionData {
  const now = input.now ?? new Date();

  if (input.trial) {
    const trialEnd = addDays(now, input.trialDays);
    return {
      status: SubscriptionStatus.TRIAL,
      startDate: now,
      endDate: trialEnd,
      // Trial tugagach birinchi to'lov kuni
      nextBillingDate: trialEnd,
      graceUntil: null,
    };
  }

  return {
    status: SubscriptionStatus.ACTIVE,
    startDate: now,
    endDate: null,
    nextBillingDate: addCycle(now, input.billingCycle),
    graceUntil: null,
  };
}

/** UTC bo'yicha N kun qo'shadi (timezone-safe). Billing modullarida ham ishlatiladi. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Obuna sikliga ko'ra bir davr qo'shadi (MONTHLY -> +1 oy, YEARLY -> +1 yil). */
export function addCycle(date: Date, cycle: string): Date {
  const d = new Date(date);
  if (cycle === BillingCycle.YEARLY) {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

@Injectable()
export class SubscriptionsService {
  constructor(@InjectPrisma() private readonly prisma: ExtendedPrismaClient) {}

  /** Klinikaning joriy (eng oxirgi) obunasi. */
  async getCurrentByClinic(
    clinicId: string,
  ): Promise<SubscriptionResponse | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { clinicId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    return sub ? toSubscriptionResponse(sub) : null;
  }
}

export function toSubscriptionResponse(
  sub: SubscriptionWithPlan,
): SubscriptionResponse {
  return {
    id: sub.id,
    clinicId: sub.clinicId,
    status: sub.status,
    startDate: sub.startDate,
    endDate: sub.endDate,
    nextBillingDate: sub.nextBillingDate,
    graceUntil: sub.graceUntil,
    plan: sub.plan
      ? {
          id: sub.plan.id,
          name: sub.plan.name,
          price: sub.plan.price.toString(),
          billingCycle: sub.plan.billingCycle,
        }
      : null,
  };
}
