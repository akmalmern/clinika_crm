import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { SchedulingConfig } from '../../config/configuration';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { AuditService } from '../audit/audit.service';
import { CashierService } from '../cashier/cashier.service';
import { NotificationsQueueService } from '../notifications/notifications-queue.service';
import {
  AppointmentStatus,
  BLOCKING_STATUSES,
  canTransition,
  DEFAULT_APPOINTMENT_MINUTES,
} from './constants/appointment.constant';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import {
  parseHm,
  slotStartsForWindow,
  toLocalParts,
  utcFromLocalDateMinute,
  weekdayOfLocalDate,
  formatHm,
} from './scheduling.util';

type ApptDetailed = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { id: true; fullName: true; phone: true } };
    service: { select: { id: true; name: true; price: true } };
  };
}>;

export interface AppointmentResponse {
  id: string;
  patientId: string;
  patientName: string | null;
  doctorId: string;
  serviceId: string | null;
  serviceName: string | null;
  scheduledAt: Date;
  endsAt: Date;
  status: string;
  notes: string | null;
  createdAt: Date;
}

export interface FreeSlot {
  start: Date;
  end: Date;
  startLocal: string;
}

const apptInclude = {
  patient: { select: { id: true, fullName: true, phone: true } },
  service: { select: { id: true, name: true, price: true } },
} as const;

