/** Fayl cleanup BullMQ navbati (spec 6 — orphaned fayllarni tozalash). */
export const FILES_CLEANUP_QUEUE = 'files-cleanup';

export const FilesCleanupJob = {
  /** Egasi (user/patient/medical_record) o'chganda fayllarini tozalash. */
  OWNER_DELETED: 'owner-deleted',
} as const;

export interface OwnerCleanupPayload {
  ownerType: string;
  ownerId: string;
  /** Berilsa — faqat shu klinika fayllari tozalanadi (USER multi-klinika holati). */
  clinicId?: string;
}
