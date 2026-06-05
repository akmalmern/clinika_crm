import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { BillingConfig } from '../../config/configuration';
import { Role } from '../../common/constants/roles.constant';
import {
  ClinicStatus,
  SubscriptionStatus,
} from '../../common/constants/subscription.constant';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { generatePassword, slugify } from '../../common/utils/password.util';
import { AuditService } from '../audit/audit.service';
import {
  computeInitialSubscription,
  SubscriptionResponse,
  toSubscriptionResponse,
} from '../subscriptions/subscriptions.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { ListClinicsQueryDto } from './dto/list-clinics-query.dto';

type ClinicRow = Prisma.ClinicGetPayload<object>;
type ClinicWithSub = Prisma.ClinicGetPayload<{
  include: { subscriptions: { include: { plan: true } } };
}>;

export interface ClinicBasic {
  id: string;
  name: string;
  slug: string;
  status: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClinicDetail extends ClinicBasic {
  membersCount: number;
  subscription: SubscriptionResponse | null;
}

export interface CreateClinicResult {
  clinic: ClinicBasic;
  admin: {
    id: string;
    fullName: string;
    email: string | null;
    role: string;
    /** Faqat parol avtomatik generatsiya qilingan bo'lsa qaytadi. */
    temporaryPassword?: string;
  };
  subscription: SubscriptionResponse;
}

/**
 * Klinikalar (tenant) — faqat SUPER_ADMIN boshqaradi.
 * Klinika yaratilganda atomik (transaction) tarzda: klinika + CLINIC_ADMIN
 * foydalanuvchi + a'zolik + obuna yaratiladi.
 */
@Injectable()
export class ClinicsService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateClinicDto): Promise<CreateClinicResult> {
    const slug = await this.resolveSlug(
      dto.slug ?? (slugify(dto.name) || 'klinika'),
    );
    const plan = await this.resolvePlan(dto.planId);

