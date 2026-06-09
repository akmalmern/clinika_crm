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
  Res,
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
import type { Response } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MULTER_HARD_CAP } from '../files/constants/file.constant';
import type { UploadedMulterFile } from '../files/files.service';
import { AttachDocumentDto } from '../files/dto/attach-document.dto';
import { EmrService, Actor } from './emr.service';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { ListMedicalRecordsQueryDto } from './dto/list-medical-records-query.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

/**
 * EMR (tibbiy yozuvlar) — MAXFIY. Faqat EMR_READ/EMR_MANAGE (DOCTOR/NURSE/
 * CLINIC_ADMIN). RECEPTIONIST/CASHIER kira olmaydi. Tenant izolyatsiya + har
 * o'qish audit'ga (servisда). Skan fayllar files moduli orqali (owner=MEDICAL_RECORD).
 */
@ApiTags('emr (medical records)')
@ApiBearerAuth()
@Controller('clinic')
export class EmrController {
  constructor(
    private readonly emr: EmrService,
    private readonly prescriptionPdf: PrescriptionPdfService,
  ) {}

  // ---- Medical records ----

  @Post('medical-records')
  @Permissions(Permission.EMR_MANAGE)
  @ApiOperation({ summary: "Ko'rik yozuvi yaratish (tashxis/ICD/davolash)" })
  createRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicalRecordDto,
  ) {
    return this.emr.createRecord(user.clinicId!, dto, actor(user));
  }

  @Get('medical-records')
  @Permissions(Permission.EMR_READ)
  @ApiOperation({ summary: "Ko'rik yozuvlari (bemor bo`yicha)" })
  listRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMedicalRecordsQueryDto,
  ) {
    return this.emr.listRecords(user.clinicId!, query, actor(user));
  }

  @Get('medical-records/:id')
  @Permissions(Permission.EMR_READ)
  @ApiOperation({
    summary: "Bitta ko'rik (retseptlari bilan) — kirish auditlanadi",
  })
  findRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.emr.findRecord(user.clinicId!, id, actor(user));
  }

  @Patch('medical-records/:id')
  @Permissions(Permission.EMR_MANAGE)
  @ApiOperation({ summary: "Ko'rikni tahrirlash (tegishli shifokor/admin)" })
  updateRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    return this.emr.updateRecord(user.clinicId!, id, dto, actor(user));
  }

  @Delete('medical-records/:id')
  @Permissions(Permission.EMR_MANAGE)
  @ApiOperation({ summary: "Ko'rikni o'chirish (soft-delete + fayl cleanup)" })
  removeRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.emr.removeRecord(user.clinicId!, id, actor(user));
  }

  // ---- Prescriptions ----

  @Post('medical-records/:id/prescriptions')
  @Permissions(Permission.EMR_MANAGE)
  @ApiOperation({ summary: "Retseptga dori qo'shish" })
  addPrescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePrescriptionDto,
  ) {
    return this.emr.addPrescription(user.clinicId!, id, dto, actor(user));
  }

  @Get('medical-records/:id/prescriptions')
  @Permissions(Permission.EMR_READ)
  @ApiOperation({ summary: "Ko'rik retsepti (dorilar)" })
  listPrescriptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.emr.listPrescriptions(user.clinicId!, id);
  }

  @Patch('medical-records/:id/prescriptions/:itemId')
  @Permissions(Permission.EMR_MANAGE)
  @ApiOperation({ summary: 'Dori qatorini tahrirlash' })
  updatePrescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePrescriptionDto,
  ) {
    return this.emr.updatePrescription(
      user.clinicId!,
      id,
      itemId,
      dto,
      actor(user),
    );
  }

  @Delete('medical-records/:id/prescriptions/:itemId')
  @Permissions(Permission.EMR_MANAGE)
  @ApiOperation({ summary: "Dori qatorini o'chirish" })
  removePrescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.emr.removePrescription(user.clinicId!, id, itemId, actor(user));
  }

  @Get('medical-records/:id/prescription-pdf')
  @Permissions(Permission.EMR_READ)
  @ApiOperation({ summary: 'Retsept (PDF)' })
  async downloadPrescriptionPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { record, clinic } = await this.emr.getPrescriptionData(
      user.clinicId!,
      id,
      actor(user),
    );
    const pdf = this.prescriptionPdf.build(record, clinic);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.prescriptionPdf.buildFileName(id)}"`,
    );
    res.send(pdf);
  }

  // ---- Skan fayllar (lab/rentgen/ma'lumotnoma) ----

  @Post('medical-records/:id/files')
  @Permissions(Permission.EMR_MANAGE)
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
  @ApiOperation({ summary: 'Skan biriktirish (LAB_RESULT/XRAY_SCAN/...)' })
  attachFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachDocumentDto,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException("'file' maydoni talab qilinadi");
    return this.emr.attachFile(
      user.clinicId!,
      id,
      dto.category,
      user.userId,
      file,
    );
  }

  @Get('medical-records/:id/files')
  @Permissions(Permission.EMR_READ)
  @ApiOperation({ summary: "Ko'rikka biriktirilgan fayllar" })
  listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.emr.listFiles(user.clinicId!, id);
  }

  @Get('medical-records/:id/files/:fileId/url')
  @Permissions(Permission.EMR_READ)
  @ApiOperation({ summary: 'Skan faylga signed URL (auditlanadi)' })
  fileUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.emr.fileUrl(user.clinicId!, fileId, user.userId);
  }

  // ---- Bemor tarixi (timeline) ----

  @Get('patients/:patientId/history')
  @Permissions(Permission.EMR_READ)
  @ApiOperation({
    summary: "Bemor tarixi (ko'rik + retsept + fayllar, yangidan eskiga)",
  })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.emr.timeline(user.clinicId!, patientId, actor(user));
  }
}

function actor(user: AuthenticatedUser): Actor {
  return { userId: user.userId, role: user.role };
}
