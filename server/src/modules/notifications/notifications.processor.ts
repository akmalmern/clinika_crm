import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';
import {
  NOTIFICATIONS_QUEUE,
  NotificationJob,
} from './constants/notification.constant';

/**
 * BullMQ worker — bildirishnomalarni yuboradi. Mantiq NotificationsService'da.
 * Xato bo'lsa BullMQ qayta uradi (attempts + backoff).
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger('NotificationsProcessor');

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    await this.notifications.dispatch(job.data);
    this.logger.log(`Yuborildi: ${job.data.kind} (${job.data.refId})`);
  }
}
