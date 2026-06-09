import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { Role } from '../../common/constants/roles.constant';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { AuditService } from '../audit/audit.service';
import {
  FileResponse,
  FilesService,
  UploadedMulterFile,
} from '../files/files.service';
import { FilesCleanupService } from '../files/cleanup/files-cleanup.service';
import { FileOwnerType } from '../files/constants/file.constant';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { ListMedicalRecordsQueryDto } from './dto/list-medical-records-query.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

type RecordRow = Prisma.MedicalRecordGetPayload<object>;
type PrescriptionRow = Prisma.PrescriptionItemGetPayload<object>;

export interface MedicalRecordResponse {
  id: string;
  patientId: string;
  appointmentId: string | null;
  doctorId: string;
  complaints: string | null;
  diagnosis: string | null;
  icdCode: string | null;
  treatment: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrescriptionResponse {
  id: string;
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  createdAt: Date;
}

export interface TimelineEntry {
  record: MedicalRecordResponse;
  prescriptions: PrescriptionResponse[];
  files: FileResponse[];
}

export interface Actor {
  userId: string;
  role: string;
}

const MR = FileOwnerType.MEDICAL_RECORD;

/**
 * EMR (spec 7.7). MAXFIY: tenant izolyatsiya qat'iy, har O'QISH audit log'ga
 * yoziladi (kim/qachon/qaysi bemor). Yozish — faqat tegishli shifokor yoki
 * CLINIC_ADMIN. Skanlangan fayllar Phase 4 files moduli orqali (owner=MEDICAL_RECORD).
 */
@Injectable()
export class EmrService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
    private readonly filesService: FilesService,
    @Optional() private readonly cleanup?: FilesCleanupService,
  ) {}

  // ---- Medical records ----

  async createRecord(
    clinicId: string,
    dto: CreateMedicalRecordDto,
    actor: Actor,
  ): Promise<MedicalRecordResponse> {
    const doctorId =
      dto.doctorId ?? (actor.role === Role.DOCTOR ? actor.userId : undefined);
    if (!doctorId) {
      throw new BadRequestException('doctorId talab qilinadi');
    }
    await this.assertPatient(clinicId, dto.patientId);
    await this.assertDoctor(clinicId, doctorId);
    if (dto.appointmentId) {
      await this.assertAppointment(clinicId, dto.appointmentId);
    }

    const record = await this.prisma.medicalRecord.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        doctorId,
        complaints: dto.complaints,
        diagnosis: dto.diagnosis,
        icdCode: dto.icdCode,
        treatment: dto.treatment,
        notes: dto.notes,
      },
    });
    await this.auditService.log({
      action: 'MEDICAL_RECORD_CREATE',
      entity: 'MedicalRecord',
      entityId: record.id,
      clinicId,
      userId: actor.userId,
      metadata: { patientId: dto.patientId, doctorId },
    });
    return toRecordResponse(record);
  }

  async listRecords(
    clinicId: string,
    query: ListMedicalRecordsQueryDto,
    actor: Actor,
  ): Promise<Paginated<MedicalRecordResponse>> {
    const where: Prisma.MedicalRecordWhereInput = { clinicId, deletedAt: null };
    if (query.patientId) where.patientId = query.patientId;

    const [rows, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    // MAXFIYLIK: ro'yxatga kirish ham audit'ga (kim, qaysi bemor).
    await this.auditService.log({
      action: 'MEDICAL_RECORD_LIST',
      entity: 'MedicalRecord',
      clinicId,
      userId: actor.userId,
      metadata: { patientId: query.patientId ?? null, count: rows.length },
    });

    return {
      items: rows.map(toRecordResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findRecord(
    clinicId: string,
    id: string,
    actor: Actor,
  ): Promise<
    MedicalRecordResponse & { prescriptions: PrescriptionResponse[] }
  > {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        prescriptions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!record) throw new NotFoundException('Tibbiy yozuv topilmadi');

    await this.logRead(clinicId, actor, id, record.patientId);

    return {
      ...toRecordResponse(record),
      prescriptions: record.prescriptions.map(toPrescriptionResponse),
    };
  }

  async updateRecord(
    clinicId: string,
    id: string,
    dto: UpdateMedicalRecordDto,
    actor: Actor,
  ): Promise<MedicalRecordResponse> {
    const record = await this.getOrThrow(clinicId, id);
    this.assertCanEdit(record, actor);

    const data: Prisma.MedicalRecordUpdateInput = {};
    if (dto.complaints !== undefined) data.complaints = dto.complaints;
    if (dto.diagnosis !== undefined) data.diagnosis = dto.diagnosis;
    if (dto.icdCode !== undefined) data.icdCode = dto.icdCode;
    if (dto.treatment !== undefined) data.treatment = dto.treatment;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.medicalRecord.update({
      where: { id },
      data,
    });
    await this.auditService.log({
      action: 'MEDICAL_RECORD_UPDATE',
      entity: 'MedicalRecord',
      entityId: id,
      clinicId,
      userId: actor.userId,
    });
    return toRecordResponse(updated);
  }

  async removeRecord(
    clinicId: string,
    id: string,
    actor: Actor,
  ): Promise<{ id: string }> {
    const record = await this.getOrThrow(clinicId, id);
    this.assertCanEdit(record, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.prescriptionItem.updateMany({
        where: { medicalRecordId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.medicalRecord.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.triggerFileCleanup(id, clinicId);
    await this.auditService.log({
      action: 'MEDICAL_RECORD_DELETE',
      entity: 'MedicalRecord',
      entityId: id,
      clinicId,
      userId: actor.userId,
    });
    return { id };
  }

  // ---- Prescriptions (normallashtirilgan retsept) ----

  async addPrescription(
    clinicId: string,
    recordId: string,
    dto: CreatePrescriptionDto,
    actor: Actor,
  ): Promise<PrescriptionResponse> {
    const record = await this.getOrThrow(clinicId, recordId);
    this.assertCanEdit(record, actor);

    const item = await this.prisma.prescriptionItem.create({
      data: {
        clinicId,
        medicalRecordId: recordId,
        drugName: dto.drugName,
        dosage: dto.dosage,
        frequency: dto.frequency,
        duration: dto.duration,
        instructions: dto.instructions,
      },
    });
    await this.auditService.log({
      action: 'PRESCRIPTION_ADD',
      entity: 'PrescriptionItem',
      entityId: item.id,
      clinicId,
      userId: actor.userId,
      metadata: { medicalRecordId: recordId, drugName: dto.drugName },
    });
    return toPrescriptionResponse(item);
  }

  async updatePrescription(
    clinicId: string,
    recordId: string,
    itemId: string,
    dto: UpdatePrescriptionDto,
    actor: Actor,
  ): Promise<PrescriptionResponse> {
    const record = await this.getOrThrow(clinicId, recordId);
    this.assertCanEdit(record, actor);
    await this.getPrescriptionOrThrow(clinicId, recordId, itemId);

    const data: Prisma.PrescriptionItemUpdateInput = {};
    if (dto.drugName !== undefined) data.drugName = dto.drugName;
    if (dto.dosage !== undefined) data.dosage = dto.dosage;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.duration !== undefined) data.duration = dto.duration;
    if (dto.instructions !== undefined) data.instructions = dto.instructions;

    const item = await this.prisma.prescriptionItem.update({
      where: { id: itemId },
      data,
    });
    return toPrescriptionResponse(item);
  }

  async removePrescription(
    clinicId: string,
    recordId: string,
    itemId: string,
    actor: Actor,
  ): Promise<{ id: string }> {
    const record = await this.getOrThrow(clinicId, recordId);
    this.assertCanEdit(record, actor);
    await this.getPrescriptionOrThrow(clinicId, recordId, itemId);

    await this.prisma.prescriptionItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });
    return { id: itemId };
  }

  async listPrescriptions(
    clinicId: string,
    recordId: string,
  ): Promise<PrescriptionResponse[]> {
    await this.getOrThrow(clinicId, recordId);
    const items = await this.prisma.prescriptionItem.findMany({
      where: { clinicId, medicalRecordId: recordId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return items.map(toPrescriptionResponse);
  }

  // ---- Fayllar (skan: lab/rentgen/ma'lumotnoma) ----

  async attachFile(
    clinicId: string,
    recordId: string,
    category: string,
    uploaderId: string,
    file: UploadedMulterFile,
  ): Promise<FileResponse> {
    await this.getOrThrow(clinicId, recordId);
    return this.filesService.upload({
      ownerType: MR,
      ownerId: recordId,
      category,
      clinicId,
      uploadedBy: uploaderId,
      file,
    });
  }

  async listFiles(clinicId: string, recordId: string): Promise<FileResponse[]> {
    await this.getOrThrow(clinicId, recordId);
    return this.filesService.listForOwner(clinicId, MR, recordId);
  }

  async fileUrl(clinicId: string, fileId: string, userId: string) {
    // EMR-gated: bu yerga faqat EMR_READ ruxsatli rol yetadi (controller).
    return this.filesService.getSignedUrl(fileId, clinicId, userId);
  }

  // ---- Bemor tarixi timeline ----

  async timeline(
    clinicId: string,
    patientId: string,
    actor: Actor,
  ): Promise<TimelineEntry[]> {
    await this.assertPatient(clinicId, patientId);
    const records = await this.prisma.medicalRecord.findMany({
      where: { clinicId, patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        prescriptions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const entries: TimelineEntry[] = [];
    for (const r of records) {
      const files = await this.filesService.listForOwner(clinicId, MR, r.id);
      entries.push({
        record: toRecordResponse(r),
        prescriptions: r.prescriptions.map(toPrescriptionResponse),
        files,
      });
    }

    await this.auditService.log({
      action: 'PATIENT_HISTORY_READ',
      entity: 'Patient',
      entityId: patientId,
      clinicId,
      userId: actor.userId,
      metadata: { records: records.length },
    });
    return entries;
  }

  /** PDF retsept uchun xom yozuv (dorilar + bemor + klinika). */
  async getPrescriptionData(clinicId: string, recordId: string, actor: Actor) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, clinicId, deletedAt: null },
      include: {
        patient: true,
        prescriptions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!record) throw new NotFoundException('Tibbiy yozuv topilmadi');
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: clinicId },
    });
    await this.logRead(clinicId, actor, recordId, record.patientId);
    return { record, clinic };
  }

  // ---- private ----

  private async getOrThrow(clinicId: string, id: string): Promise<RecordRow> {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Tibbiy yozuv topilmadi');
    return record;
  }

  private async getPrescriptionOrThrow(
    clinicId: string,
    recordId: string,
    itemId: string,
  ): Promise<PrescriptionRow> {
    const item = await this.prisma.prescriptionItem.findFirst({
      where: {
        id: itemId,
        clinicId,
        medicalRecordId: recordId,
        deletedAt: null,
      },
    });
    if (!item) throw new NotFoundException('Retsept qatori topilmadi');
    return item;
  }

  /** Faqat yozuvni yaratgan shifokor yoki CLINIC_ADMIN tahrirlay oladi. */
  private assertCanEdit(record: RecordRow, actor: Actor): void {
    if (actor.role === Role.DOCTOR && record.doctorId !== actor.userId) {
      throw new ForbiddenException(
        'Faqat yozuvni yaratgan shifokor tahrirlay oladi',
      );
    }
  }

  private async logRead(
    clinicId: string,
    actor: Actor,
    recordId: string,
    patientId: string,
  ): Promise<void> {
    await this.auditService.log({
      action: 'MEDICAL_RECORD_READ',
      entity: 'MedicalRecord',
      entityId: recordId,
      clinicId,
      userId: actor.userId,
      metadata: { patientId },
    });
  }

  private async assertPatient(
    clinicId: string,
    patientId: string,
  ): Promise<void> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId, deletedAt: null },
    });
    if (!patient) throw new BadRequestException('Bemor topilmadi');
  }

  private async assertDoctor(
    clinicId: string,
    doctorId: string,
  ): Promise<void> {
    const member = await this.prisma.clinicMember.findFirst({
      where: { clinicId, userId: doctorId, deletedAt: null, isActive: true },
    });
    if (!member) throw new BadRequestException('Shifokor klinikada topilmadi');
  }

  private async assertAppointment(
    clinicId: string,
    appointmentId: string,
  ): Promise<void> {
    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId, deletedAt: null },
    });
    if (!appt) throw new BadRequestException('Qabul topilmadi');
  }

  private async triggerFileCleanup(
    recordId: string,
    clinicId: string,
  ): Promise<void> {
    if (this.cleanup) {
      await this.cleanup.enqueueOwnerCleanup(MR, recordId, clinicId);
    } else {
      await this.filesService.cleanupOwner(MR, recordId, clinicId);
    }
  }
}

export function toRecordResponse(r: RecordRow): MedicalRecordResponse {
  return {
    id: r.id,
    patientId: r.patientId,
    appointmentId: r.appointmentId,
    doctorId: r.doctorId,
    complaints: r.complaints,
    diagnosis: r.diagnosis,
    icdCode: r.icdCode,
    treatment: r.treatment,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function toPrescriptionResponse(
  p: PrescriptionRow,
): PrescriptionResponse {
  return {
    id: p.id,
    drugName: p.drugName,
    dosage: p.dosage,
    frequency: p.frequency,
    duration: p.duration,
    instructions: p.instructions,
    createdAt: p.createdAt,
  };
}
