import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ALL_APPOINTMENT_STATUSES } from '../constants/appointment.constant';

/** Qabul holatini o'zgartirish (keldi/qabulda/yakunlandi/bekor/kelmadi). */
export class ChangeStatusDto {
  @ApiProperty({ enum: ALL_APPOINTMENT_STATUSES })
  @IsIn(ALL_APPOINTMENT_STATUSES)
  status!: string;

  @ApiPropertyOptional({ description: 'Izoh (bekor sababi va h.k.)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
