/**
 * Access token payload. `sub` = subject id (super_admin yoki user id).
 */
export interface AccessTokenPayload {
  sub: string;
  tokenType: 'access';
  actorType: string; // SUPER_ADMIN | USER
  role: string;
  email?: string;
  clinicId?: string;
  jti: string;
}

/**
 * Refresh token payload — minimal. Rol/email refresh paytida bazadan qayta
 * o'qiladi (eskirgan ma'lumot token'da qolib ketmasin), lekin USER uchun
 * qaysi klinika a'zoligi ekanini bilish uchun clinicId saqlanadi.
 */
export interface RefreshTokenPayload {
  sub: string;
  tokenType: 'refresh';
  actorType: string;
  clinicId?: string;
  jti: string;
}
