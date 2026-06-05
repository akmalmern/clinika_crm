import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { BillingController } from './billing.controller';

@Module({
  controllers: [BillingController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
