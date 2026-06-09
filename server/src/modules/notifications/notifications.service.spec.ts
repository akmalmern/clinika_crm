import { NotificationsService } from './notifications.service';
import { NotificationKind } from './constants/notification.constant';

/**
 * NotificationsService.dispatch (DB'siz, mock). DoD: SMS yuboriladi; Telegram
 * FAQAT LINKED chat'ga (tasdiqlanmaganga emas).
 */
describe('NotificationsService.dispatch', () => {
  function build(linkedChat: string | null) {
    const prisma = {
      clinic: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cl1',
          name: 'Demo',
          phone: '+998901112233',
          address: 'Tashkent',
        }),
      },
      appointment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'a1',
          clinicId: 'cl1',
          patientId: 'p1',
          doctorId: 'd1',
          scheduledAt: new Date('2027-06-10T04:00:00Z'),
          patient: { id: 'p1', fullName: 'Bemor', phone: '+998901234567' },
          service: { name: 'Konsultatsiya' },
        }),
      },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ fullName: 'Dr House', phone: '+998900000000' }),
      },
    };
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'scheduling'
          ? { tzOffsetMinutes: 300 }
          : { appBaseUrl: 'http://app' },
      ),
    };
    const sms = { send: jest.fn().mockResolvedValue({ ok: true }) };
    const telegram = { sendMessage: jest.fn().mockResolvedValue(true) };
    const links = {
      findLinkedChat: jest.fn().mockResolvedValue(linkedChat),
    };
    const service = new NotificationsService(
      prisma as never,
      config as never,
      sms as never,
      telegram as never,
      links as never,
    );
    return { service, sms, telegram, links };
  }

  it('LINKED chat bor: SMS + Telegram yuboriladi', async () => {
    const { service, sms, telegram } = build('chat123');
    await service.dispatch({
      clinicId: 'cl1',
      kind: NotificationKind.APPOINTMENT_REMINDER,
      refId: 'a1',
    });
    expect(sms.send).toHaveBeenCalledWith(
      '+998901234567',
      expect.stringContaining('09:00'),
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      'chat123',
      expect.any(String),
    );
  });

  it('LINKED chat YO`Q (tasdiqlanmagan): Telegram YUBORILMAYDI, SMS boradi', async () => {
    const { service, sms, telegram } = build(null);
    await service.dispatch({
      clinicId: 'cl1',
      kind: NotificationKind.APPOINTMENT_REMINDER,
      refId: 'a1',
    });
    expect(sms.send).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });
});
