-- =============================================================================
-- Phase 7B — Hisobot/statistika uchun indekslar (Reports & Analytics)
-- =============================================================================
-- Og'ir agregat so'rovlar (daromad, no-show foizi, shifokor yuklamasi, platforma
-- daromadi) to'g'ri indeksdan foydalansin (spec 1.6.B / 1.7.E). N+1 yo'q —
-- agregatsiya DB darajasida (GROUP BY) bajariladi.
--
-- Index nomlari Prisma `@@index` generatsiyasiga mos (drift bo'lmasligi uchun).
-- =============================================================================

-- Klinika daromadi: patient_payments.paid_at bo'yicha kunlik/oylik guruhlash.
CREATE INDEX IF NOT EXISTS "patient_payments_clinic_id_paid_at_idx"
    ON "patient_payments" ("clinic_id", "paid_at");

-- Bemorlar oqimi / shifokor yuklamasi: status kesimida sana oralig'i.
CREATE INDEX IF NOT EXISTS "appointments_clinic_id_status_scheduled_at_idx"
    ON "appointments" ("clinic_id", "status", "scheduled_at");

-- Platforma daromadi: PAID tranzaksiyalar performed_at bo'yicha (oylik).
CREATE INDEX IF NOT EXISTS "transactions_status_performed_at_idx"
    ON "transactions" ("status", "performed_at");
