import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { AuditService } from '../audit/audit.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { parseHm } from './scheduling.util';

type ScheduleRow = Prisma.DoctorScheduleGetPayload<object>;

export interface ScheduleResponse {
  id: string;
  doctorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive: boolean;
}

/** Shifokor ish jadvali (spec 7.6). Faqat SCHEDULE_MANAGE (CLINIC_ADMIN). */
@Injectable()
export class DoctorSchedulesService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
  ) {}

  async create(
    clinicId: string,
    dto: CreateScheduleDto,
  ): Promise<ScheduleResponse> {
    this.assertTimeRange(dto.startTime, dto.endTime);
    await this.assertDoctor(clinicId, dto.doctorId);

    const row = await this.prisma.doctorSchedule.create({
      data: {
        clinicId,
        doctorId: dto.doctorId,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotMinutes: dto.slotMinutes,
        isActive: dto.isActive ?? true,
      },
    });
    await this.auditService.log({
      action: 'SCHEDULE_CREATE',
      entity: 'DoctorSchedule',
      entityId: row.id,
      clinicId,
      metadata: { doctorId: dto.doctorId, weekday: dto.weekday },
    });
    return toScheduleResponse(row);
  }

  async findAll(
    clinicId: string,
    doctorId?: string,
  ): Promise<ScheduleResponse[]> {
    const where: Prisma.DoctorScheduleWhereInput = {
      clinicId,
      deletedAt: null,
    };
    if (doctorId) where.doctorId = doctorId;
    const rows = await this.prisma.doctorSchedule.findMany({
      where,
      orderBy: [{ doctorId: 'asc' }, { weekday: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map(toScheduleResponse);
  }

  async update(
    clinicId: string,
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleResponse> {
    const current = await this.getOrThrow(clinicId, id);
    const start = dto.startTime ?? current.startTime;
    const end = dto.endTime ?? current.endTime;
    this.assertTimeRange(start, end);
    if (dto.doctorId) await this.assertDoctor(clinicId, dto.doctorId);

    const data: Prisma.DoctorScheduleUpdateInput = {};
    if (dto.doctorId !== undefined) data.doctorId = dto.doctorId;
    if (dto.weekday !== undefined) data.weekday = dto.weekday;
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;
    if (dto.slotMinutes !== undefined) data.slotMinutes = dto.slotMinutes;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const row = await this.prisma.doctorSchedule.update({
      where: { id },
      data,
    });
    await this.auditService.log({
      action: 'SCHEDULE_UPDATE',
      entity: 'DoctorSchedule',
      entityId: id,
      clinicId,
    });
    return toScheduleResponse(row);
  }

  async remove(clinicId: string, id: string): Promise<{ id: string }> {
    await this.getOrThrow(clinicId, id);
    await this.prisma.doctorSchedule.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.auditService.log({
      action: 'SCHEDULE_DELETE',
      entity: 'DoctorSchedule',
      entityId: id,
      clinicId,
    });
    return { id };
  }

  // ---- private ----

  private async getOrThrow(clinicId: string, id: string): Promise<ScheduleRow> {
    const row = await this.prisma.doctorSchedule.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Ish jadvali topilmadi');
    return row;
  }

  private async assertDoctor(
    clinicId: string,
    doctorId: string,
  ): Promise<void> {
    const member = await this.prisma.clinicMember.findFirst({
      where: { clinicId, userId: doctorId, deletedAt: null, isActive: true },
    });
    if (!member) {
      throw new BadRequestException(
        'Shifokor (xodim) ushbu klinikada topilmadi',
      );
    }
  }

  private assertTimeRange(startTime: string, endTime: string): void {
    const s = parseHm(startTime);
    const e = parseHm(endTime);
    if (Number.isNaN(s) || Number.isNaN(e) || s >= e) {
      throw new BadRequestException(
        'startTime endTime dan kichik bo`lishi kerak (HH:MM)',
      );
    }
  }
}

export function toScheduleResponse(s: ScheduleRow): ScheduleResponse {
  return {
    id: s.id,
    doctorId: s.doctorId,
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    slotMinutes: s.slotMinutes,
    isActive: s.isActive,
  };
}
