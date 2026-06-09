import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { generatePassword } from '../../common/utils/password.util';
import { AuditService } from '../audit/audit.service';
import {
  FileResponse,
  FilesService,
  UploadedMulterFile,
} from '../files/files.service';
import { FilesCleanupService } from '../files/cleanup/files-cleanup.service';
import {
  avatarCategoryFor,
  FileOwnerType,
} from '../files/constants/file.constant';
import { CreateMemberDto } from './dto/create-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

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
  avatarFileId: string | null;
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
    private readonly filesService: FilesService,
    // BullMQ cleanup — prod'da bor; test'da yo'q (inline fallback ishlatiladi).
    @Optional() private readonly cleanup?: FilesCleanupService,
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

  async findOne(clinicId: string, memberId: string): Promise<MemberResponse> {
    return toMemberResponse(await this.getOrThrow(clinicId, memberId));
  }

  async update(
    clinicId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberResponse> {
    const member = await this.getOrThrow(clinicId, memberId);

    const userData: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) userData.fullName = dto.fullName;
    if (dto.phone !== undefined) userData.phone = dto.phone;

    const memberData: Prisma.ClinicMemberUpdateInput = {};
    if (dto.role !== undefined) memberData.role = dto.role;
    if (dto.position !== undefined) memberData.position = dto.position;
    if (dto.specialization !== undefined)
      memberData.specialization = dto.specialization;
    if (dto.isActive !== undefined) memberData.isActive = dto.isActive;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: member.userId }, data: userData });
      }
      return tx.clinicMember.update({
        where: { id: memberId },
        data: memberData,
        include: { user: true },
      });
    });

    await this.auditService.log({
      action: 'MEMBER_UPDATE',
      entity: 'ClinicMember',
      entityId: memberId,
      clinicId,
    });
    return toMemberResponse(updated);
  }

  /** A'zolikni soft-delete + shu klinikadagi fayllarini cleanup (boshqa klinika emas). */
  async remove(clinicId: string, memberId: string): Promise<{ id: string }> {
    const member = await this.getOrThrow(clinicId, memberId);
    await this.prisma.clinicMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.triggerFileCleanup(member.userId, clinicId);

    await this.auditService.log({
      action: 'MEMBER_DELETE',
      entity: 'ClinicMember',
      entityId: memberId,
      clinicId,
    });
    return { id: memberId };
  }

  // ---- Fayllar (Phase 4 files moduli orqali) ----

  async uploadAvatar(
    clinicId: string,
    memberId: string,
    uploaderId: string,
    file: UploadedMulterFile,
  ): Promise<FileResponse> {
    const member = await this.getOrThrow(clinicId, memberId);
    return this.filesService.upload({
      ownerType: FileOwnerType.USER,
      ownerId: member.userId,
      category: avatarCategoryFor(FileOwnerType.USER),
      clinicId,
      uploadedBy: uploaderId,
      file,
    });
  }

  async uploadDocument(
    clinicId: string,
    memberId: string,
    uploaderId: string,
    category: string,
    file: UploadedMulterFile,
  ): Promise<FileResponse> {
    const member = await this.getOrThrow(clinicId, memberId);
    return this.filesService.upload({
      ownerType: FileOwnerType.USER,
      ownerId: member.userId,
      category,
      clinicId,
      uploadedBy: uploaderId,
      file,
    });
  }

  async listDocuments(
    clinicId: string,
    memberId: string,
  ): Promise<FileResponse[]> {
    const member = await this.getOrThrow(clinicId, memberId);
    return this.filesService.listForOwner(
      clinicId,
      FileOwnerType.USER,
      member.userId,
    );
  }

  async deleteDocument(
    clinicId: string,
    memberId: string,
    fileId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.getOrThrow(clinicId, memberId);
    return this.filesService.remove(fileId, clinicId, userId);
  }

  // ---- private ----

  private async getOrThrow(
    clinicId: string,
    memberId: string,
  ): Promise<MemberWithUser> {
    const member = await this.prisma.clinicMember.findFirst({
      where: { id: memberId, clinicId, deletedAt: null },
      include: { user: true },
    });
    if (!member) throw new NotFoundException('Xodim topilmadi');
    return member;
  }

  /** Fayl cleanup: prod'da navbatga, test/queue'siz holatda inline. */
  private async triggerFileCleanup(
    userId: string,
    clinicId: string,
  ): Promise<void> {
    if (this.cleanup) {
      await this.cleanup.enqueueOwnerCleanup(
        FileOwnerType.USER,
        userId,
        clinicId,
      );
    } else {
      await this.filesService.cleanupOwner(
        FileOwnerType.USER,
        userId,
        clinicId,
      );
    }
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
    avatarFileId: m.user.avatarUrl,
    createdAt: m.createdAt,
  };
}
