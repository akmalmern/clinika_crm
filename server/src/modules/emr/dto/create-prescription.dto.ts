import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Retsept qatori (bitta dori). Bir ko'rikда bir nechta bo'lishi mumkin. */
export class CreatePrescriptionDto {
  @ApiProperty({ example: 'Paracetamol' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  drugName!: string;

  @ApiPropertyOptional({ example: '500 mg' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dosage?: string;

  @ApiPropertyOptional({ example: 'kuniga 2 marta' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  frequency?: string;

  @ApiPropertyOptional({ example: '7 kun' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  duration?: string;

  @ApiPropertyOptional({ example: 'ovqatdan keyin' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}
