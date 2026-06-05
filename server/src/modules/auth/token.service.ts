import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { uuidv7 } from 'uuidv7';
import { JwtConfig } from '../../config/configuration';
import { RedisService } from '../../core/redis/redis.service';
import { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload';

export interface TokenSubject {
  sub: string;
  actorType: string;
  role: string;
  email?: string;
  clinicId?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // access token amal qilish muddati (sekund)
}

const REFRESH_KEY = (jti: string) => `auth:refresh:${jti}`;
const USER_REFRESH_SET = (actorType: string, sub: string) =>
  `auth:user_refresh:${actorType}:${sub}`;
const ACCESS_BL_KEY = (jti: string) => `auth:bl:${jti}`;

/**
 * Tokenlarni boshqaradi: access (15 min) + refresh (7 kun, rotatsiya bilan).
 * - Refresh tokenlar Redis'da "whitelist" (jti) sifatida saqlanadi -> bekor qilish mumkin.
 * - Logout: access jti blacklist + foydalanuvchining barcha refresh sessiyalari bekor.
 * Bu backend'ni stateless saqlaydi (spec 10-bo'lim).
 */
@Injectable()
export class TokenService {
  private readonly jwtCfg: JwtConfig;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.jwtCfg = config.getOrThrow<JwtConfig>('jwt');
  }

  async issueTokens(subject: TokenSubject): Promise<IssuedTokens> {
    const accessJti = uuidv7();
    const refreshJti = uuidv7();

    const accessPayload: AccessTokenPayload = {
      sub: subject.sub,
      tokenType: 'access',
      actorType: subject.actorType,
      role: subject.role,
      email: subject.email,
      clinicId: subject.clinicId,
      jti: accessJti,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: subject.sub,
      tokenType: 'refresh',
      actorType: subject.actorType,
      clinicId: subject.clinicId,
      jti: refreshJti,
    };

    // expiresIn env'dan oddiy string ('15m') keladi; @nestjs/jwt'ning qat'iy
    // StringValue tipiga moslash uchun JwtSignOptions'ga cast qilamiz.
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.jwtCfg.accessSecret,
      expiresIn: this.jwtCfg.accessExpires,
    } as JwtSignOptions);
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.jwtCfg.refreshSecret,
      expiresIn: this.jwtCfg.refreshExpires,
    } as JwtSignOptions);

    const refreshTtl = parseDurationToSeconds(this.jwtCfg.refreshExpires);
    await this.redis.set(REFRESH_KEY(refreshJti), subject.sub, refreshTtl);
    await this.redis.sadd(
      USER_REFRESH_SET(subject.actorType, subject.sub),
      refreshJti,
      refreshTtl,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: parseDurationToSeconds(this.jwtCfg.accessExpires),
    };
  }

  /** Refresh tokenni tekshiradi va payloadini qaytaradi (yaroqsiz bo'lsa 401). */
  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.jwtCfg.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(
        "Refresh token yaroqsiz yoki muddati o'tgan",
      );
    }
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException("Token turi noto'g'ri");
    }
    const active = await this.redis.exists(REFRESH_KEY(payload.jti));
    if (!active) {
      throw new UnauthorizedException('Refresh token bekor qilingan');
    }
    return payload;
  }

  /** Bitta refresh jti'ni bekor qiladi (rotatsiya). */
  async revokeRefreshJti(
    actorType: string,
    sub: string,
    jti: string,
  ): Promise<void> {
    await this.redis.del(REFRESH_KEY(jti));
    await this.redis.srem(USER_REFRESH_SET(actorType, sub), jti);
  }

  /** Foydalanuvchining barcha refresh sessiyalarini bekor qiladi (logout/global). */
  async revokeAllUserRefresh(actorType: string, sub: string): Promise<void> {
    const setKey = USER_REFRESH_SET(actorType, sub);
    const jtis = await this.redis.smembers(setKey);
    const keys = jtis.map((j) => REFRESH_KEY(j));
    await this.redis.del(...keys, setKey);
  }

  /** Access tokenni blacklist'ga qo'shadi (logout). TTL = qolgan amal muddati. */
  async blacklistAccess(jti: string, expEpochSeconds?: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const ttl =
      expEpochSeconds && expEpochSeconds > now
        ? expEpochSeconds - now
        : parseDurationToSeconds(this.jwtCfg.accessExpires);
    await this.redis.set(ACCESS_BL_KEY(jti), '1', ttl);
  }

  async isAccessBlacklisted(jti: string): Promise<boolean> {
    return this.redis.exists(ACCESS_BL_KEY(jti));
  }
}

/**
 * '15m', '7d', '30s', '12h' kabi muddatlarni sekundga aylantiradi.
 * Faqat raqam berilsa — sekund deb qabul qilinadi.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value.trim());
  if (!match) return 0;
  const amount = parseInt(match[1], 10);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return amount * (multipliers[unit] ?? 1);
}
