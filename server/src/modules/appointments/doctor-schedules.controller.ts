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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DoctorSchedulesService } from './doctor-schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

/** Shifokor ish jadvali — o'qish SCHEDULE_READ, o'zgartirish SCHEDULE_MANAGE. */
@ApiTags('doctor schedules')
@ApiBearerAuth()
@Controller('clinic/doctor-schedules')
export class DoctorSchedulesController {
  constructor(private readonly schedules: DoctorSchedulesService) {}

  @Post()
  @Permissions(Permission.SCHEDULE_MANAGE)
  @Audit({ action: 'SCHEDULE_CREATE', entity: 'DoctorSchedule' })
  @ApiOperation({ summary: 'Ish jadvali qo`shish' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedules.create(user.clinicId!, dto);
  }

  @Get()
  @Permissions(Permission.SCHEDULE_READ)
  @ApiQuery({ name: 'doctorId', required: false })
  @ApiOperation({ summary: 'Ish jadvallari (ixtiyoriy doctorId filtri)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.schedules.findAll(user.clinicId!, doctorId);
  }

  @Patch(':id')
  @Permissions(Permission.SCHEDULE_MANAGE)
  @Audit({ action: 'SCHEDULE_UPDATE', entity: 'DoctorSchedule' })
  @ApiOperation({ summary: 'Ish jadvalini tahrirlash' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedules.update(user.clinicId!, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.SCHEDULE_MANAGE)
  @Audit({ action: 'SCHEDULE_DELETE', entity: 'DoctorSchedule' })
  @ApiOperation({ summary: "Ish jadvalini o'chirish" })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedules.remove(user.clinicId!, id);
  }
}
