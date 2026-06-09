import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

/** Bo'sh slotlar so'rovi: shifokor + mahalliy kalendar sana (YYYY-MM-DD). */
export class FreeSlotsQueryDto {
  @ApiProperty({ description: 'Shifokor (user) ID' })
  @IsUUID()
  doctorId!: string;

  @ApiProperty({
    example: '2026-06-10',
    description: 'Sana (mahalliy, YYYY-MM-DD)',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date YYYY-MM-DD formatda bo`lsin',
  })
  date!: string;
}
