-- =============================================================================
-- Phase 5B — Qabul (appointments) + Kassa (bemor to'lovlari)
-- =============================================================================
-- Pul DECIMAL(14,2), vaqt TIMESTAMPTZ (UTC), soft-delete kerakli joyda.
-- Double-booking: btree_gist EXCLUDE constraint — bitta shifokorga vaqt oralig'i
-- ustma-ust qabul kiritib bo'lmaydi (parallel so'rovlarда ham DB darajasida).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---- doctor_schedules ----
CREATE TABLE "doctor_schedules" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "slot_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- ---- appointments ----
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "service_id" UUID,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- ---- appointment_status_history (append-only) ----
CREATE TABLE "appointment_status_history" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

-- ---- invoices_patient (klinika kassasi) ----
CREATE TABLE "invoices_patient" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "appointment_id" UUID,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "debt_amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "invoices_patient_pkey" PRIMARY KEY ("id")
);

-- ---- patient_payments (ledger) ----
CREATE TABLE "patient_payments" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_invoice_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashier_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "patient_payments_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar ----
CREATE INDEX "doctor_schedules_clinic_id_doctor_id_weekday_idx" ON "doctor_schedules" ("clinic_id", "doctor_id", "weekday");
CREATE INDEX "appointments_clinic_id_doctor_id_scheduled_at_idx" ON "appointments" ("clinic_id", "doctor_id", "scheduled_at");
CREATE INDEX "appointments_clinic_id_patient_id_idx" ON "appointments" ("clinic_id", "patient_id");
CREATE INDEX "appointments_clinic_id_scheduled_at_idx" ON "appointments" ("clinic_id", "scheduled_at");
CREATE INDEX "appointment_status_history_appointment_id_changed_at_idx" ON "appointment_status_history" ("appointment_id", "changed_at");
CREATE INDEX "invoices_patient_clinic_id_status_idx" ON "invoices_patient" ("clinic_id", "status");
CREATE INDEX "invoices_patient_clinic_id_patient_id_idx" ON "invoices_patient" ("clinic_id", "patient_id");
CREATE INDEX "patient_payments_clinic_id_created_at_idx" ON "patient_payments" ("clinic_id", "created_at");
CREATE INDEX "patient_payments_patient_invoice_id_idx" ON "patient_payments" ("patient_invoice_id");

-- ---- DOUBLE-BOOKING: vaqt oralig'i ustma-ust kelmasligi (spec 7.6) ----
-- Bitta clinic+doctor uchun bekor/no-show bo'lmagan qabullar vaqti kesishmaydi.
ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_no_overlap"
    EXCLUDE USING gist (
        "clinic_id" WITH =,
        "doctor_id" WITH =,
        tstzrange("scheduled_at", "ends_at") WITH &&
    )
    WHERE ("deleted_at" IS NULL AND "status" NOT IN ('CANCELLED', 'NO_SHOW'));

-- ---- Foreign keys ----
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey"
    FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey"
    FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices_patient" ADD CONSTRAINT "invoices_patient_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices_patient" ADD CONSTRAINT "invoices_patient_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices_patient" ADD CONSTRAINT "invoices_patient_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patient_payments" ADD CONSTRAINT "patient_payments_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_payments" ADD CONSTRAINT "patient_payments_patient_invoice_id_fkey"
    FOREIGN KEY ("patient_invoice_id") REFERENCES "invoices_patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_payments" ADD CONSTRAINT "patient_payments_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
