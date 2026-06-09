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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';

/** Xizmatlar — o'qish SERVICE_READ, o'zgartirish/narx SERVICE_MANAGE. */
@ApiTags('services')
@ApiBearerAuth()
@Controller('clinic/services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Post()
  @Permissions(Permission.SERVICE_MANAGE)
  @Audit({ action: 'SERVICE_CREATE', entity: 'Service' })
  @ApiOperation({ summary: 'Xizmat qo`shish' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceDto,
  ) {
    return this.services.create(user.clinicId!, dto);
  }

  @Get()
  @Permissions(Permission.SERVICE_READ)
  @ApiOperation({ summary: "Xizmatlar ro'yxati (qidiruv/kategoriya/faollik)" })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListServicesQueryDto,
  ) {
    return this.services.findAll(user.clinicId!, query);
  }

  @Get(':id')
  @Permissions(Permission.SERVICE_READ)
  @ApiOperation({ summary: 'Bitta xizmat' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.services.findOne(user.clinicId!, id);
  }

  @Get(':id/price-history')
  @Permissions(Permission.SERVICE_READ)
  @ApiOperation({ summary: 'Xizmat narx tarixi (kim/qachon/eski->yangi)' })
  priceHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.services.priceHistory(user.clinicId!, id, query);
  }

  @Patch(':id')
  @Permissions(Permission.SERVICE_MANAGE)
  @Audit({ action: 'SERVICE_UPDATE', entity: 'Service' })
  @ApiOperation({
    summary: 'Xizmatni tahrirlash (narx o`zgarsa tarixga yoziladi)',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.services.update(user.clinicId!, id, dto, user.userId);
  }

  @Delete(':id')
  @Permissions(Permission.SERVICE_MANAGE)
  @Audit({ action: 'SERVICE_DELETE', entity: 'Service' })
  @ApiOperation({ summary: "Xizmatni o'chirish (soft-delete)" })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.services.remove(user.clinicId!, id);
  }
}
