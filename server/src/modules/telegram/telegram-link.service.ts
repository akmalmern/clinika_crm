import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { runWithTenant } from '../../core/tenant/tenant-context';
import { TelegramConfig } from '../../config/configuration';
import { ActorType } from '../../common/constants/roles.constant';
import {
  NotificationOwnerType,
  TelegramLinkStatus,
} from '../notifications/constants/notification.constant';

type LinkRow = Prisma.TelegramLinkGetPayload<object>;

export interface GenerateLinkResult {
  token: string;
  deepLink: string;
  status: string;
}

/**
 * Telegram akkaunt bog'lash (spec 12). Bir martalik token -> /start <token> ->
 * telegram_chat_id bog'lanadi. FAQAT status=LINKED chat'ga xabar yuboriladi.
 */
@Injectable()
export class TelegramLinkService {
  private readonly cfg: TelegramConfig;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    config: ConfigService,
  ) {
    this.cfg = config.getOrThrow<TelegramConfig>('telegram');
  }

  /** Bemor/xodim uchun bog'lash havolasi (PENDING link + deep-link). */
  async generateLink(
    clinicId: string,
    ownerType: string,
    ownerId: string,
  ): Promise<GenerateLinkResult> {
    await this.assertOwner(clinicId, ownerType, ownerId);
    const token = randomBytes(16).toString('hex');

    await this.prisma.telegramLink.create({
      data: {
        clinicId,
        ownerType,
        ownerId,
        linkToken: token,
        status: TelegramLinkStatus.PENDING,
      },
    });

    const username = this.cfg.botUsername || 'your_bot';
    return {
      token,
      deepLink: `https://t.me/${username}?start=${token}`,
      status: TelegramLinkStatus.PENDING,
    };
  }

  /**
   * /start <token> kelganda chat'ni bog'laydi. Bot kontekstida (request store yo'q)
   * chaqiriladi -> bypassTenant. Eski LINKED bog'lanish almashtiriladi.
   */
  async confirmLink(token: string, chatId: string): Promise<LinkRow | null> {
    return runWithTenant(
      {
        requestId: `tg-link-${token}`,
        bypassTenant: true,
        actorType: ActorType.SYSTEM,
      },
      async () => {
        const pending = await this.prisma.telegramLink.findFirst({
          where: { linkToken: token, deletedAt: null },
        });
        if (!pending) return null;
        if (pending.status === TelegramLinkStatus.LINKED) return pending;

        return this.prisma.$transaction(async (tx) => {
          // Shu owner uchun avvalgi LINKED'ni bo'shatamiz (partial unique uchun)
          await tx.telegramLink.updateMany({
            where: {
              clinicId: pending.clinicId,
              ownerType: pending.ownerType,
              ownerId: pending.ownerId,
              status: TelegramLinkStatus.LINKED,
              deletedAt: null,
            },
            data: { deletedAt: new Date() },
          });
          return tx.telegramLink.update({
            where: { id: pending.id },
            data: {
              telegramChatId: chatId,
              status: TelegramLinkStatus.LINKED,
              linkedAt: new Date(),
            },
          });
        });
      },
    );
  }

  /** Owner uchun LINKED chat_id (yo'q bo'lsa null) — xabar yuborishda. */
  async findLinkedChat(
    clinicId: string,
    ownerType: string,
    ownerId: string,
  ): Promise<string | null> {
    const link = await this.prisma.telegramLink.findFirst({
      where: {
        clinicId,
        ownerType,
        ownerId,
        status: TelegramLinkStatus.LINKED,
        deletedAt: null,
      },
    });
    return link?.telegramChatId ?? null;
  }

  /** Chat'ga bog'langan barcha LINKED yozuvlar (bot komandalari uchun). */
  async findLinksByChatId(chatId: string): Promise<LinkRow[]> {
    return runWithTenant(
      { requestId: `tg-chat-${chatId}`, bypassTenant: true },
      async () =>
        this.prisma.telegramLink.findMany({
          where: {
            telegramChatId: chatId,
            status: TelegramLinkStatus.LINKED,
            deletedAt: null,
          },
          orderBy: { linkedAt: 'desc' },
        }),
    );
  }

  private async assertOwner(
    clinicId: string,
    ownerType: string,
    ownerId: string,
  ): Promise<void> {
    if (ownerType === NotificationOwnerType.PATIENT) {
      const p = await this.prisma.patient.findFirst({
        where: { id: ownerId, clinicId, deletedAt: null },
      });
      if (!p) throw new BadRequestException('Bemor topilmadi');
    } else if (ownerType === NotificationOwnerType.USER) {
      const m = await this.prisma.clinicMember.findFirst({
        where: { clinicId, userId: ownerId, deletedAt: null },
      });
      if (!m) throw new BadRequestException('Xodim topilmadi');
    } else {
      throw new BadRequestException('owner_type noto`g`ri');
    }
  }
}
