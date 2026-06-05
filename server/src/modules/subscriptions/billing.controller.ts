import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowSuspended } from '../../common/decorators/allow-suspended.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActorType } from '../../common/constants/roles.constant';
import { SubscriptionStatus } from '../../common/constants/subscription.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Klinika foydalanuvchisiga ko'rinadigan billing holati.
 * @AllowSuspended — SUSPENDED klinika ham bu sahifani ko'ra oladi (to'lov uchun).
 */
@ApiTags('billing (clinic)')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('status')
  @AllowSuspended()
  @ApiOperation({ summary: "Joriy klinika obunasi holati (to'lov kerakmi)" })
  async status(@CurrentUser() user: AuthenticatedUser) {
    if (user.actorType !== ActorType.USER || !user.clinicId) {
      throw new ForbiddenException(
        'Bu endpoint faqat klinika foydalanuvchilari uchun',
      );
    }

    const subscription = await this.subscriptionsService.getCurrentByClinic(
      user.clinicId,
    );

    const paymentRequired =
      !subscription ||
      subscription.status === SubscriptionStatus.SUSPENDED ||
      subscription.status === SubscriptionStatus.PAST_DUE;

    return {
      data: {
        subscription,
        paymentRequired,
      },
      message: paymentRequired ? "To'lov talab qilinadi" : 'Obuna faol',
    };
  }
}
