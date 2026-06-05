import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import {
  buildPaginationMeta,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

export interface PlanResponse {
  id: string;
  name: string;
  price: string;
  currency: string;
  billingCycle: string;
  limits: unknown;
  features: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type PlanRow = Prisma.SubscriptionPlanGetPayload<object>;

/**
 * Tariflar (subscription_plans) — faqat SUPER_ADMIN boshqaradi.
 * Pul `Decimal` sifatida saqlanadi; javobda string'ga aylantiriladi.
 */
@Injectable()
export class PlansService {
  constructor(@InjectPrisma() private readonly prisma: ExtendedPrismaClient) {}

  async create(dto: CreatePlanDto): Promise<PlanResponse> {
    await this.assertNameFree(dto.name);

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency ?? 'UZS',
        billingCycle: dto.billingCycle,
        limits: (dto.limits ?? {}) as Prisma.InputJsonValue,
        features: (dto.features ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });
    return toPlanResponse(plan);
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<PlanResponse>> {
    const where: Prisma.SubscriptionPlanWhereInput = { deletedAt: null };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        where,
        orderBy: { price: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.subscriptionPlan.count({ where }),
    ]);

    return {
      items: rows.map(toPlanResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(id: string): Promise<PlanResponse> {
    return toPlanResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanResponse> {
    await this.getOrThrow(id);
    if (dto.name) await this.assertNameFree(dto.name, id);

    const data: Prisma.SubscriptionPlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.billingCycle !== undefined) data.billingCycle = dto.billingCycle;
    if (dto.limits !== undefined)
      data.limits = dto.limits as Prisma.InputJsonValue;
    if (dto.features !== undefined)
      data.features = dto.features as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data,
    });
    return toPlanResponse(plan);
  }

  /** Soft-delete (tarix saqlanadi, mavjud obunalarga FK buzilmaydi). */
  async remove(id: string): Promise<{ id: string }> {
    await this.getOrThrow(id);
    await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id };
  }

  private async getOrThrow(id: string): Promise<PlanRow> {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Tarif topilmadi');
    return plan;
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where: { name, deletedAt: null },
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Bu nomli tarif allaqachon mavjud');
    }
  }
}

export function toPlanResponse(plan: PlanRow): PlanResponse {
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price.toString(),
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    limits: plan.limits,
    features: plan.features,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}
