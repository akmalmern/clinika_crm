import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles.constant';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

/**
 * Klinika a'zolari (xodimlar) — CLINIC_ADMIN o'z klinikasini boshqaradi.
 * clinicId TOKEN'dan olinadi (foydalanuvchi kiritmaydi) -> tenant izolyatsiyasi.
 */
@ApiTags('clinic members')
@ApiBearerAuth()
@Roles(Role.CLINIC_ADMIN)
@Permissions(Permission.STAFF_MANAGE)
@Controller('clinic/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @Audit({ action: 'MEMBER_CREATE', entity: 'ClinicMember' })
  @ApiOperation({
    summary: "Xodim qo'shish (yangi user yoki mavjudini biriktirish)",
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMemberDto) {
    return this.membersService.create(user.clinicId!, dto);
  }

  @Get()
  @ApiOperation({ summary: "Klinika xodimlari ro'yxati (faqat o'z klinikasi)" })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.membersService.findAll(user.clinicId!, query);
  }
}
