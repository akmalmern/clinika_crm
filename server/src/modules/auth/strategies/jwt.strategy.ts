import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../../config/configuration';
import { ActorType } from '../../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { patchTenant } from '../../../core/tenant/tenant-context';
import { AccessTokenPayload } from '../types/jwt-payload';
import { TokenService } from '../token.service';

/**
 * Access token strategiyasi. Token tekshirilgach:
 *  - blacklist (logout) tekshiriladi,
 *  - tenant konteksti (userId/clinicId/role) to'ldiriladi — shu joydan boshlab
 *    Prisma extension avtomatik clinic_id filtrini biladi.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly tokenService: TokenService,
  ) {
    const jwtCfg = config.getOrThrow<JwtConfig>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtCfg.accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException("Token turi noto'g'ri");
    }
    if (
      payload.jti &&
      (await this.tokenService.isAccessBlacklisted(payload.jti))
    ) {
      throw new UnauthorizedException('Token bekor qilingan (logout)');
    }

    const isSuperAdmin = payload.actorType === ActorType.SUPER_ADMIN;

    // Tenant konteksti — Prisma extension va audit shundan o'qiydi.
    patchTenant({
      userId: payload.sub,
      clinicId: payload.clinicId,
      role: payload.role,
      actorType: payload.actorType,
      isSuperAdmin,
      // Super admin cross-tenant ishlay oladi -> avtomatik clinic_id filtri o'chiq.
      bypassTenant: isSuperAdmin,
    });

    return {
      userId: payload.sub,
      actorType: payload.actorType as AuthenticatedUser['actorType'],
      role: payload.role,
      email: payload.email,
      clinicId: payload.clinicId,
      jti: payload.jti,
    };
  }
}
