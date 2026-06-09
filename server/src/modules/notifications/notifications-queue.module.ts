import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from './notifications.module';
import { NOTIFICATIONS_QUEUE } from './constants/notification.constant';
import { NotificationsQueueService } from './notifications-queue.service';
import { NotificationsProcessor } from './notifications.processor';

/**
 * Bildirishnoma navbati (BullMQ) — @Global, FAQAT test bo'lmagan muhitda yuklanadi.
 * AppointmentsService/Cashier @Optional NotificationsQueueService inject qiladi.
 * BullMQ ulanishi global QueueModule orqali.
 */
@Global()
@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  providers: [NotificationsProcessor, NotificationsQueueService],
  exports: [NotificationsQueueService],
})
export class NotificationsQueueModule {}
