import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';

/**
 * Telegram bot moduli (Phase 7A). Markaziy bot — token bo'lsa ishga tushadi
 * (dev'da polling, prod'da webhook). NotificationsModule sender uchun foydalanadi.
 * Test muhitida token yo'q -> bot ishga tushmaydi (xavfsiz).
 */
@Module({
  controllers: [TelegramController],
  providers: [TelegramService, TelegramLinkService],
  exports: [TelegramService, TelegramLinkService],
})
export class TelegramModule {}
