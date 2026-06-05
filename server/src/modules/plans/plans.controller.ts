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
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { Role } from '../../common/constants/roles.constant';
import { Permission } from '../../common/constants/permissions.constant';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('plans (super-admin)')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Permissions(Permission.PLAN_MANAGE)
@Controller('super-admin/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @Audit({ action: 'PLAN_CREATE', entity: 'SubscriptionPlan' })
  @ApiOperation({ summary: 'Yangi tarif yaratish' })
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Tariflar ro'yxati (pagination + qidiruv)" })
  findAll(@Query() query: PaginationQueryDto) {
    return this.plansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta tarif' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  @Audit({ action: 'PLAN_UPDATE', entity: 'SubscriptionPlan' })
  @ApiOperation({ summary: 'Tarifni tahrirlash (narx/limits/features)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @Audit({ action: 'PLAN_DELETE', entity: 'SubscriptionPlan' })
  @ApiOperation({ summary: "Tarifni o'chirish (soft-delete)" })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.remove(id);
  }
}
