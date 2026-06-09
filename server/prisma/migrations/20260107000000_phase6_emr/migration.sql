-- =============================================================================
-- Phase 6 — Tibbiy yozuvlar (EMR) + retsept qatorlari
-- =============================================================================
-- MAXFIY ma'lumot: tenant izolyatsiyasi + audit (ilova darajasida). Vaqt UTC,
-- UUID v7, soft-delete. Skanlangan fayllar -> files (owner_type=MEDICAL_RECORD).
-- =============================================================================

CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "appointment_id" UUID,
    "doctor_id" UUID NOT NULL,
    "complaints" TEXT,
    "diagnosis" TEXT,
    "icd_code" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "drug_name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar (spec 8: medical_records(clinic_id, patient_id, created_at)) ----
CREATE INDEX "medical_records_clinic_id_patient_id_created_at_idx" ON "medical_records" ("clinic_id", "patient_id", "created_at");
CREATE INDEX "medical_records_clinic_id_created_at_idx" ON "medical_records" ("clinic_id", "created_at");
CREATE INDEX "medical_records_appointment_id_idx" ON "medical_records" ("appointment_id");
CREATE INDEX "prescription_items_clinic_id_medical_record_id_idx" ON "prescription_items" ("clinic_id", "medical_record_id");

-- ---- Foreign keys ----
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctor_id_fkey"
    FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_medical_record_id_fkey"
    FOREIGN KEY ("medical_record_id") REFERENCES "medical_records" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
