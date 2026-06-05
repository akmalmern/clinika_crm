import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FilesService } from '../files.service';
import {
  FILES_CLEANUP_QUEUE,
  OwnerCleanupPayload,
} from './files-cleanup.constant';

/**
 * BullMQ worker — egasi o'chganda unga bog'langan fayllarni storage'dan tozalaydi.
 * Biznes mantiq FilesService.cleanupOwner'da (BullMQ'siz testlanadi).
 */
@Processor(FILES_CLEANUP_QUEUE)
export class FilesCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger('FilesCleanup');

  constructor(private readonly filesService: FilesService) {
    super();
  }

  async process(job: Job<OwnerCleanupPayload>): Promise<{ purged: number }> {
    const { ownerType, ownerId } = job.data;
    const result = await this.filesService.cleanupOwner(ownerType, ownerId);
    this.logger.log(
      `Cleanup ${ownerType}/${ownerId}: ${result.purged} fayl tozalandi`,
    );
    return result;
  }
}
