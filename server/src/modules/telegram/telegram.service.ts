import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Telegraf } from 'telegraf';
import type { Update } from 'telegraf/types';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { runWithTenant } from '../../core/tenant/tenant-context';
import { TelegramConfig } from '../../config/configuration';
import { NotificationOwnerType } from '../notifications/constants/notification.constant';
import { TelegramLinkService } from './telegram-link.service';

const UNSETTLED = ['UNPAID', 'PARTIAL', 'OVERDUE'];
const ACTIVE_APPT = ['PENDING', 'ARRIVED', 'IN_PROGRESS'];

/**
 * Markaziy Telegram bot (spec 12) — barcha klinikalarga xizmat qiladi.
 * Production: webhook (secret), dev: polling. Token bo'lmasa ishga tushmaydi.
 * MAXFIYLIK: tibbiy tafsilot YO'Q — faqat qabul vaqti/holati, qarz, havola.
 * Komanda mantig'i alohida build*Message metodlarida (testlanadi).
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Telegram');
  private readonly cfg: TelegramConfig;
  private bot: Telegraf | null = null;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    config: ConfigService,
    private readonly links: TelegramLinkService,
  ) {
    this.cfg = config.getOrThrow<TelegramConfig>('telegram');
    if (this.cfg.botToken) {
      this.bot = new Telegraf(this.cfg.botToken);
      this.registerHandlers(this.bot);
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.bot) {
      this.logger.warn('TELEGRAM_BOT_TOKEN yo`q — bot o`chiq (dev).');
      return;
    }
    try {
      if (this.cfg.webhookDomain) {
        const url = `${this.cfg.webhookDomain.replace(/\/$/, '')}/api/v1/telegram/webhook`;
        await this.bot.telegram.setWebhook(url, {
          secret_token: this.cfg.webhookSecret || undefined,
        });
        this.logger.log(`Telegram webhook o'rnatildi: ${url}`);
      } else {
        // Dev: polling (fire-and-forget)
        void this.bot.launch();
        this.logger.log('Telegram bot polling rejimida ishga tushdi');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Telegram bot ishga tushmadi: ${msg}`);
    }
  }

  onModuleDestroy(): void {
    this.bot?.stop('SIGTERM');
  }

  /** Webhook'dan kelgan update (controller chaqiradi). */
  async handleUpdate(update: Update): Promise<void> {
    if (this.bot) await this.bot.handleUpdate(update);
  }

  /** Chat'ga xabar yuboradi (NotificationsService dispatch chaqiradi). */
  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.bot) {
      this.logger.log(`[TG->${chatId}] ${text}`);
      return false;
    }
    try {
      await this.bot.telegram.sendMessage(chatId, text);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Telegram yuborish xatosi (${chatId}): ${msg}`);
      throw err; // BullMQ retry
    }
  }

  // ---- Bot komandalari mantig'i (testlanadigan) ----

  async buildAppointmentsMessage(chatId: string): Promise<string> {
    const links = await this.patientLinks(chatId);
    if (links.length === 0) return this.notLinkedText();

    const lines: string[] = ['📅 Yaqin qabullaringiz:'];
    let found = 0;
    for (const link of links) {
      const appts = await this.runScoped(link.clinicId, () =>
        this.prisma.appointment.findMany({
          where: {
            clinicId: link.clinicId,
            patientId: link.ownerId,
            deletedAt: null,
            status: { in: ACTIVE_APPT },
            scheduledAt: { gte: new Date() },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 5,
          include: { service: { select: { name: true } } },
        }),
      );
      for (const a of appts) {
        lines.push(
          `• ${this.fmt(a.scheduledAt)} — ${a.service?.name ?? 'Qabul'} (${a.status})`,
        );
        found++;
      }
    }
    if (found === 0) lines.push('(yaqin qabul yo`q)');
    return lines.join('\n');
  }

  async buildDebtMessage(chatId: string): Promise<string> {
    const links = await this.patientLinks(chatId);
    if (links.length === 0) return this.notLinkedText();

    let total = new Prisma.Decimal(0);
    for (const link of links) {
      const agg = await this.runScoped(link.clinicId, () =>
        this.prisma.patientInvoice.aggregate({
          where: {
            clinicId: link.clinicId,
            patientId: link.ownerId,
            deletedAt: null,
            status: { in: UNSETTLED },
          },
          _sum: { debtAmount: true },
        }),
      );
      total = total.plus(agg._sum.debtAmount ?? new Prisma.Decimal(0));
    }
    return total.greaterThan(0)
      ? `💳 Joriy qarzingiz: ${total.toString()} so'm.`
      : '✅ Qarzingiz yo`q.';
  }

  async buildContactMessage(chatId: string): Promise<string> {
    const links = await this.links.findLinksByChatId(chatId);
    if (links.length === 0) return this.notLinkedText();
    const link = links[0];
    const clinic = await this.runScoped(link.clinicId, () =>
      this.prisma.clinic.findFirst({ where: { id: link.clinicId } }),
    );
    if (!clinic) return 'Klinika topilmadi.';
    return (
      `🏥 ${clinic.name}` +
      (clinic.phone ? `\n📞 ${clinic.phone}` : '') +
      (clinic.address ? `\n📍 ${clinic.address}` : '')
    );
  }

  async buildTodayMessage(chatId: string): Promise<string> {
    const links = (await this.links.findLinksByChatId(chatId)).filter(
      (l) => l.ownerType === NotificationOwnerType.USER,
    );
    if (links.length === 0) return 'Siz shifokor sifatida bog`lanmagansiz.';

    const now = new Date();
    const dayEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const lines: string[] = ['🗓 Bugungi/yaqin qabullaringiz:'];
    let found = 0;
    for (const link of links) {
      const appts = await this.runScoped(link.clinicId, () =>
        this.prisma.appointment.findMany({
          where: {
            clinicId: link.clinicId,
            doctorId: link.ownerId,
            deletedAt: null,
            status: { in: ACTIVE_APPT },
            scheduledAt: { gte: now, lt: dayEnd },
          },
          orderBy: { scheduledAt: 'asc' },
          include: { patient: { select: { fullName: true } } },
        }),
      );
      for (const a of appts) {
        lines.push(
          `• ${this.fmt(a.scheduledAt)} — ${a.patient?.fullName ?? 'Bemor'} (${a.status})`,
        );
        found++;
      }
    }
    if (found === 0) lines.push('(qabul yo`q)');
    return lines.join('\n');
  }

  // ---- private ----

  private registerHandlers(bot: Telegraf): void {
    bot.start(async (ctx) => {
      const payload = (ctx as { startPayload?: string }).startPayload ?? '';
      const chatId = String(ctx.chat.id);
      if (payload) {
        const link = await this.links.confirmLink(payload, chatId);
        await ctx.reply(
          link
            ? '✅ Akkaunt muvaffaqiyatli bog`landi. /qabullar, /qarz, /kontakt'
            : '❌ Havola noto`g`ri yoki eskirgan.',
        );
      } else {
        await ctx.reply(
          'Salom! Klinika CRM boti. Bog`lash uchun klinikadan olingan havolani bosing.',
        );
      }
    });
    bot.command('qabullar', async (ctx) =>
      ctx.reply(await this.buildAppointmentsMessage(String(ctx.chat.id))),
    );
    bot.command('qarz', async (ctx) =>
      ctx.reply(await this.buildDebtMessage(String(ctx.chat.id))),
    );
    bot.command('kontakt', async (ctx) =>
      ctx.reply(await this.buildContactMessage(String(ctx.chat.id))),
    );
    bot.command('bugun', async (ctx) =>
      ctx.reply(await this.buildTodayMessage(String(ctx.chat.id))),
    );
  }

  private async patientLinks(chatId: string) {
    const links = await this.links.findLinksByChatId(chatId);
    return links.filter((l) => l.ownerType === NotificationOwnerType.PATIENT);
  }

  private runScoped<T>(clinicId: string, fn: () => Promise<T>): Promise<T> {
    return runWithTenant(
      { requestId: `tg-${clinicId}`, bypassTenant: true },
      fn,
    );
  }

  private notLinkedText(): string {
    return 'Akkaunt bog`lanmagan. Klinikadan bog`lash havolasini oling.';
  }

  /** UTC -> mahalliy "DD.MM HH:MM" (Asia/Tashkent UTC+5). */
  private fmt(date: Date): string {
    const local = new Date(date.getTime() + 300 * 60_000);
    const dd = String(local.getUTCDate()).padStart(2, '0');
    const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
    const hh = String(local.getUTCHours()).padStart(2, '0');
    const mi = String(local.getUTCMinutes()).padStart(2, '0');
    return `${dd}.${mm} ${hh}:${mi}`;
  }
}
