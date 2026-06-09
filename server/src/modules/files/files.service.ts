import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { runWithTenant } from '../../core/tenant/tenant-context';
import { StorageService } from '../../core/storage/storage.service';
import { StorageConfig } from '../../config/configuration';
import { ActorType } from '../../common/constants/roles.constant';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { AuditService } from '../audit/audit.service';
import {
  ALLOWED_MIME_LIST,
  AVATAR_CATEGORIES,
  extensionForMime,
  FileOwnerType,
  isAllowedMime,
} from './constants/file.constant';
import { ListFilesQueryDto } from './dto/list-files-query.dto';

type FileRow = Prisma.FileGetPayload<object>;

export interface FileResponse {
  id: string;
  ownerType: string;
  ownerId: string;
  category: string;
  originalName: string;
  mimeType: string;
  size: string; // BigInt -> string (JSON-safe)
  uploadedBy: string | null;
  createdAt: Date;
}

export interface UploadFileInput {
  ownerType: string;
  ownerId: string;
  category: string;
  clinicId: string;
  uploadedBy: string;
  file: UploadedMulterFile;
}

/** Multer fayl shakli (@UploadedFile orqali keladi). */
export interface UploadedMulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface SignedUrlResult {
  url: string;
  expiresIn: number;
}

const GB = BigInt(1024) * BigInt(1024) * BigInt(1024);

/**
 * Universal fayl moduli (spec 6). Tenant izolyatsiyasi: File TENANT_MODELS'da —
 * Prisma extension avtomatik clinic_id qo'yadi (boshqa klinika faylini ochib
 * bo'lmaydi). Fayllarning o'zi MinIO/S3'da; o'qish FAQAT signed URL orqali.
 */
