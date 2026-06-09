import { PartialType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

/** Bemorni tahrirlash — barcha maydonlar ixtiyoriy. */
export class UpdatePatientDto extends PartialType(CreatePatientDto) {}
