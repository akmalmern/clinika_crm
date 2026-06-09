import { Module } from '@nestjs/common';
import { CashierController } from './cashier.controller';
import { CashierService } from './cashier.service';
import { PatientReceiptPdfService } from './patient-receipt-pdf.service';

/**
 * Kassa moduli (Phase 5B). CashierService eksport qilinadi — AppointmentsModule
 * qabul yakunlanганда invoice yaratish uchun foydalanadi.
 */
@Module({
  controllers: [CashierController],
  providers: [CashierService, PatientReceiptPdfService],
  exports: [CashierService],
})
export class CashierModule {}
