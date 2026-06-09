import { Module } from '@nestjs/common';
import { CashierModule } from '../cashier/cashier.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { DoctorSchedulesController } from './doctor-schedules.controller';
import { DoctorSchedulesService } from './doctor-schedules.service';

/**
 * Qabul moduli (Phase 5B): shifokor jadvali + qabullar (double-booking lock,
 * status state-machine, bo'sh slotlar). CashierModule — qabul yakunlanганда
 * bemor invoice yaratish uchun.
 */
@Module({
  imports: [CashierModule],
  controllers: [DoctorSchedulesController, AppointmentsController],
  providers: [DoctorSchedulesService, AppointmentsService],
  exports: [AppointmentsService, DoctorSchedulesService],
})
export class AppointmentsModule {}
