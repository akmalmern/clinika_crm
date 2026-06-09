import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ALL_APPOINTMENT_STATUSES } from '../constants/appointment.constant';

/** Qabullar ro'yxati / kalendar (kun-hafta oralig'i + filtrlar). */
export class ListAppointmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'scheduled_at >= (UTC ISO)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'scheduled_at <= (UTC ISO)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Shifokor bo`yicha filtr' })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Bemor bo`yicha filtr' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: ALL_APPOINTMENT_STATUSES })
  @IsOptional()
  @IsIn(ALL_APPOINTMENT_STATUSES)
  status?: string;
}
