import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { generatePassword } from '../../common/utils/password.util';
import { AuditService } from '../audit/audit.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

export interface MemberResponse {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  position: string | null;
  specialization: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateMemberResult {
  member: MemberResponse;
  temporaryPassword?: string;
}

type MemberWithUser = Prisma.ClinicMemberGetPayload<{
  include: { user: true };
}>;

/**
 * Klinika a'zolari (xodimlar). Tenant-scoped: clinicId har doim autentifikatsiya
 * kontekstidan (token) olinadi — foydalanuvchi kiritmaydi. Prisma tenant
 * extension barcha so'rovlarga clinic_id ni avtomatik qo'llaydi (qo'shimcha himoya).
 */
@Injectable()
export class MembersService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
  ) {}

  async create(
    clinicId: string,
    dto: CreateMemberDto,
  ): Promise<CreateMemberResult> {
    // Mavjud foydalanuvchini biriktirish (bir nechta klinikada ishlash holati)
    if (dto.userId) {
      return this.attachExisting(clinicId, dto, dto.userId);
    }

    // Klinika ichida email takrorlanmasin
    const exists = await this.prisma.clinicMember.findFirst({
      where: {
        clinicId,
        deletedAt: null,
        user: { email: dto.email, deletedAt: null },
      },
    });
    if (exists) {
      throw new ConflictException("Bu email bilan a'zo allaqachon mavjud");
    }

    const generated = !dto.password;
    const plain = dto.password ?? generatePassword(16);
    const passwordHash = await argon2.hash(plain, { type: argon2.argon2id });

    const member = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });
      return tx.clinicMember.create({
        data: {
          clinicId,
          userId: user.id,
          role: dto.role,
          position: dto.position,
          specialization: dto.specialization,
        },
        include: { user: true },
      });
    });

    await this.auditService.log({
      action: 'MEMBER_CREATE',
      entity: 'ClinicMember',
      entityId: member.id,
      clinicId,
      metadata: { role: dto.role, linked: false },
    });

    return {
      member: toMemberResponse(member),
      ...(generated ? { temporaryPassword: plain } : {}),
    };
  }

  async findAll(
    clinicId: string,
    query: ListMembersQueryDto,
  ): Promise<Paginated<MemberResponse>> {
    const where: Prisma.ClinicMemberWhereInput = { clinicId, deletedAt: null };
    if (query.role) where.role = query.role;

    const [rows, total] = await Promise.all([
      this.prisma.clinicMember.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.clinicMember.count({ where }),
    ]);

    return {
      items: rows.map(toMemberResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  private async attachExisting(
    clinicId: string,
    dto: CreateMemberDto,
    userId: string,
  ): Promise<CreateMemberResult> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new BadRequestException('Foydalanuvchi topilmadi');

    const already = await this.prisma.clinicMember.findFirst({
      where: { clinicId, userId, deletedAt: null },
    });
    if (already) {
      throw new ConflictException("Bu foydalanuvchi allaqachon a'zo");
    }

    const member = await this.prisma.clinicMember.create({
      data: {
        clinicId,
        userId,
        role: dto.role,
        position: dto.position,
        specialization: dto.specialization,
      },
      include: { user: true },
    });

    await this.auditService.log({
      action: 'MEMBER_CREATE',
      entity: 'ClinicMember',
      entityId: member.id,
      clinicId,
      metadata: { role: dto.role, linked: true },
    });

    return { member: toMemberResponse(member) };
  }
}

export function toMemberResponse(m: MemberWithUser): MemberResponse {
  return {
    id: m.id,
    userId: m.userId,
    fullName: m.user.fullName,
    email: m.user.email,
    phone: m.user.phone,
    role: m.role,
    position: m.position,
    specialization: m.specialization,
    isActive: m.isActive,
    createdAt: m.createdAt,
  };
}
