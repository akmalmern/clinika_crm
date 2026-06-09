import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { CLINIC_ROLES } from '../../../common/constants/roles.constant';

/** Xodimni tahrirlash. Email/parol bu yerda o'zgartirilmaydi (alohida oqim). */
export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'Karimov Doniyor' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: CLINIC_ROLES, example: 'DOCTOR' })
  @IsOptional()
  @IsIn(CLINIC_ROLES, { message: "role klinika roli bo'lishi kerak" })
  role?: string;

  @ApiPropertyOptional({ example: 'Kardiolog' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ example: 'Kardiologiya' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({ description: 'Faol/nofaol (ishdan bo`shatish emas)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
