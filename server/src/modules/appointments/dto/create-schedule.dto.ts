import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export class CreateScheduleDto {
  @ApiProperty({ description: 'Shifokor (user) ID' })
  @IsUUID()
  doctorId!: string;

  @ApiProperty({
    minimum: 0,
    maximum: 6,
    description: '0=Yakshanba .. 6=Shanba',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({
    example: '09:00',
    description: 'Boshlanishi (mahalliy HH:MM)',
  })
  @Matches(HM, { message: 'startTime HH:MM formatda bo`lsin' })
  startTime!: string;

  @ApiProperty({ example: '18:00', description: 'Tugashi (mahalliy HH:MM)' })
  @Matches(HM, { message: 'endTime HH:MM formatda bo`lsin' })
  endTime!: string;

  @ApiProperty({ example: 30, description: 'Slot davomiyligi (daqiqa)' })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  slotMinutes!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
