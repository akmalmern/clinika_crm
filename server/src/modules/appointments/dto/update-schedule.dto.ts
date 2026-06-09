import { PartialType } from '@nestjs/swagger';
import { CreateScheduleDto } from './create-schedule.dto';

/** Ish jadvalini tahrirlash — barcha maydon ixtiyoriy. */
export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}
