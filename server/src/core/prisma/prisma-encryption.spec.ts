import {
  decryptRow,
  encryptWriteData,
  ENCRYPTED_FIELDS,
  type FieldCipher,
} from './prisma-extensions';

/**
 * Shaffof shifrlash mantig'i (DB'siz, soxta cipher). Faqat sozlangan nozik
 * maydonlar shifrlanadi; ochiq qiymat va boshqa maydonlar tegilmaydi.
 */
const fake: FieldCipher = {
  enabled: true,
  encrypt: (p) => `enc:test:${p}`,
  decrypt: (v) => v.replace(/^enc:test:/, ''),
  isEncrypted: (v): v is string =>
    typeof v === 'string' && v.startsWith('enc:test:'),
};

describe('Prisma maydon shifrlash', () => {
  it('ENCRYPTED_FIELDS — kutilgan nozik maydonlar', () => {
    expect(ENCRYPTED_FIELDS.MedicalRecord).toEqual(
      expect.arrayContaining(['diagnosis', 'complaints', 'treatment', 'notes']),
    );
    expect(ENCRYPTED_FIELDS.Patient).toEqual(
      expect.arrayContaining(['allergies', 'address', 'notes']),
    );
  });

  it('encryptWriteData faqat nozik maydonlarni shifrlaydi', () => {
    const data: Record<string, unknown> = {
      patientId: 'p1',
      diagnosis: 'J06.9',
      complaints: 'yo`tal',
      icdCode: 'J06.9', // shifrlanmaydi (ENCRYPTED_FIELDS'da yo'q)
    };
    encryptWriteData('MedicalRecord', data, fake);
    expect(data.diagnosis).toBe('enc:test:J06.9');
    expect(data.complaints).toBe('enc:test:yo`tal');
    expect(data.icdCode).toBe('J06.9'); // tegilmagan
    expect(data.patientId).toBe('p1');
  });

  it('encryptWriteData ikki marta shifrlamaydi (idempotent)', () => {
    const data: Record<string, unknown> = { diagnosis: 'enc:test:J06.9' };
    encryptWriteData('MedicalRecord', data, fake);
    expect(data.diagnosis).toBe('enc:test:J06.9'); // qayta shifrlanmadi
  });

  it('encryptWriteData null/undefined`ni tegmaydi', () => {
    const data: Record<string, unknown> = { diagnosis: null, notes: undefined };
    encryptWriteData('MedicalRecord', data, fake);
    expect(data.diagnosis).toBeNull();
  });

  it('decryptRow nozik maydonlarni deshifrlaydi', () => {
    const row: Record<string, unknown> = {
      id: 'r1',
      diagnosis: 'enc:test:J06.9',
      icdCode: 'J06.9',
      complaints: 'oddiy', // shifrlanmagan (eski) -> tegilmaydi
    };
    decryptRow('MedicalRecord', row, fake);
    expect(row.diagnosis).toBe('J06.9');
    expect(row.icdCode).toBe('J06.9');
    expect(row.complaints).toBe('oddiy');
  });

  it('Patient: address/allergies shifrlanadi va o`qiladi', () => {
    const data: Record<string, unknown> = {
      fullName: 'Aliyev', // shifrlanmaydi (qidiriladi)
      address: 'Toshkent',
      allergies: 'penisillin',
    };
    encryptWriteData('Patient', data, fake);
    expect(data.fullName).toBe('Aliyev');
    expect(data.address).toBe('enc:test:Toshkent');
    decryptRow('Patient', data, fake);
    expect(data.address).toBe('Toshkent');
    expect(data.allergies).toBe('penisillin');
  });
});
