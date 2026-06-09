import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { SmsService } from './sms/sms.service';
import { NotificationsService } from './notifications.service';

/**
 * Bildirishnoma yadrosi (BullMQ'siz — test'da ham yuklanadi). Yuborish mantig'i
 * (dispatch) + SMS provayder. Navbat (enqueue/processor) alohida gated modulda.
 */
@Module({
  imports: [TelegramModule],
  providers: [SmsService, NotificationsService],
  exports: [NotificationsService, SmsService],
})
export class NotificationsModule {}
