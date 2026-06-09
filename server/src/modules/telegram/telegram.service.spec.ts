import { Prisma } from '@prisma/client';
import { TelegramService } from './telegram.service';

/**
 * TelegramService bot komandalari (DB'siz, mock). DoD: bemor qabulini va qarzini
 * ko'radi. Token bo'sh -> bot ishga tushmaydi (xavfsiz). MAXFIY: tibbiy yo'q.
 */
describe('TelegramService bot commands', () => {
  function build(
    prisma: Record<string, unknown>,
    links: Record<string, unknown>,
  ) {
    const config = {
      getOrThrow: jest
        .fn()
        .mockReturnValue({ botToken: '', botUsername: 'demo_bot' }),
    };
    return new TelegramService(
      prisma as never,
      config as never,
      links as never,
    );
  }

  it('buildAppointmentsMessage: bemor qabullarini ko`rsatadi', async () => {
    const links = {
      findLinksByChatId: jest
        .fn()
        .mockResolvedValue([
          { clinicId: 'cl1', ownerType: 'PATIENT', ownerId: 'p1' },
        ]),
    };
    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            scheduledAt: new Date('2027-06-10T04:00:00Z'),
            status: 'PENDING',
            service: { name: 'Konsultatsiya' },
          },
        ]),
      },
    };
    const service = build(prisma, links);
    const msg = await service.buildAppointmentsMessage('chat1');
    expect(msg).toContain('Konsultatsiya');
    expect(msg).toContain('PENDING');
    expect(msg).toContain('09:00'); // mahalliy (UTC+5)
  });

  it('buildDebtMessage: qarz summasi', async () => {
    const links = {
      findLinksByChatId: jest
        .fn()
        .mockResolvedValue([
          { clinicId: 'cl1', ownerType: 'PATIENT', ownerId: 'p1' },
        ]),
    };
    const prisma = {
      patientInvoice: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { debtAmount: new Prisma.Decimal('150000') },
        }),
      },
    };
    const service = build(prisma, links);
    const msg = await service.buildDebtMessage('chat1');
    expect(msg).toContain('150000');
  });

  it('bog`lanmagan chat -> ko`rsatma', async () => {
    const links = { findLinksByChatId: jest.fn().mockResolvedValue([]) };
    const service = build({}, links);
    const msg = await service.buildAppointmentsMessage('chatX');
    expect(msg.toLowerCase()).toContain('bog');
  });
});
