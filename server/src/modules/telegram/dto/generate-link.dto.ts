import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { NotificationOwnerType } from '../../notifications/constants/notification.constant';

const OWNER_TYPES = Object.values(NotificationOwnerType);

/** Telegram bog'lash havolasini yaratish (bemor yoki xodim uchun). */
export class GenerateLinkDto {
  @ApiProperty({ enum: OWNER_TYPES, description: 'PATIENT | USER' })
  @IsIn(OWNER_TYPES)
  ownerType!: string;

  @ApiProperty({ description: 'Bemor ID yoki xodim (user) ID' })
  @IsUUID()
  ownerId!: string;
}
