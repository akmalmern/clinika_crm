import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FilesService, UploadedMulterFile } from './files.service';

/**
 * FilesService (DB/storage'siz, mock). DoD:
 *  - ruxsatsiz MIME / hajm rad etiladi,
 *  - klinika tarif storage limiti oshsa rad etiladi,
 *  - boshqa klinika faylini ochib bo'lmaydi (tenant izolyatsiya),
 *  - cleanup egasi fayllarini storage'dan tozalaydi.
 */
describe('FilesService', () => {
  const TTL = 300;
  const MAX = 15 * 1024 * 1024;

  function makeService(
    prisma: Record<string, unknown>,
    storage?: Record<string, unknown>,
  ) {
    const storageMock = storage ?? {
      putObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed-url'),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const config = {
      getOrThrow: jest
        .fn()
        .mockReturnValue({ signedUrlTtl: TTL, maxFileSize: MAX }),
    };
    const service = new FilesService(
      prisma as never,
      storageMock as never,
      audit as never,
      config as never,
    );
    return { service, storage: storageMock, audit };
  }

  function file(over: Partial<UploadedMulterFile> = {}): UploadedMulterFile {
    return {
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 1000,
      buffer: Buffer.from('x'),
      ...over,
    };
  }

  const baseInput = {
    ownerType: 'USER',
    ownerId: '019e0000-0000-7000-8000-000000000001',
    category: 'PASSPORT',
    clinicId: 'cl1',
    uploadedBy: 'u1',
  };

  it('ruxsatsiz MIME -> BadRequest', async () => {
    const { service, storage } = makeService({});
    await expect(
      service.upload({ ...baseInput, file: file({ mimetype: 'text/plain' }) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('hajm limiti oshsa -> PayloadTooLarge', async () => {
    const { service, storage } = makeService({});
    await expect(
      service.upload({ ...baseInput, file: file({ size: MAX + 1 }) }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('tarif storage limiti oshsa -> BadRequest', async () => {
    const prisma = {
      subscription: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ plan: { limits: { storageGb: 1 } } }),
      },
      file: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { size: BigInt(1024) * BigInt(1024) * BigInt(1024) },
        }), // 1GB band
        create: jest.fn(),
      },
    };
    const { service, storage } = makeService(prisma);
    await expect(
      service.upload({ ...baseInput, file: file({ size: 1000 }) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.file.create).not.toHaveBeenCalled();
  });

  it('muvaffaqiyatli upload -> storage + DB + audit', async () => {
    const prisma = {
      subscription: { findFirst: jest.fn().mockResolvedValue(null) }, // limit yo'q
      file: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { size: null } }),
        create: jest.fn().mockResolvedValue({
          id: 'f1',
          ownerType: 'USER',
          ownerId: baseInput.ownerId,
          category: 'PASSPORT',
          originalName: 'doc.pdf',
          mimeType: 'application/pdf',
          size: BigInt(1000),
          uploadedBy: 'u1',
          createdAt: new Date(),
        }),
      },
    };
    const { service, storage, audit } = makeService(prisma);
    const res = await service.upload({ ...baseInput, file: file() });

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(prisma.file.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FILE_UPLOAD', entityId: 'f1' }),
    );
    expect(res.id).toBe('f1');
    expect(res.size).toBe('1000'); // BigInt -> string
    expect(typeof res.size).toBe('string');
  });

  it('boshqa klinika faylini ochib bo`lmaydi -> NotFound (tenant izolyatsiya)', async () => {
    // findFirst clinic_id filtri bilan -> boshqa klinika fayli null qaytadi
    const prisma = {
      file: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service, storage } = makeService(prisma);
    await expect(
      service.getSignedUrl('f-other', 'cl1', 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
    // where clinicId bilan chaqirilganini tasdiqlash:
    expect(prisma.file.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'f-other', clinicId: 'cl1' }),
      }),
    );
  });

  it('signed URL: topilsa -> URL + audit FILE_DOWNLOAD', async () => {
    const prisma = {
      file: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'f1',
          clinicId: 'cl1',
          storageKey: 'clinics/cl1/USER/u/x.pdf',
          originalName: 'doc.pdf',
          category: 'PASSPORT',
          ownerType: 'USER',
        }),
      },
    };
    const { service, storage, audit } = makeService(prisma);
    const res = await service.getSignedUrl('f1', 'cl1', 'u1');
    expect(res.url).toBe('https://signed-url');
    expect(res.expiresIn).toBe(TTL);
    expect(storage.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FILE_DOWNLOAD' }),
    );
  });

  it('cleanupOwner: egasi fayllarini storage`dan tozalaydi', async () => {
    const prisma = {
      file: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'f1', storageKey: 'k1', deletedAt: null },
          { id: 'f2', storageKey: 'k2', deletedAt: new Date() }, // allaqachon soft-deleted
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const { service, storage, audit } = makeService(prisma);
    const res = await service.cleanupOwner('PATIENT', 'p1');

    expect(res.purged).toBe(2);
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
    // faqat soft-delete qilinmagan f1 update qilinadi
    expect(prisma.file.update).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FILE_CLEANUP' }),
    );
  });
});
