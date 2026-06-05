import { PartialType } from '@nestjs/swagger';
import { CreatePlanDto } from './create-plan.dto';

/** Barcha maydonlar ixtiyoriy (qisman yangilash). */
export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
