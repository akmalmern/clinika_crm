import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { runWithTenant } from '../../core/tenant/tenant-context';
import { SchedulingConfig, TelegramConfig } from '../../config/configuration';
import { SmsService } from './sms/sms.service';
import { TelegramService } from '../telegram/telegram.service';
import { TelegramLinkService } from '../telegram/telegram-link.service';
import {
  NotificationChannel,
  NotificationJob,
  NotificationKind,
  NotificationOwnerType,
} from './constants/notification.constant';
import { buildMessage, TemplateData } from './notification-templates';

const PATIENT_KINDS: string[] = [
  NotificationKind.APPOINTMENT_REMINDER,
  NotificationKind.APPOINTMENT_CONFIRM,
  NotificationKind.APPOINTMENT_CANCELLED,
  NotificationKind.DEBT_REMINDER,
  NotificationKind.RESULT_READY,
];

/**
 * Bildirishnoma yuborish mantig'i (BullMQ processor chaqiradi). Job egasini va
 * matnni aniqlaydi, SMS + Telegram orqali yuboradi. FAQAT LINKED chat'ga Telegram.
 * Tenant izolyatsiya: hamma so'rov job.clinicId bo'yicha (bypassTenant, store yo'q).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private readonly tzOffset: number;
  private readonly appBaseUrl: string;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    config: ConfigService,
    private readonly sms: SmsService,
    private readonly telegram: TelegramService,
    private readonly links: TelegramLinkService,
  ) {
    this.tzOffset =
      config.getOrThrow<SchedulingConfig>('scheduling').tzOffsetMinutes;
    this.appBaseUrl = config.getOrThrow<TelegramConfig>('telegram').appBaseUrl;
  }

  async dispatch(job: NotificationJob): Promise<void> {
    return runWithTenant(
      { requestId: `notify-${job.refId}`, bypassTenant: true },
      () => this.dispatchInner(job),
    );
  }

  private async dispatchInner(job: NotificationJob): Promise<void> {
    const channel = job.channel ?? NotificationChannel.BOTH;
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: job.clinicId },
    });
    const data: TemplateData = {
      clinicName: clinic?.name,
      clinicPhone: clinic?.phone ?? null,
      clinicAddress: clinic?.address ?? null,
    };

    const isPatient = PATIENT_KINDS.includes(job.kind);
    let ownerType: string;
    let recipientId: string;
    let phone: string | null = null;

    if (job.kind === NotificationKind.DEBT_REMINDER) {
      const inv = await this.prisma.patientInvoice.findFirst({
        where: { id: job.refId, clinicId: job.clinicId },
        include: { patient: { select: { id: true, phone: true } } },
      });
      if (!inv) return;
      ownerType = NotificationOwnerType.PATIENT;
      recipientId = inv.patientId;
      phone = inv.patient?.phone ?? null;
      data.amount = inv.debtAmount.toString();
    } else if (job.kind === NotificationKind.RESULT_READY) {
      const patient = await this.prisma.patient.findFirst({
        where: { id: job.refId, clinicId: job.clinicId },
      });
      if (!patient) return;
      ownerType = NotificationOwnerType.PATIENT;
      recipientId = patient.id;
      phone = patient.phone;
      data.appLink = this.appBaseUrl;
    } else {
      // Qabulga bog'liq turlar
      const appt = await this.prisma.appointment.findFirst({
        where: { id: job.refId, clinicId: job.clinicId },
        include: {
          patient: { select: { id: true, fullName: true, phone: true } },
          service: { select: { name: true } },
        },
      });
      if (!appt) return;
      data.when = this.fmt(appt.scheduledAt);
      const doctor = await this.prisma.user.findFirst({
        where: { id: appt.doctorId },
        select: { fullName: true, phone: true },
      });
      data.doctorName = doctor?.fullName ?? null;
      data.patientName = appt.patient?.fullName ?? null;

      if (isPatient) {
        ownerType = NotificationOwnerType.PATIENT;
        recipientId = appt.patientId;
        phone = appt.patient?.phone ?? null;
      } else {
        ownerType = NotificationOwnerType.USER;
        recipientId = appt.doctorId;
        phone = doctor?.phone ?? null;
      }
    }

    const text = buildMessage(job.kind, data);
    await this.deliver(
      job.clinicId,
      ownerType,
      recipientId,
      phone,
      text,
      channel,
    );
  }

  /** SMS (telefon bo'lsa) + Telegram (FAQAT LINKED chat). */
  private async deliver(
    clinicId: string,
    ownerType: string,
    recipientId: string,
    phone: string | null,
    text: string,
    channel: string,
  ): Promise<void> {
    if (
      (channel === NotificationChannel.SMS ||
        channel === NotificationChannel.BOTH) &&
      phone
    ) {
      const r = await this.sms.send(phone, text);
      if (!r.ok) this.logger.warn(`SMS yuborilmadi: ${r.error}`);
    }

    if (
      channel === NotificationChannel.TELEGRAM ||
      channel === NotificationChannel.BOTH
    ) {
      const chatId = await this.links.findLinkedChat(
        clinicId,
        ownerType,
        recipientId,
      );
      if (chatId) {
        await this.telegram.sendMessage(chatId, text);
      } else {
        this.logger.debug(
          `Telegram o'tkazib yuborildi (LINKED chat yo'q): ${ownerType}/${recipientId}`,
        );
      }
    }
  }

  private fmt(date: Date): string {
    const local = new Date(date.getTime() + this.tzOffset * 60_000);
    const dd = String(local.getUTCDate()).padStart(2, '0');
    const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
    const hh = String(local.getUTCHours()).padStart(2, '0');
    const mi = String(local.getUTCMinutes()).padStart(2, '0');
    return `${dd}.${mm} ${hh}:${mi}`;
  }
}
