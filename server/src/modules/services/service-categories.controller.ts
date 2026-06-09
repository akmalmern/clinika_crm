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
import { ServiceCategoriesService } from './service-categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/** Xizmat kategoriyalari — o'qish SERVICE_READ, o'zgartirish SERVICE_MANAGE. */
@ApiTags('service categories')
@ApiBearerAuth()
@Controller('clinic/service-categories')
export class ServiceCategoriesController {
  constructor(private readonly categories: ServiceCategoriesService) {}

  @Post()
  @Permissions(Permission.SERVICE_MANAGE)
  @Audit({ action: 'SERVICE_CATEGORY_CREATE', entity: 'ServiceCategory' })
  @ApiOperation({ summary: 'Kategoriya qo`shish' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categories.create(user.clinicId!, dto);
  }

  @Get()
  @Permissions(Permission.SERVICE_READ)
  @ApiOperation({ summary: "Kategoriyalar ro'yxati" })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.categories.findAll(user.clinicId!, query);
  }

  @Get(':id')
  @Permissions(Permission.SERVICE_READ)
  @ApiOperation({ summary: 'Bitta kategoriya' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categories.findOne(user.clinicId!, id);
  }

  @Patch(':id')
  @Permissions(Permission.SERVICE_MANAGE)
  @Audit({ action: 'SERVICE_CATEGORY_UPDATE', entity: 'ServiceCategory' })
  @ApiOperation({ summary: 'Kategoriyani tahrirlash' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(user.clinicId!, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.SERVICE_MANAGE)
  @Audit({ action: 'SERVICE_CATEGORY_DELETE', entity: 'ServiceCategory' })
  @ApiOperation({ summary: "Kategoriyani o'chirish (soft-delete)" })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categories.remove(user.clinicId!, id);
  }
}
