import { buildMessage } from './notification-templates';
import { NotificationKind } from './constants/notification.constant';

/**
 * Shablonlar (sof). DoD: tibbiy tafsilot YO'Q — RESULT_READY faqat havola.
 */
describe('notification-templates', () => {
  it('RESULT_READY: tibbiy mazmun yo`q, faqat havola', () => {
    const msg = buildMessage(NotificationKind.RESULT_READY, {
      clinicName: 'Demo Klinika',
      appLink: 'https://app.example/uz',
    });
    expect(msg).toContain('https://app.example/uz');
    expect(msg.toLowerCase()).toContain('natija');
    // Tibbiy tafsilot kalit so'zlari BO'LMASLIGI kerak
    expect(msg.toLowerCase()).not.toContain('tashxis');
    expect(msg.toLowerCase()).not.toContain('migren');
    expect(msg.toLowerCase()).not.toContain('dori');
    expect(msg.toLowerCase()).not.toContain('icd');
  });

  it('APPOINTMENT_REMINDER: vaqt + shifokor + klinika', () => {
    const msg = buildMessage(NotificationKind.APPOINTMENT_REMINDER, {
      clinicName: 'Demo',
      doctorName: 'Dr House',
      when: '10.06 09:00',
      clinicPhone: '+998901112233',
    });
    expect(msg).toContain('10.06 09:00');
    expect(msg).toContain('Dr House');
    expect(msg).toContain('Demo');
  });

  it('DEBT_REMINDER: summa', () => {
    const msg = buildMessage(NotificationKind.DEBT_REMINDER, {
      clinicName: 'Demo',
      amount: '150000',
    });
    expect(msg).toContain('150000');
  });
});