    const trial = dto.trial ?? true;
    const generated = !dto.adminPassword;
    const plainPassword = dto.adminPassword ?? generatePassword(16);
    const passwordHash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
    });

    const trialDays =
      this.config.getOrThrow<BillingConfig>('billing').trialDays;
    const subData = computeInitialSubscription({
      trial,
      trialDays,
      billingCycle: plan.billingCycle,
    });
    const clinicStatus = trial ? ClinicStatus.TRIAL : ClinicStatus.ACTIVE;

    const result = await this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: dto.name,
          slug,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          status: clinicStatus,
        },
      });

      const user = await tx.user.create({
        data: {
          fullName: dto.adminFullName,
          email: dto.adminEmail,
          phone: dto.adminPhone,
          passwordHash,
        },
      });

      // Super admin kontekstida clinic_id avtomatik in'ektsiya qilinmaydi
      // (bypassTenant), shuning uchun aniq beramiz.
      const member = await tx.clinicMember.create({
        data: {
          clinicId: clinic.id,
          userId: user.id,
          role: Role.CLINIC_ADMIN,
          position: 'Administrator',
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          clinicId: clinic.id,
          planId: plan.id,
          status: subData.status,
          startDate: subData.startDate,
          endDate: subData.endDate,
          nextBillingDate: subData.nextBillingDate,
          graceUntil: subData.graceUntil,
        },
        include: { plan: true },
      });

      return { clinic, user, member, subscription };
    });

    await this.auditService.log({
      action: 'CLINIC_CREATE',
      entity: 'Clinic',
      entityId: result.clinic.id,
      metadata: { slug, planId: plan.id, trial },
    });

    return {
      clinic: mapClinicBasic(result.clinic),
      admin: {
        id: result.user.id,
        fullName: result.user.fullName,
        email: result.user.email,
        role: Role.CLINIC_ADMIN,
        ...(generated ? { temporaryPassword: plainPassword } : {}),
      },
      subscription: toSubscriptionResponse(result.subscription),
    };
  }

  async findAll(query: ListClinicsQueryDto): Promise<Paginated<ClinicDetail>> {
    const where: Prisma.ClinicWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search)
      where.name = { contains: query.search, mode: 'insensitive' };

    const [clinics, total] = await Promise.all([
      this.prisma.clinic.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          subscriptions: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { plan: true },
          },
        },
      }),
      this.prisma.clinic.count({ where }),
    ]);

    const counts = await this.memberCounts(clinics.map((c) => c.id));

    return {
      items: clinics.map((c) => mapClinicDetail(c, counts.get(c.id) ?? 0)),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(id: string): Promise<ClinicDetail> {
    const clinic = await this.prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscriptions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });
    if (!clinic) throw new NotFoundException('Klinika topilmadi');
    const counts = await this.memberCounts([id]);
    return mapClinicDetail(clinic, counts.get(id) ?? 0);
  }

  async update(id: string, dto: UpdateClinicDto): Promise<ClinicBasic> {
    const clinic = await this.getOrThrow(id);
    if (dto.slug && dto.slug !== clinic.slug) {
      const taken = await this.prisma.clinic.findFirst({
        where: { slug: dto.slug, deletedAt: null },
      });
      if (taken) throw new ConflictException('Bu slug band');
    }

    const data: Prisma.ClinicUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;

    const updated = await this.prisma.clinic.update({ where: { id }, data });
    await this.auditService.log({
      action: 'CLINIC_UPDATE',
      entity: 'Clinic',
      entityId: id,
    });
    return mapClinicBasic(updated);
  }

  /** Soft-delete: klinika o'chmaydi, lekin CANCELLED + deleted_at belgilanadi. */
  async remove(id: string): Promise<{ id: string }> {
    await this.getOrThrow(id);
    await this.prisma.clinic.update({
      where: { id },
      data: { deletedAt: new Date(), status: ClinicStatus.CANCELLED },
    });
    await this.auditService.log({
      action: 'CLINIC_DELETE',
      entity: 'Clinic',
      entityId: id,
    });
    return { id };
  }

  async suspend(id: string): Promise<ClinicDetail> {
    await this.getOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.clinic.update({
        where: { id },
        data: { status: ClinicStatus.SUSPENDED },
      });
      await tx.subscription.updateMany({
        where: { clinicId: id, deletedAt: null },
        data: { status: SubscriptionStatus.SUSPENDED },
      });
    });
    await this.auditService.log({
      action: 'CLINIC_SUSPEND',
      entity: 'Clinic',
      entityId: id,
    });
    return this.findOne(id);
  }

  async reactivate(id: string): Promise<ClinicDetail> {
    await this.getOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.clinic.update({
        where: { id },
        data: { status: ClinicStatus.ACTIVE },
      });
      await tx.subscription.updateMany({
        where: { clinicId: id, deletedAt: null },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    });
    await this.auditService.log({
      action: 'CLINIC_REACTIVATE',
      entity: 'Clinic',
      entityId: id,
    });
    return this.findOne(id);
  }

  // ---- private helpers ----

  private async getOrThrow(id: string): Promise<ClinicRow> {
    const clinic = await this.prisma.clinic.findFirst({
      where: { id, deletedAt: null },
    });
    if (!clinic) throw new NotFoundException('Klinika topilmadi');
    return clinic;
  }

  private async resolveSlug(base: string): Promise<string> {
    let slug = base || 'klinika';
    for (let attempt = 0; attempt < 6; attempt++) {
      const taken = await this.prisma.clinic.findFirst({
        where: { slug, deletedAt: null },
      });
      if (!taken) return slug;
      slug = `${base}-${randomSuffix()}`;
    }
    return `${base}-${randomSuffix()}`;
  }

  private async resolvePlan(planId?: string) {
    if (planId) {
      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { id: planId, deletedAt: null, isActive: true },
      });
      if (!plan)
        throw new BadRequestException('Tarif topilmadi yoki faol emas');
      return plan;
    }
    const basic = await this.prisma.subscriptionPlan.findFirst({
      where: { name: 'BASIC', deletedAt: null, isActive: true },
    });
    if (basic) return basic;
    const any = await this.prisma.subscriptionPlan.findFirst({
      where: { deletedAt: null, isActive: true },
      orderBy: { price: 'asc' },
    });
    if (!any) {
      throw new BadRequestException(
        "Avval kamida bitta tarif yarating (subscription_plans bo'sh)",
      );
    }
    return any;
  }

  private async memberCounts(
    clinicIds: string[],
  ): Promise<Map<string, number>> {
    if (clinicIds.length === 0) return new Map();
    const grouped = await this.prisma.clinicMember.groupBy({
      by: ['clinicId'],
      where: { clinicId: { in: clinicIds }, deletedAt: null, isActive: true },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.clinicId, g._count._all]));
  }
}

function randomSuffix(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[randomInt(alphabet.length)];
  return s;
}

function mapClinicBasic(c: ClinicRow): ClinicBasic {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
    address: c.address,
    phone: c.phone,
    email: c.email,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function mapClinicDetail(c: ClinicWithSub, membersCount: number): ClinicDetail {
  const sub = c.subscriptions[0];
  return {
    ...mapClinicBasic(c),
    membersCount,
    subscription: sub ? toSubscriptionResponse(sub) : null,
  };
}
