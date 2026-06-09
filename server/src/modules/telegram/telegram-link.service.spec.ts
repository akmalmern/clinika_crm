import { TelegramLinkService } from './telegram-link.service';

/**
 * TelegramLinkService (DB'siz, mock). DoD: akkaunt bog'lash (PENDING -> LINKED),
 * noto'g'ri token -> null.
 */
describe('TelegramLinkService', () => {
  function build(prisma: Record<string, unknown>) {
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ botUsername: 'demo_bot' }),
    };
    return new TelegramLinkService(prisma as never, config as never);
  }

  it('confirmLink: PENDING -> LINKED (chat bog`lanadi)', async () => {
    const tx = {
      telegramLink: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({
          id: 'l1',
          status: 'LINKED',
          telegramChatId: 'chat1',
        }),
      },
    };
    const prisma = {
      telegramLink: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'l1',
          clinicId: 'cl1',
          ownerType: 'PATIENT',
          ownerId: 'p1',
          status: 'PENDING',
        }),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(tx),
      ),
    };
    const service = build(prisma);
    const res = await service.confirmLink('tok', 'chat1');
    expect(res?.status).toBe('LINKED');
    const data = tx.telegramLink.update.mock.calls[0][0].data;
    expect(data.status).toBe('LINKED');
    expect(data.telegramChatId).toBe('chat1');
  });

  it('confirmLink: token topilmadi -> null', async () => {
    const prisma = {
      telegramLink: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = build(prisma);
    expect(await service.confirmLink('bad', 'chat1')).toBeNull();
  });

  it('findLinkedChat: LINKED chat qaytadi', async () => {
    const prisma = {
      telegramLink: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ telegramChatId: 'chatX', status: 'LINKED' }),
      },
    };
    const service = build(prisma);
    expect(await service.findLinkedChat('cl1', 'PATIENT', 'p1')).toBe('chatX');
  });
});
