import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Bemor ID' })
  @IsUUID()
  patientId!: string;

  @ApiProperty({ description: 'Shifokor (user) ID' })
  @IsUUID()
  doctorId!: string;

  @ApiPropertyOptional({ description: 'Xizmat ID (narx/davomiylik uchun)' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({
    example: '2026-06-10T09:00:00.000Z',
    description: 'Boshlanish (UTC ISO)',
  })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: 'Davomiylik (daqiqa). Berilmasa — xizmat duration yoki 30.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
