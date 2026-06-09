import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

/**
 * Xizmatni tahrirlash — barcha maydon ixtiyoriy. `price` o'zgarsa servis avtomatik
 * service_price_history'ga yozadi (kim, qachon, eski->yangi).
 */
export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
