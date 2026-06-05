import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActorType } from '../../common/constants/roles.constant';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { FilesService, UploadedMulterFile } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';

// Multer himoya chegarasi (xotira suiiste'molidan). Aniq limit servisda (tarif/config).
const MULTER_HARD_CAP = 100 * 1024 * 1024;

/**
 * Universal fayl moduli endpoint'lari (spec 6). Faqat klinika foydalanuvchilari.
 * Tenant izolyatsiyasi: har amalda user.clinicId ishlatiladi (boshqa klinika fayli
 * ochilmaydi). Faylga kirish FAQAT signed URL orqali (public URL YO'Q).
 */
@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Permissions(Permission.FILE_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MULTER_HARD_CAP } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'ownerType', 'ownerId', 'category'],
      properties: {
        file: { type: 'string', format: 'binary' },
        ownerType: { type: 'string' },
        ownerId: { type: 'string' },
        category: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary: 'Fayl yuklash (multipart). MIME/hajm/tarif limiti tekshiriladi',
  })
  upload(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const clinicId = this.requireClinic(user);
    if (!file) {
      throw new BadRequestException("Fayl ('file' maydoni) talab qilinadi");
    }
    return this.filesService.upload({
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      category: dto.category,
      clinicId,
      uploadedBy: user.userId,
      file,
    });
  }

  @Get()
  @Permissions(Permission.FILE_READ)
  @ApiOperation({ summary: "Owner bo'yicha fayllar ro'yxati" })
  list(
    @Query() query: ListFilesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.list(query, this.requireClinic(user));
  }

  @Get(':id/url')
  @Permissions(Permission.FILE_READ)
  @ApiOperation({
    summary: 'Faylga vaqtinchalik signed URL (public URL yo`q, audit yoziladi)',
  })
  signedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.getSignedUrl(
      id,
      this.requireClinic(user),
      user.userId,
    );
  }

  @Delete(':id')
  @Permissions(Permission.FILE_MANAGE)
  @ApiOperation({
    summary: "Faylni o'chirish (soft-delete + storage tozalash)",
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.remove(id, this.requireClinic(user), user.userId);
  }

  private requireClinic(user: AuthenticatedUser): string {
    if (user.actorType !== ActorType.USER || !user.clinicId) {
      throw new ForbiddenException(
        'Bu endpoint faqat klinika foydalanuvchilari uchun',
      );
    }
    return user.clinicId;
  }
}
