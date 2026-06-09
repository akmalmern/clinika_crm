import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { Role } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { FreeSlotsQueryDto } from './dto/free-slots-query.dto';

/**
 * Qabullar (spec 7.6). Tenant izolyatsiya (clinicId TOKEN'dan). DOCTOR faqat
 * o'z qabullarini ko'radi (restrictDoctor). Registrator yozadi/bekor qiladi,
 * shifokor/hamshira klinik holatni o'zgartiradi.
 */
@ApiTags('appointments')
@ApiBearerAuth()
@Controller('clinic/appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @Permissions(Permission.APPOINTMENT_MANAGE)
  @Audit({ action: 'APPOINTMENT_CREATE', entity: 'Appointment' })
  @ApiOperation({ summary: 'Qabulga yozish (double-booking tekshiriladi)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointments.create(user.clinicId!, dto, user.userId);
  }

  @Get('free-slots')
  @Permissions(Permission.APPOINTMENT_READ)
  @ApiOperation({ summary: 'Shifokorning kun bo`yicha bo`sh slotlari' })
  freeSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FreeSlotsQueryDto,
  ) {
    return this.appointments.freeSlots(
      user.clinicId!,
      query.doctorId,
      query.date,
    );
  }

  @Get()
  @Permissions(Permission.APPOINTMENT_READ)
  @ApiOperation({
    summary: 'Qabullar (kalendar: from/to, shifokor/bemor/status)',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointments.findAll(
      user.clinicId!,
      query,
      this.restrictDoctor(user),
    );
  }

  @Get(':id')
  @Permissions(Permission.APPOINTMENT_READ)
  @ApiOperation({ summary: 'Bitta qabul' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointments.findOne(
      user.clinicId!,
      id,
      this.restrictDoctor(user),
    );
  }

  @Patch(':id')
  @Permissions(Permission.APPOINTMENT_MANAGE)
  @Audit({ action: 'APPOINTMENT_UPDATE', entity: 'Appointment' })
  @ApiOperation({ summary: 'Qabulni qayta rejalashtirish/tahrirlash' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointments.update(user.clinicId!, id, dto, user.userId);
  }

  @Post(':id/status')
  @Permissions(Permission.APPOINTMENT_STATUS)
  @ApiOperation({
    summary: 'Holatni o`zgartirish (keldi/qabulda/yakunlandi/kelmadi)',
  })
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.appointments.changeStatus(
      user.clinicId!,
      id,
      dto.status,
      user.userId,
      dto.note,
      this.restrictDoctor(user),
    );
  }

  @Delete(':id')
  @Permissions(Permission.APPOINTMENT_MANAGE)
  @Audit({ action: 'APPOINTMENT_CANCEL', entity: 'Appointment' })
  @ApiOperation({ summary: 'Qabulni bekor qilish (CANCELLED)' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointments.cancel(user.clinicId!, id, user.userId);
  }

  /** DOCTOR faqat o'z qabullarini ko'radi (spec 7.6). */
  private restrictDoctor(user: AuthenticatedUser): string | undefined {
    return user.role === Role.DOCTOR ? user.userId : undefined;
  }
}
