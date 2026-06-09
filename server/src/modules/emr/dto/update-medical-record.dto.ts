import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Ko'rik yozuvini tahrirlash (bemor/qabul o'zgarmaydi). */
export class UpdateMedicalRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  complaints?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'J06.9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  icdCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  treatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
