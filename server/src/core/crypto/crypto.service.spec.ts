import { CryptoService } from './crypto.service';

const K1 = Buffer.alloc(32, 7).toString('base64');
const K2 = Buffer.alloc(32, 9).toString('base64');

function svc(opts: {
  key?: string;
  keyId?: string;
  old?: string;
}): CryptoService {
  const config = {
    getOrThrow: () => ({
      fieldKey: opts.key,
      fieldKeyId: opts.keyId ?? 'k1',
      fieldKeysOld: opts.old,
    }),
  };
  return new CryptoService(config as never);
}

describe('CryptoService (AES-256-GCM)', () => {
  it('roundtrip: encrypt -> decrypt asl matnni qaytaradi', () => {
    const s = svc({ key: K1 });
    expect(s.enabled).toBe(true);
    const plain = 'Tashxis: J06.9 — pasport AA1234567';
    const token = s.encrypt(plain);
    expect(token.startsWith('enc:k1:')).toBe(true);
    expect(token).not.toContain(plain); // DB'da ochiq matn yo'q
    expect(s.decrypt(token)).toBe(plain);
  });

  it('har shifrlash NOYOB (random IV) — bir xil matn -> har xil token', () => {
    const s = svc({ key: K1 });
    expect(s.encrypt('x')).not.toBe(s.encrypt('x'));
  });

  it('isEncrypted: token true, ochiq matn false', () => {
    const s = svc({ key: K1 });
    expect(s.isEncrypted(s.encrypt('a'))).toBe(true);
    expect(s.isEncrypted('oddiy matn')).toBe(false);
    expect(s.isEncrypted(123)).toBe(false);
  });

  it('decrypt ochiq matnni o`zgartirmaydi (backward-compat / backfill)', () => {
    const s = svc({ key: K1 });
    expect(s.decrypt('hali shifrlanmagan')).toBe('hali shifrlanmagan');
  });

  it('kalit yo`q -> shifrlash O`CHIQ (passthrough)', () => {
    const s = svc({ key: undefined });
    expect(s.enabled).toBe(false);
    expect(s.encrypt('a')).toBe('a');
    expect(s.decrypt('a')).toBe('a');
  });

  it('kalit ROTATSIYASI: eski kalit bilan shifrlangan token yangi keyring`da o`qiladi', () => {
    const oldSvc = svc({ key: K1, keyId: 'k1' });
    const token = oldSvc.encrypt('eski yozuv');

    // Yangi primary k2, lekin eski k1 keyring`da (deshifrlash uchun).
    const newSvc = svc({ key: K2, keyId: 'k2', old: `k1:${K1}` });
    expect(newSvc.decrypt(token)).toBe('eski yozuv'); // eski token o'qiladi
    expect(newSvc.encrypt('yangi').startsWith('enc:k2:')).toBe(true); // yangi -> k2
  });

  it('noma`lum kalit -> xato (sukut saqlamaydi)', () => {
    const token = svc({ key: K1, keyId: 'k1' }).encrypt('a');
    const other = svc({ key: K2, keyId: 'k2' }); // k1 yo'q
    expect(() => other.decrypt(token)).toThrow();
  });

  it('blindIndex: bir xil qiymat -> bir xil hash (qidiruv uchun)', () => {
    const s = svc({ key: K1 });
    expect(s.blindIndex('+998901234567')).toBe(s.blindIndex('+998901234567'));
    expect(s.blindIndex('+998901234567')).not.toBe(
      s.blindIndex('+998900000000'),
    );
  });
});
