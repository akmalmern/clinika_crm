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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MULTER_HARD_CAP } from '../files/constants/file.constant';
import type { UploadedMulterFile } from '../files/files.service';
import { AttachDocumentDto } from '../files/dto/attach-document.dto';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';

/**
 * Bemorlar — klinika foydalanuvchilari (PATIENT_READ/PATIENT_MANAGE).
 * clinicId TOKEN'dan -> tenant izolyatsiyasi. Rasm/hujjat files moduli orqali.
 */
@ApiTags('patients')
@ApiBearerAuth()
@Controller('clinic/patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Permissions(Permission.PATIENT_MANAGE)
  @Audit({ action: 'PATIENT_CREATE', entity: 'Patient' })
  @ApiOperation({ summary: "Bemor qo'shish" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(user.clinicId!, dto);
  }

  @Get()
  @Permissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: "Bemorlar ro'yxati (qidiruv: ism/telefon)" })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPatientsQueryDto,
  ) {
    return this.patientsService.findAll(user.clinicId!, query);
  }

  @Get(':id')
  @Permissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Bitta bemor' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.findOne(user.clinicId!, id);
  }

  @Patch(':id')
  @Permissions(Permission.PATIENT_MANAGE)
  @Audit({ action: 'PATIENT_UPDATE', entity: 'Patient' })
  @ApiOperation({ summary: 'Bemorni tahrirlash' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(user.clinicId!, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.PATIENT_MANAGE)
  @Audit({ action: 'PATIENT_DELETE', entity: 'Patient' })
  @ApiOperation({ summary: "Bemorni o'chirish (soft-delete + fayl cleanup)" })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.remove(user.clinicId!, id);
  }

  // ---- Rasm + hujjatlar ----

  @Post(':id/avatar')
  @Permissions(Permission.PATIENT_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MULTER_HARD_CAP } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Bemor rasmi (avatar) yuklash' })
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException("'file' maydoni talab qilinadi");
    return this.patientsService.uploadAvatar(
      user.clinicId!,
      id,
      user.userId,
      file,
    );
  }

  @Post(':id/documents')
  @Permissions(Permission.PATIENT_MANAGE)
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
    summary: 'Hujjat biriktirish (PATIENT_PASSPORT/LAB_RESULT/XRAY_SCAN...)',
  })
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachDocumentDto,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException("'file' maydoni talab qilinadi");
    return this.patientsService.uploadDocument(
      user.clinicId!,
      id,
      user.userId,
      dto.category,
      file,
    );
  }

  @Get(':id/documents')
  @Permissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Bemor hujjatlari ro`yxati' })
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.listDocuments(user.clinicId!, id);
  }

  @Delete(':id/documents/:fileId')
  @Permissions(Permission.PATIENT_MANAGE)
  @ApiOperation({ summary: "Bemor hujjatini o'chirish" })
  deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.patientsService.deleteDocument(
      user.clinicId!,
      id,
      fileId,
      user.userId,
    );
  }
}
