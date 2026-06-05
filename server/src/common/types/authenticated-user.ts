import { ActorType } from '../constants/roles.constant';

/**
 * JWT validatsiyadan keyin `req.user`ga joylanadigan obyekt.
 * Tenant konteksti ham shu ma'lumotdan to'ldiriladi.
 */
export interface AuthenticatedUser {
  userId: string;
  actorType: ActorType;
  role: string;
  email?: string;
  /** Klinika ichidagi foydalanuvchi uchun faol klinika; super admin'da undefined. */
  clinicId?: string;
  /** Access token'ning jti (blacklist uchun). */
  jti?: string;
}
