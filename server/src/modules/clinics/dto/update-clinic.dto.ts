import { PartialType } from '@nestjs/swagger';
import { ClinicCoreDto } from './create-clinic.dto';

/**
 * Klinikaning o'z maydonlarini qisman yangilash.
 * Holat (suspend/reactivate) alohida endpoint'lar orqali boshqariladi.
 */
export class UpdateClinicDto extends PartialType(ClinicCoreDto) {}
