import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  FILES_CLEANUP_QUEUE,
  FilesCleanupJob,
  OwnerCleanupPayload,
} from './files-cleanup.constant';

/**
 * Cleanup navbatiga job qo'shadi. Kelajakdagi modullar (Phase 5 staff/patient,
 * Phase 6 medical records) egani soft-delete qilganda shu metodni chaqiradi —
 * "orphaned" fayllar storage'da qolmaydi (spec 6 / 8).
 */
@Injectable()
export class FilesCleanupService {
  constructor(
    @InjectQueue(FILES_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueueOwnerCleanup(ownerType: string, ownerId: string): Promise<void> {
    const payload: OwnerCleanupPayload = { ownerType, ownerId };
    await this.queue.add(FilesCleanupJob.OWNER_DELETED, payload, {
      jobId: `${FilesCleanupJob.OWNER_DELETED}:${ownerType}:${ownerId}`,
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
