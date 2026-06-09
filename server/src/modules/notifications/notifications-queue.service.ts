import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { NotificationConfig } from '../../config/configuration';
import {
  NOTIFICATIONS_QUEUE,
  NotificationChannel,
  NotificationJob,
  NotificationKind,
} from './constants/notification.constant';

const SEND = 'send';
const DEFAULT_OPTS = {
  removeOnComplete: true,
  removeOnFail: 100,
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 10_000 },
};

export interface ReminderAppt {
  id: string;
  clinicId: string;
  scheduledAt: Date;
}

/**
 * Bildirishnomalarni BullMQ navbatiga qo'shadi (rate-limit + retry). Boshqa
 * modullar (appointments, cashier, EMR) @Optional inject qilib chaqiradi —
 * navbat bo'lmasa (test) jim o'tkazib yuboriladi.
 */
@Injectable()
export class NotificationsQueueService {
  private readonly leadMin: number;

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    config: ConfigService,
  ) {
    this.leadMin =
      config.getOrThrow<NotificationConfig>('notification').reminderLeadMinutes;
  }

  async enqueue(job: NotificationJob, delayMs = 0): Promise<void> {
    await this.queue.add(SEND, job, {
      ...DEFAULT_OPTS,
      delay: delayMs > 0 ? delayMs : undefined,
      // BullMQ jobId ichida ':' BO'LMASLIGI kerak -> '-' ishlatamiz (idempotent).
      jobId: `${job.kind}-${job.refId}`,
    });
  }

  /** Qabul yaratilganda: eslatma (kechiktirilgan) + shifokorga (darhol). */
  async onAppointmentCreated(appt: ReminderAppt): Promise<void> {
    const delay =
      appt.scheduledAt.getTime() - this.leadMin * 60_000 - Date.now();
    await this.enqueue(
      {
        clinicId: appt.clinicId,
        kind: NotificationKind.APPOINTMENT_REMINDER,
        refId: appt.id,
        channel: NotificationChannel.BOTH,
      },
      delay,
    );
    await this.enqueue({
      clinicId: appt.clinicId,
      kind: NotificationKind.DOCTOR_NEW_APPOINTMENT,
      refId: appt.id,
      channel: NotificationChannel.BOTH,
    });
  }

  async onAppointmentCancelled(appt: ReminderAppt): Promise<void> {
    await this.enqueue({
      clinicId: appt.clinicId,
      kind: NotificationKind.APPOINTMENT_CANCELLED,
      refId: appt.id,
      channel: NotificationChannel.BOTH,
    });
  }

  async notifyDebt(clinicId: string, invoiceId: string): Promise<void> {
    await this.enqueue({
      clinicId,
      kind: NotificationKind.DEBT_REMINDER,
      refId: invoiceId,
      channel: NotificationChannel.BOTH,
    });
  }

  async notifyResultReady(clinicId: string, patientId: string): Promise<void> {
    await this.enqueue({
      clinicId,
      kind: NotificationKind.RESULT_READY,
      refId: patientId,
      channel: NotificationChannel.BOTH,
    });
  }
}
