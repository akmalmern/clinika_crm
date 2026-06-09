import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles.constant';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MULTER_HARD_CAP } from '../files/constants/file.constant';
import type { UploadedMulterFile } from '../files/files.service';
import { AttachDocumentDto } from '../files/dto/attach-document.dto';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

const fileBody = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

/**
 * Klinika a'zolari (xodimlar) — CLINIC_ADMIN o'z klinikasini boshqaradi.
 * clinicId TOKEN'dan olinadi (foydalanuvchi kiritmaydi) -> tenant izolyatsiyasi.
 * Profil rasmi va hujjatlar Phase 4 files moduli orqali (owner_type=USER).
 */
@ApiTags('clinic members (staff)')
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

  @Get(':id')
  @ApiOperation({ summary: 'Bitta xodim' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.findOne(user.clinicId!, id);
  }

  @Patch(':id')
  @Audit({ action: 'MEMBER_UPDATE', entity: 'ClinicMember' })
  @ApiOperation({ summary: 'Xodimni tahrirlash (rol/lavozim/holat)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(user.clinicId!, id, dto);
  }

  @Delete(':id')
  @Audit({ action: 'MEMBER_DELETE', entity: 'ClinicMember' })
  @ApiOperation({ summary: 'Xodimni chiqarish (soft-delete + fayl cleanup)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.remove(user.clinicId!, id);
  }

  // ---- Profil rasmi + hujjatlar ----

  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MULTER_HARD_CAP } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @ApiOperation({ summary: 'Profil rasmi (avatar) yuklash' })
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException("'file' maydoni talab qilinadi");
    return this.membersService.uploadAvatar(
      user.clinicId!,
      id,
      user.userId,
      file,
    );
  }

  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MULTER_HARD_CAP } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'category'],
      properties: {
        file: { type: 'string', format: 'binary' },
        category: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary: 'Hujjat biriktirish (PASSPORT/DIPLOMA/CERTIFICATE/LICENSE...)',
  })
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachDocumentDto,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException("'file' maydoni talab qilinadi");
    return this.membersService.uploadDocument(
      user.clinicId!,
      id,
      user.userId,
      dto.category,
      file,
    );
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Xodim hujjatlari ro`yxati (metadata)' })
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.listDocuments(user.clinicId!, id);
  }

  @Delete(':id/documents/:fileId')
  @ApiOperation({ summary: "Xodim hujjatini o'chirish" })
  deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.membersService.deleteDocument(
      user.clinicId!,
      id,
      fileId,
      user.userId,
    );
  }
}
