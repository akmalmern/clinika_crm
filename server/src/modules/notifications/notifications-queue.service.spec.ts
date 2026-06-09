import { NotificationsQueueService } from './notifications-queue.service';
import { NotificationKind } from './constants/notification.constant';

/**
 * NotificationsQueueService (DB'siz, mock queue). DoD: qabul yaratilganda eslatma
 * (bemorga, kechiktirilgan) + yangi qabul (shifokorga) navbatga tushadi.
 */
describe('NotificationsQueueService', () => {
  function build() {
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ reminderLeadMinutes: 60 }),
    };
    const service = new NotificationsQueueService(
      queue as never,
      config as never,
    );
    return { service, queue };
  }

  it('onAppointmentCreated: 2 ta job (eslatma + shifokor)', async () => {
    const { service, queue } = build();
    const scheduledAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 soatdan keyin
    await service.onAppointmentCreated({
      id: 'a1',
      clinicId: 'cl1',
      scheduledAt,
    });

    expect(queue.add).toHaveBeenCalledTimes(2);
    const kinds = queue.add.mock.calls.map(
      (c: unknown[]) => (c[1] as { kind: string }).kind,
    );
    expect(kinds).toContain(NotificationKind.APPOINTMENT_REMINDER);
    expect(kinds).toContain(NotificationKind.DOCTOR_NEW_APPOINTMENT);

    // Eslatma kechiktirilgan (delay > 0), 60 daqiqa oldin
    const reminderCall = queue.add.mock.calls.find(
      (c: unknown[]) =>
        (c[1] as { kind: string }).kind ===
        NotificationKind.APPOINTMENT_REMINDER,
    );
    const opts = reminderCall[2] as { delay?: number };
    expect(opts.delay).toBeGreaterThan(0);
  });

  it('notifyDebt: DEBT_REMINDER navbatga', async () => {
    const { service, queue } = build();
    await service.notifyDebt('cl1', 'inv1');
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect((queue.add.mock.calls[0][1] as { kind: string }).kind).toBe(
      NotificationKind.DEBT_REMINDER,
    );
  });
});
