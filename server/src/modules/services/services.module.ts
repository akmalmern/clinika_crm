import { Module } from '@nestjs/common';
import { ServiceCategoriesController } from './service-categories.controller';
import { ServiceCategoriesService } from './service-categories.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

/** Xizmatlar moduli (Phase 5A): kategoriyalar + xizmatlar + narx tarixi. */
@Module({
  controllers: [ServiceCategoriesController, ServicesController],
  providers: [ServiceCategoriesService, ServicesService],
  exports: [ServiceCategoriesService, ServicesService],
})
export class ServicesModule {}
