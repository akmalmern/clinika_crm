import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { CryptoConfig } from '../../config/configuration';

const ALG = 'aes-256-gcm';
const IV_LEN = 12; // GCM uchun tavsiya etilgan (96-bit)
const KEY_LEN = 32; // AES-256
const PREFIX = 'enc';

/**
 * Maydon darajasida shifrlash (encryption at rest, spec 9B / 10). AES-256-GCM
 * (autentifikatsiyalangan) — nozik maydonlar (tashxis, shaxsiy ma'lumot) bazada
 * ochiq turmaydi. Token formati:  `enc:<keyId>:<iv>:<tag>:<ciphertext>` (base64).
 *
 * KALIT ROTATSIYASI: joriy kalit bilan shifrlanadi, ammo eski kalitlar bilan ham
 * deshifrlanadi (keyring). Eski ma'lumot yangi kalit bilan qayta shifrlanmasdan
 * o'qiladi; rotatsiyada backfill skripti qayta yozadi.
 *
 * BACKWARD-COMPAT: `decrypt` token bo'lmagan (ochiq) qiymatni o'zgartirmasdan
 * qaytaradi — shu sababli backfill jarayoni davomida ham ilova to'g'ri o'qiydi
 * (expand-contract xavfsizligi). Kalit berilmasa shifrlash O'CHIQ (dev) —
 * qiymatlar ochiq saqlanadi.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger('Crypto');
  /** keyId -> 32-baytli kalit. Birinchisi (primary) yangi shifrlash uchun. */
  private readonly keyring = new Map<string, Buffer>();
  private readonly primaryKeyId: string;
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<CryptoConfig>('crypto');
    this.primaryKeyId = cfg.fieldKeyId;

    if (cfg.fieldKey) {
      this.keyring.set(
        this.primaryKeyId,
        this.parseKey(cfg.fieldKey, this.primaryKeyId),
      );
    }
    // Eski kalitlar (rotatsiya): "id1:base64,id2:base64"
    if (cfg.fieldKeysOld) {
      for (const pair of cfg.fieldKeysOld.split(',')) {
        const [id, b64] = pair.split(':');
        if (id && b64)
          this.keyring.set(id.trim(), this.parseKey(b64.trim(), id.trim()));
      }
    }

    this.enabled = this.keyring.has(this.primaryKeyId);
    if (!this.enabled) {
      this.logger.warn(
        'FIELD_ENCRYPTION_KEY berilmagan — maydon shifrlash O`CHIQ (faqat dev). Prod`da kalit MAJBURIY.',
      );
    } else {
      this.logger.log(
        `Maydon shifrlash YOQILGAN (primary=${this.primaryKeyId}, keyring=${this.keyring.size}).`,
      );
    }
  }

  private parseKey(b64: string, id: string): Buffer {
    const key = Buffer.from(b64, 'base64');
    if (key.length !== KEY_LEN) {
      throw new Error(
        `Shifrlash kaliti (${id}) ${KEY_LEN} bayt bo'lishi kerak (base64), berilgan: ${key.length}`,
      );
    }
    return key;
  }

  /** Ochiq matnni shifrlaydi. Shifrlash o'chiq bo'lsa — o'zgartirmasdan qaytaradi. */
  encrypt(plain: string): string {
    if (!this.enabled) return plain;
    const key = this.keyring.get(this.primaryKeyId)!;
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALG, key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      PREFIX,
      this.primaryKeyId,
      iv.toString('base64'),
      tag.toString('base64'),
      ct.toString('base64'),
    ].join(':');
  }

  /** Token bo'lsa deshifrlaydi; ochiq qiymat bo'lsa o'zini qaytaradi (backward-compat). */
  decrypt(value: string): string {
    if (!this.isEncrypted(value)) return value;
    const [, keyId, ivB64, tagB64, ctB64] = value.split(':');
    const key = this.keyring.get(keyId);
    if (!key) {
      throw new Error(
        `Shifrlash kaliti topilmadi: ${keyId} (rotatsiya kalitini qo'shing)`,
      );
    }
    const decipher = createDecipheriv(ALG, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]);
    return pt.toString('utf8');
  }

  /** Qiymat shifrlangan token formatidami. */
  isEncrypted(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const parts = value.split(':');
    return parts.length === 5 && parts[0] === PREFIX;
  }

  /**
   * Blind index (qidiriladigan shifrlangan maydonlar uchun, spec 9B). Telefon kabi
   * maydonni shifrlab saqlab, ALOHIDA HMAC hash ustunida aniq-moslik qidiruvi
   * mumkin (partial qidiruv emas). Hozircha telefon ochiq — kelajakda shu metod
   * bilan blind-index ustuni to'ldiriladi.
   */
  blindIndex(value: string): string {
    const key = this.keyring.get(this.primaryKeyId);
    if (!key) return value;
    return createHmac('sha256', key)
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  /** Ikki blind-index'ni xavfsiz solishtirish (timing-safe). */
  blindIndexEquals(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }
}