@Injectable()
export class FilesService {
  private readonly storageCfg: StorageConfig;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly storage: StorageService,
    private readonly auditService: AuditService,
    config: ConfigService,
  ) {
    this.storageCfg = config.getOrThrow<StorageConfig>('storage');
  }

  // ---- Upload ----
  async upload(input: UploadFileInput): Promise<FileResponse> {
    const { file } = input;
    this.assertMime(file.mimetype);
    this.assertSize(file.size);
    await this.assertStorageLimit(input.clinicId, BigInt(file.size));

    const ext = extensionForMime(file.mimetype);
    const objectId = uuidv7();
    const storageKey = `clinics/${input.clinicId}/${input.ownerType}/${input.ownerId}/${objectId}.${ext}`;

    // 1) Storage'ga yuklash
    await this.storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
      size: file.size,
    });

    // 2) Metadata bazaga (clinic_id extension orqali avtomatik, lekin aniq beramiz)
    const created = await this.prisma.file.create({
      data: {
        clinicId: input.clinicId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        category: input.category,
        storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: BigInt(file.size),
        uploadedBy: input.uploadedBy,
      },
    });

    await this.auditService.log({
      action: 'FILE_UPLOAD',
      entity: 'File',
      entityId: created.id,
      clinicId: input.clinicId,
      userId: input.uploadedBy,
      metadata: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        category: input.category,
        size: file.size,
        mimeType: file.mimetype,
      },
    });

    // Profil rasmi bo'lsa — egasining avatar_url'ini yangilaymiz (fayl id saqlanadi)
    if (AVATAR_CATEGORIES.includes(input.category)) {
      if (input.ownerType === FileOwnerType.USER) {
        await this.prisma.user.update({
          where: { id: input.ownerId },
          data: { avatarUrl: created.id },
        });
      } else if (input.ownerType === FileOwnerType.PATIENT) {
        await this.prisma.patient.update({
          where: { id: input.ownerId },
          data: { avatarUrl: created.id },
        });
      }
    }

    return toFileResponse(created);
  }

  /** Owner bo'yicha barcha (soft-delete qilinmagan) fayllar — staff/patient hujjatlari. */
  async listForOwner(
    clinicId: string,
    ownerType: string,
    ownerId: string,
  ): Promise<FileResponse[]> {
    const rows = await this.prisma.file.findMany({
      where: { clinicId, ownerType, ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toFileResponse);
  }

  // ---- List (owner bo'yicha) ----
  async list(
    query: ListFilesQueryDto,
    clinicId: string,
  ): Promise<Paginated<FileResponse>> {
    const where: Prisma.FileWhereInput = {
      clinicId,
      ownerType: query.ownerType,
      ownerId: query.ownerId,
      deletedAt: null,
    };
    if (query.category) where.category = query.category;

    const [rows, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      items: rows.map(toFileResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  // ---- Signed URL (xavfsiz kirish) ----
  async getSignedUrl(
    id: string,
    clinicId: string,
    userId: string,
    // MAXFIYLIK (spec 10): MEDICAL_RECORD fayllari faqat EMR ruxsatli rolga.
    // Universal /files endpoint EMR_READ'siz rolga (registrator) bermaydi.
    canAccessMedical = true,
  ): Promise<SignedUrlResult> {
    // Tenant: Prisma extension clinic_id qo'yadi; qo'shimcha aniq beramiz.
    const file = await this.prisma.file.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('Fayl topilmadi');
    if (file.ownerType === FileOwnerType.MEDICAL_RECORD && !canAccessMedical) {
      throw new ForbiddenException('Tibbiy faylga kirish ruxsati yo`q');
    }

    const url = await this.storage.getSignedDownloadUrl(
      file.storageKey,
      this.storageCfg.signedUrlTtl,
      file.originalName,
    );

    // Har OCHISH audit log'ga (spec 6.4 / 10)
    await this.auditService.log({
      action: 'FILE_DOWNLOAD',
      entity: 'File',
      entityId: file.id,
      clinicId,
      userId,
      metadata: { category: file.category, ownerType: file.ownerType },
    });

    return { url, expiresIn: this.storageCfg.signedUrlTtl };
  }

  // ---- Delete (soft-delete + storage cleanup) ----
  async remove(
    id: string,
    clinicId: string,
    userId: string,
  ): Promise<{ id: string }> {
    const file = await this.prisma.file.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('Fayl topilmadi');

    await this.prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });

    // Storage'dan tozalash (best-effort — DB allaqachon soft-delete qilingan)
    await this.safeDeleteObject(file.storageKey);

    await this.auditService.log({
      action: 'FILE_DELETE',
      entity: 'File',
      entityId: file.id,
      clinicId,
      userId,
      metadata: { ownerType: file.ownerType, ownerId: file.ownerId },
    });

    return { id: file.id };
  }

  /**
   * Cleanup (BullMQ job): egasi (user/patient/medical_record) o'chganda uning
   * fayllarini storage'dan tozalaydi + DB'da soft-delete qiladi. Soft-delete
   * qilingan fayllarni ham qamrab oladi (bypassSoftDelete). Idempotent.
   *
   * `clinicId` berilsa — faqat o'sha klinika fayllari (USER bir nechta klinikada
   * bo'lishi mumkin: bitta klinikadan chiqarilganda boshqa klinika fayllari o'chmasin).
   */
  async cleanupOwner(
    ownerType: string,
    ownerId: string,
    clinicId?: string,
  ): Promise<{ purged: number }> {
    // Job kontekstida store yo'q -> tenant/soft-delete filtrlarini chetlab o'tamiz
    return runWithTenant(
      {
        requestId: `cleanup-${ownerId}`,
        bypassTenant: true,
        bypassSoftDelete: true,
        actorType: ActorType.SYSTEM,
      },
      async () => {
        const files = await this.prisma.file.findMany({
          where: { ownerType, ownerId, ...(clinicId ? { clinicId } : {}) },
        });
        let purged = 0;
        for (const f of files) {
          await this.safeDeleteObject(f.storageKey);
          if (!f.deletedAt) {
            await this.prisma.file.update({
              where: { id: f.id },
              data: { deletedAt: new Date() },
            });
          }
          purged++;
        }
        if (purged > 0) {
          await this.auditService.log({
            action: 'FILE_CLEANUP',
            entity: 'File',
            actorType: ActorType.SYSTEM,
            clinicId,
            metadata: { ownerType, ownerId, purged },
          });
        }
        return { purged };
      },
    );
  }

  // ---- validatsiya yordamchilari ----

  private assertMime(mime: string): void {
    if (!isAllowedMime(mime)) {
      throw new BadRequestException(
        `Ruxsat etilmagan fayl turi: ${mime}. Ruxsat: ${ALLOWED_MIME_LIST.join(', ')}`,
      );
    }
  }

  private assertSize(size: number): void {
    if (size <= 0) {
      throw new BadRequestException("Bo'sh fayl yuklab bo'lmaydi");
    }
    if (size > this.storageCfg.maxFileSize) {
      const mb = Math.floor(this.storageCfg.maxFileSize / (1024 * 1024));
      throw new PayloadTooLargeException(
        `Fayl hajmi limitdan oshdi (maksimum ${mb} MB)`,
      );
    }
  }

  /** Klinikaning umumiy fayl hajmi tarif limitidan oshmasligini tekshiradi. */
  private async assertStorageLimit(
    clinicId: string,
    addSize: bigint,
  ): Promise<void> {
    const limitGb = await this.resolveStorageLimitGb(clinicId);
    if (limitGb === null) return; // limit belgilanmagan -> tekshiruv yo'q

    const agg = await this.prisma.file.aggregate({
      where: { clinicId, deletedAt: null },
      _sum: { size: true },
    });
    const used = agg._sum.size ?? BigInt(0);
    const limitBytes = BigInt(limitGb) * GB;
    if (used + addSize > limitBytes) {
      throw new BadRequestException(
        `Klinika fayl hajmi limiti (${limitGb} GB) oshib ketadi. Tarifni yangilang.`,
      );
    }
  }

  /** Klinika tarifidagi storageGb limitini qaytaradi (yo'q bo'lsa null). */
  private async resolveStorageLimitGb(
    clinicId: string,
  ): Promise<number | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { clinicId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    const limits = sub?.plan?.limits as
      | { storageGb?: number }
      | null
      | undefined;
    const gb = limits?.storageGb;
    return typeof gb === 'number' && gb > 0 ? gb : null;
  }

  private async safeDeleteObject(key: string): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch {
      // Storage o'chirish muvaffaqiyatsiz bo'lsa — biznes amalni buzmaymiz.
    }
  }
}

export function toFileResponse(f: FileRow): FileResponse {
  return {
    id: f.id,
    ownerType: f.ownerType,
    ownerId: f.ownerId,
    category: f.category,
    originalName: f.originalName,
    mimeType: f.mimeType,
    size: f.size.toString(),
    uploadedBy: f.uploadedBy,
    createdAt: f.createdAt,
  };
}
