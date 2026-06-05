import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { Role } from '../../common/constants/roles.constant';
import { Permission } from '../../common/constants/permissions.constant';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { ListClinicsQueryDto } from './dto/list-clinics-query.dto';

/**
 * Super Admin klinikalarni boshqaradi (spec 2, 5). Barcha endpoint'lar
 * faqat SUPER_ADMIN uchun — global RolesGuard/PermissionsGuard tekshiradi.
 */
@ApiTags('clinics (super-admin)')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  @Permissions(Permission.CLINIC_CREATE)
  @Audit({ action: 'CLINIC_CREATE', entity: 'Clinic' })
  @ApiOperation({
    summary:
      "Klinika qo'shish + CLINIC_ADMIN yaratish (parol generatsiya qilinadi)",
  })
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

  @Get()
  @Permissions(Permission.CLINIC_READ)
  @ApiOperation({
    summary:
      "Klinikalar ro'yxati (holat, obuna, a'zolar soni) + filter/qidiruv",
  })
  findAll(@Query() query: ListClinicsQueryDto) {
    return this.clinicsService.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.CLINIC_READ)
  @ApiOperation({ summary: 'Bitta klinika tafsiloti' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.CLINIC_UPDATE)
  @Audit({ action: 'CLINIC_UPDATE', entity: 'Clinic' })
  @ApiOperation({ summary: "Klinika ma'lumotlarini tahrirlash" })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.CLINIC_DELETE)
  @Audit({ action: 'CLINIC_DELETE', entity: 'Clinic' })
  @ApiOperation({ summary: "Klinikani o'chirish (soft-delete)" })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.remove(id);
  }

  @Post(':id/suspend')
  @Permissions(Permission.SUBSCRIPTION_MANAGE)
  @Audit({ action: 'CLINIC_SUSPEND', entity: 'Clinic' })
  @ApiOperation({ summary: "Klinikani to'xtatish (SUSPENDED)" })
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.suspend(id);
  }

  @Post(':id/reactivate')
  @Permissions(Permission.SUBSCRIPTION_MANAGE)
  @Audit({ action: 'CLINIC_REACTIVATE', entity: 'Clinic' })
  @ApiOperation({ summary: 'Klinikani qayta faollashtirish (ACTIVE)' })
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.reactivate(id);
  }
}
