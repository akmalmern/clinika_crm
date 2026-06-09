import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { Update } from 'telegraf/types';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActorType } from '../../common/constants/roles.constant';
import { TelegramConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { GenerateLinkDto } from './dto/generate-link.dto';

/**
 * Telegram: webhook (markaziy bot) + bog'lash havolasini yaratish.
 *  - Webhook @Public + secret token (X-Telegram-Bot-Api-Secret-Token) bilan himoyalangan.
 *  - Link yaratish — klinika foydalanuvchisi (tenant izolyatsiya).
 */
@ApiTags('telegram')
@Controller()
export class TelegramController {
  private readonly cfg: TelegramConfig;

  constructor(
    private readonly telegram: TelegramService,
    private readonly links: TelegramLinkService,
    config: ConfigService,
  ) {
    this.cfg = config.getOrThrow<TelegramConfig>('telegram');
  }

  @Post('telegram/webhook')
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Update,
    @Res() res: Response,
  ): Promise<void> {
    // Secret sozlangan bo'lsa — tekshiramiz (faqat Telegram'dan).
    if (this.cfg.webhookSecret && secret !== this.cfg.webhookSecret) {
      res.status(403).end();
      return;
    }
    try {
      await this.telegram.handleUpdate(update);
    } catch {
      // Bot xatosi webhook javobini buzmasin (Telegram 200 kutadi).
    }
    res.status(200).end();
  }

  @Post('clinic/telegram/link')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Telegram bog`lash havolasini yaratish (bemor/xodim)',
  })
  generateLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateLinkDto,
  ) {
    if (user.actorType !== ActorType.USER || !user.clinicId) {
      throw new ForbiddenException(
        'Bu endpoint faqat klinika foydalanuvchilari uchun',
      );
    }
    return this.links.generateLink(user.clinicId, dto.ownerType, dto.ownerId);
  }
}