/**
 * Qabullar (spec 7.6). Double-booking: per-doctor advisory lock + overlap
 * tekshiruvi + DB EXCLUDE constraint (parallel xavfsizlik). Faqat shifokor ish
 * vaqtiga yozish mumkin. Holat o'zgarishi appointment_status_history'ga yoziladi.
 */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  private readonly tzOffset: number;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    config: ConfigService,
    private readonly auditService: AuditService,
    private readonly cashier: CashierService,
    // BullMQ navbati — prod'da bor; test'da yo'q (@Optional -> jim).
    @Optional() private readonly notifications?: NotificationsQueueService,
  ) {
    this.tzOffset =
      config.getOrThrow<SchedulingConfig>('scheduling').tzOffsetMinutes;
  }

  // ---- Create (book) ----
  async create(
    clinicId: string,
    dto: CreateAppointmentDto,
    userId: string,
  ): Promise<AppointmentResponse> {
    await this.assertDoctor(clinicId, dto.doctorId);
    await this.assertPatient(clinicId, dto.patientId);
    const service = dto.serviceId
      ? await this.getService(clinicId, dto.serviceId)
      : null;

    const scheduledAt = new Date(dto.scheduledAt);
    const duration =
      dto.durationMinutes ?? service?.duration ?? DEFAULT_APPOINTMENT_MINUTES;
    const endsAt = new Date(scheduledAt.getTime() + duration * 60_000);

    this.assertFuture(scheduledAt);
    await this.assertWithinSchedule(
      clinicId,
      dto.doctorId,
      scheduledAt,
      endsAt,
    );

    const created = await this.bookWithLock(
      clinicId,
      dto.doctorId,
      scheduledAt,
      endsAt,
      async (tx) => {
        const appt = await tx.appointment.create({
          data: {
            clinicId,
            patientId: dto.patientId,
            doctorId: dto.doctorId,
            serviceId: dto.serviceId,
            scheduledAt,
            endsAt,
            status: AppointmentStatus.PENDING,
            notes: dto.notes,
          },
          include: apptInclude,
        });
        await tx.appointmentStatusHistory.create({
          data: {
            clinicId,
            appointmentId: appt.id,
            oldStatus: null,
            newStatus: AppointmentStatus.PENDING,
            changedBy: userId,
          },
        });
        return appt;
      },
    );

    await this.auditService.log({
      action: 'APPOINTMENT_CREATE',
      entity: 'Appointment',
      entityId: created.id,
      clinicId,
      userId,
      metadata: {
        doctorId: dto.doctorId,
        scheduledAt: scheduledAt.toISOString(),
      },
    });
    // Eslatma (bemorga) + yangi qabul (shifokorga) navbatga (spec 12).
    await this.safeNotify(() =>
      this.notifications?.onAppointmentCreated({
        id: created.id,
        clinicId,
        scheduledAt: created.scheduledAt,
      }),
    );
    return toAppointmentResponse(created);
  }

  /** Bildirishnoma navbatga qo'shish — xato bo'lsa asosiy amalni buzmaydi. */
  private async safeNotify(fn: () => Promise<void> | undefined): Promise<void> {
    try {
      await fn();
    } catch (err) {
      // Navbat xatosi (Redis va h.k.) qabul yaratishni buzmasligi kerak.
      this.logger.warn(
        `Bildirishnoma navbatga qo'shilmadi: ${(err as Error)?.message}`,
      );
    }
  }

  // ---- List / calendar ----
  async findAll(
    clinicId: string,
    query: ListAppointmentsQueryDto,
    restrictDoctorId?: string,
  ): Promise<Paginated<AppointmentResponse>> {
    const where: Prisma.AppointmentWhereInput = { clinicId, deletedAt: null };
    where.doctorId = restrictDoctorId ?? query.doctorId;
    if (where.doctorId === undefined) delete where.doctorId;
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      const scheduledAt: Prisma.DateTimeFilter = {};
      if (query.from) scheduledAt.gte = new Date(query.from);
      if (query.to) scheduledAt.lte = new Date(query.to);
      where.scheduledAt = scheduledAt;
    }

    const [rows, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: query.skip,
        take: query.limit,
        include: apptInclude,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return {
      items: rows.map(toAppointmentResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(
    clinicId: string,
    id: string,
    restrictDoctorId?: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.getOrThrow(clinicId, id, restrictDoctorId),
    );
  }

  // ---- Reschedule / edit ----
  async update(
    clinicId: string,
    id: string,
    dto: UpdateAppointmentDto,
    userId: string,
  ): Promise<AppointmentResponse> {
    const current = await this.getOrThrow(clinicId, id);
    if (
      current.status === AppointmentStatus.COMPLETED ||
      current.status === AppointmentStatus.CANCELLED ||
      current.status === AppointmentStatus.NO_SHOW
    ) {
      throw new ConflictException(
        'Yakunlangan/bekor qilingan qabulni tahrirlab bo`lmaydi',
      );
    }

    const doctorId = dto.doctorId ?? current.doctorId;
    if (dto.doctorId) await this.assertDoctor(clinicId, dto.doctorId);
    // Yangi xizmat berilsa — mavjudligini tekshiramiz (davomiylik o'zgarmaydi,
    // agar durationMinutes berilmasa joriy davom saqlanadi).
    if (dto.serviceId) await this.getService(clinicId, dto.serviceId);

    const scheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : current.scheduledAt;
    const duration =
      dto.durationMinutes ??
      Math.round(
        (current.endsAt.getTime() - current.scheduledAt.getTime()) / 60000,
      );
    const endsAt =
      dto.scheduledAt || dto.durationMinutes
        ? new Date(scheduledAt.getTime() + duration * 60_000)
        : current.endsAt;

    const timeOrDoctorChanged =
      !!dto.scheduledAt ||
      !!dto.durationMinutes ||
      (dto.doctorId && dto.doctorId !== current.doctorId);

    if (timeOrDoctorChanged) {
      this.assertFuture(scheduledAt);
      await this.assertWithinSchedule(clinicId, doctorId, scheduledAt, endsAt);
    }

    const data: Prisma.AppointmentUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.serviceId !== undefined) {
      data.service = dto.serviceId
        ? { connect: { id: dto.serviceId } }
        : { disconnect: true };
    }
    if (dto.doctorId !== undefined) data.doctorId = dto.doctorId;
    if (dto.scheduledAt || dto.durationMinutes) {
      data.scheduledAt = scheduledAt;
      data.endsAt = endsAt;
    }

    const updated = timeOrDoctorChanged
      ? await this.bookWithLock(
          clinicId,
          doctorId,
          scheduledAt,
          endsAt,
          (tx) =>
            tx.appointment.update({
              where: { id },
              data,
              include: apptInclude,
            }),
          id,
        )
      : await this.prisma.appointment.update({
          where: { id },
          data,
          include: apptInclude,
        });

    await this.auditService.log({
      action: 'APPOINTMENT_UPDATE',
      entity: 'Appointment',
      entityId: id,
      clinicId,
      userId,
    });
    return toAppointmentResponse(updated);
  }

  // ---- Status change (state machine + history + COMPLETED->invoice) ----
  async changeStatus(
    clinicId: string,
    id: string,
    newStatus: string,
    userId: string,
    note?: string,
    restrictDoctorId?: string,
  ): Promise<AppointmentResponse> {
    const current = await this.getOrThrow(clinicId, id, restrictDoctorId);
    if (current.status === newStatus) {
      return toAppointmentResponse(current);
    }
    if (!canTransition(current.status, newStatus)) {
      throw new BadRequestException(
        `Holatni ${current.status} -> ${newStatus} ga o'tkazib bo'lmaydi`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.update({
        where: { id },
        data: { status: newStatus },
        include: apptInclude,
      });
      await tx.appointmentStatusHistory.create({
        data: {
          clinicId,
          appointmentId: id,
          oldStatus: current.status,
          newStatus,
          changedBy: userId,
        },
      });
      return appt;
    });

    // Yakunlanганда — bemor invoice (xizmat narxi). Idempotent (cashier).
    if (newStatus === AppointmentStatus.COMPLETED && updated.service) {
      await this.cashier.createInvoiceForAppointment(clinicId, {
        patientId: updated.patientId,
        appointmentId: updated.id,
        amount: updated.service.price,
      });
    }

    await this.auditService.log({
      action: 'APPOINTMENT_STATUS_CHANGE',
      entity: 'Appointment',
      entityId: id,
      clinicId,
      userId,
      metadata: { from: current.status, to: newStatus, note: note ?? null },
    });

    // Bekor qilinganda — bemorga xabar navbatga.
    if (newStatus === AppointmentStatus.CANCELLED) {
      await this.safeNotify(() =>
        this.notifications?.onAppointmentCancelled({
          id: updated.id,
          clinicId,
          scheduledAt: updated.scheduledAt,
        }),
      );
    }
    return toAppointmentResponse(updated);
  }

  async cancel(
    clinicId: string,
    id: string,
    userId: string,
    note?: string,
  ): Promise<AppointmentResponse> {
    return this.changeStatus(
      clinicId,
      id,
      AppointmentStatus.CANCELLED,
      userId,
      note,
    );
  }

  // ---- Free slots ----
  async freeSlots(
    clinicId: string,
    doctorId: string,
    dateStr: string,
  ): Promise<FreeSlot[]> {
    const weekday = weekdayOfLocalDate(dateStr);
    const schedules = await this.prisma.doctorSchedule.findMany({
      where: { clinicId, doctorId, weekday, isActive: true, deletedAt: null },
    });
    if (schedules.length === 0) return [];

    const dayStart = utcFromLocalDateMinute(dateStr, 0, this.tzOffset);
    const dayEnd = utcFromLocalDateMinute(dateStr, 24 * 60, this.tzOffset);
    const booked = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId,
        deletedAt: null,
        status: { in: BLOCKING_STATUSES },
        scheduledAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { scheduledAt: true, endsAt: true },
    });

    const slots: FreeSlot[] = [];
    for (const s of schedules) {
      const startMin = parseHm(s.startTime);
      const endMin = parseHm(s.endTime);
      if (Number.isNaN(startMin) || Number.isNaN(endMin)) continue;
      for (const m of slotStartsForWindow(startMin, endMin, s.slotMinutes)) {
        const start = utcFromLocalDateMinute(dateStr, m, this.tzOffset);
        const end = new Date(start.getTime() + s.slotMinutes * 60_000);
        const overlaps = booked.some(
          (b) =>
            start.getTime() < b.endsAt.getTime() &&
            b.scheduledAt.getTime() < end.getTime(),
        );
        if (!overlaps) {
          slots.push({ start, end, startLocal: formatHm(m) });
        }
      }
    }
    slots.sort((a, b) => a.start.getTime() - b.start.getTime());
    return slots;
  }

  // ---- private ----

  /**
   * Double-booking xavfsiz bron: per-doctor advisory xact lock (parallel
   * so'rovlarni ketma-ket qiladi) + overlap tekshiruvi + DB EXCLUDE backstop.
   * excludeId — update'da o'zini hisobga olmaslik uchun.
   */
  private async bookWithLock<T>(
    clinicId: string,
    doctorId: string,
    scheduledAt: Date,
    endsAt: Date,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    excludeId?: string,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Shu shifokor uchun bronlashni serializatsiya qilamiz.
        // pg_advisory_xact_lock -> void; Prisma void'ni deserialize qila olmaydi,
        // shuning uchun subquery bilan integer ustun qaytaramiz.
        await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtextextended(${doctorId}::text, 0))) AS _lock`;
        const overlap = await tx.appointment.findFirst({
          where: {
            clinicId,
            doctorId,
            deletedAt: null,
            status: { in: BLOCKING_STATUSES },
            scheduledAt: { lt: endsAt },
            endsAt: { gt: scheduledAt },
            ...(excludeId ? { id: { not: excludeId } } : {}),
          },
        });
        if (overlap) {
          throw new ConflictException(
            'Bu vaqt oralig`ida shifokorда boshqa qabul bor (double-booking)',
          );
        }
        return work(tx as unknown as Prisma.TransactionClient);
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      if (isOverlapDbError(err)) {
        throw new ConflictException(
          'Bu vaqt oralig`ida shifokorда boshqa qabul bor (double-booking)',
        );
      }
      throw err;
    }
  }

  private async getOrThrow(
    clinicId: string,
    id: string,
    restrictDoctorId?: string,
  ): Promise<ApptDetailed> {
    const where: Prisma.AppointmentWhereInput = {
      id,
      clinicId,
      deletedAt: null,
    };
    if (restrictDoctorId) where.doctorId = restrictDoctorId;
    const appt = await this.prisma.appointment.findFirst({
      where,
      include: apptInclude,
    });
    if (!appt) throw new NotFoundException('Qabul topilmadi');
    return appt;
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

  private async assertPatient(
    clinicId: string,
    patientId: string,
  ): Promise<void> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId, deletedAt: null },
    });
    if (!patient) throw new BadRequestException('Bemor topilmadi');
  }

  private async getService(clinicId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, clinicId, deletedAt: null },
    });
    if (!service) throw new BadRequestException('Xizmat topilmadi');
    return service;
  }

  private assertFuture(scheduledAt: Date): void {
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException("O'tgan vaqtga qabul yozib bo'lmaydi");
    }
  }

  /** Qabul shifokorning ish vaqti (doctor_schedules) ichidami (mahalliy vaqt). */
  private async assertWithinSchedule(
    clinicId: string,
    doctorId: string,
    scheduledAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const start = toLocalParts(scheduledAt, this.tzOffset);
    const end = toLocalParts(endsAt, this.tzOffset);
    // Bir mahalliy kun ichida bo'lsin (tun yarmidan o'tmasin)
    const endMin =
      end.weekday === start.weekday
        ? end.minuteOfDay
        : end.minuteOfDay + 24 * 60;

    const schedules = await this.prisma.doctorSchedule.findMany({
      where: {
        clinicId,
        doctorId,
        weekday: start.weekday,
        isActive: true,
        deletedAt: null,
      },
    });
    const ok = schedules.some(
      (s) =>
        parseHm(s.startTime) <= start.minuteOfDay &&
        parseHm(s.endTime) >= endMin,
    );
    if (!ok) {
      throw new BadRequestException(
        'Qabul shifokorning ish vaqtidan tashqarida (doctor_schedules)',
      );
    }
  }
}

function isOverlapDbError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('appointments_no_overlap') ||
    msg.includes('exclusion') ||
    msg.includes('23P01')
  );
}

export function toAppointmentResponse(a: ApptDetailed): AppointmentResponse {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: a.patient?.fullName ?? null,
    doctorId: a.doctorId,
    serviceId: a.serviceId,
    serviceName: a.service?.name ?? null,
    scheduledAt: a.scheduledAt,
    endsAt: a.endsAt,
    status: a.status,
    notes: a.notes,
    createdAt: a.createdAt,
  };
}
