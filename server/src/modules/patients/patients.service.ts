import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
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
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';

type PatientRow = Prisma.PatientGetPayload<object>;

export interface PatientResponse {
  id: string;
  fullName: string;
  birthDate: Date | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  bloodType: string | null;
  allergies: string | null;
  avatarFileId: string | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * Bemorlar (Phase 5A, spec 7.4). Tenant-scoped: clinicId TOKEN'dan — boshqa
 * klinika bemori/fayli ko'rinmaydi (Prisma extension + aniq filtr). Rasm/hujjatlar
 * Phase 4 files moduli orqali (owner_type=PATIENT).
 */
@Injectable()
export class PatientsService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
    private readonly filesService: FilesService,
    @Optional() private readonly cleanup?: FilesCleanupService,
  ) {}

  async create(
    clinicId: string,
    dto: CreatePatientDto,
  ): Promise<PatientResponse> {
    const patient = await this.prisma.patient.create({
      data: {
        clinicId,
        fullName: dto.fullName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender,
        phone: dto.phone,
        address: dto.address,
        bloodType: dto.bloodType,
        allergies: dto.allergies,
        notes: dto.notes,
      },
    });
    await this.auditService.log({
      action: 'PATIENT_CREATE',
      entity: 'Patient',
      entityId: patient.id,
      clinicId,
    });
    return toPatientResponse(patient);
  }

  async findAll(
    clinicId: string,
    query: ListPatientsQueryDto,
  ): Promise<Paginated<PatientResponse>> {
    const where: Prisma.PatientWhereInput = { clinicId, deletedAt: null };
    if (query.gender) where.gender = query.gender;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      items: rows.map(toPatientResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(clinicId: string, id: string): Promise<PatientResponse> {
    return toPatientResponse(await this.getOrThrow(clinicId, id));
  }

  async update(
    clinicId: string,
    id: string,
    dto: UpdatePatientDto,
  ): Promise<PatientResponse> {
    await this.getOrThrow(clinicId, id);

    const data: Prisma.PatientUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.birthDate !== undefined)
      data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.bloodType !== undefined) data.bloodType = dto.bloodType;
    if (dto.allergies !== undefined) data.allergies = dto.allergies;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.patient.update({ where: { id }, data });
    await this.auditService.log({
      action: 'PATIENT_UPDATE',
      entity: 'Patient',
      entityId: id,
      clinicId,
    });
    return toPatientResponse(updated);
  }

  async remove(clinicId: string, id: string): Promise<{ id: string }> {
    await this.getOrThrow(clinicId, id);
    await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.triggerFileCleanup(id, clinicId);
    await this.auditService.log({
      action: 'PATIENT_DELETE',
      entity: 'Patient',
      entityId: id,
      clinicId,
    });
    return { id };
  }

  // ---- Fayllar ----

  async uploadAvatar(
    clinicId: string,
    patientId: string,
    uploaderId: string,
    file: UploadedMulterFile,
  ): Promise<FileResponse> {
    await this.getOrThrow(clinicId, patientId);
    return this.filesService.upload({
      ownerType: FileOwnerType.PATIENT,
      ownerId: patientId,
      category: avatarCategoryFor(FileOwnerType.PATIENT),
      clinicId,
      uploadedBy: uploaderId,
      file,
    });
  }

  async uploadDocument(
    clinicId: string,
    patientId: string,
    uploaderId: string,
    category: string,
    file: UploadedMulterFile,
  ): Promise<FileResponse> {
    await this.getOrThrow(clinicId, patientId);
    return this.filesService.upload({
      ownerType: FileOwnerType.PATIENT,
      ownerId: patientId,
      category,
      clinicId,
      uploadedBy: uploaderId,
      file,
    });
  }

  async listDocuments(
    clinicId: string,
    patientId: string,
  ): Promise<FileResponse[]> {
    await this.getOrThrow(clinicId, patientId);
    return this.filesService.listForOwner(
      clinicId,
      FileOwnerType.PATIENT,
      patientId,
    );
  }

  async deleteDocument(
    clinicId: string,
    patientId: string,
    fileId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.getOrThrow(clinicId, patientId);
    return this.filesService.remove(fileId, clinicId, userId);
  }

  // ---- private ----

  private async getOrThrow(clinicId: string, id: string): Promise<PatientRow> {
    const patient = await this.prisma.patient.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Bemor topilmadi');
    return patient;
  }

  private async triggerFileCleanup(
    patientId: string,
    clinicId: string,
  ): Promise<void> {
    if (this.cleanup) {
      await this.cleanup.enqueueOwnerCleanup(
        FileOwnerType.PATIENT,
        patientId,
        clinicId,
      );
    } else {
      await this.filesService.cleanupOwner(
        FileOwnerType.PATIENT,
        patientId,
        clinicId,
      );
    }
  }
}

export function toPatientResponse(p: PatientRow): PatientResponse {
  return {
    id: p.id,
    fullName: p.fullName,
    birthDate: p.birthDate,
    gender: p.gender,
    phone: p.phone,
    address: p.address,
    bloodType: p.bloodType,
    allergies: p.allergies,
    avatarFileId: p.avatarUrl,
    notes: p.notes,
    createdAt: p.createdAt,
  };
}
