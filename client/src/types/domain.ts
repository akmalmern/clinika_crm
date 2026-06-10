/** Backend javob shakllari (frontend ko'rinishi). Pul/raqamlar string (Decimal). */

export interface Patient {
  id: string;
  fullName: string;
  birthDate: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  bloodType: string | null;
  allergies: string | null;
  avatarFileId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  position: string | null;
  specialization: string | null;
  isActive: boolean;
  avatarFileId: string | null;
  createdAt: string;
}

export interface FileItem {
  id: string;
  ownerType: string;
  ownerId: string;
  category: string;
  originalName: string;
  mimeType: string;
  size: string;
  uploadedBy?: string | null;
  createdAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  price: string;
  currency: string;
  categoryId: string | null;
  duration: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface PriceHistory {
  id: string;
  oldPrice: string;
  newPrice: string;
  changedBy: string | null;
  changedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string | null;
  doctorId: string;
  serviceId: string | null;
  serviceName: string | null;
  scheduledAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface FreeSlot {
  start: string;
  end: string;
  startLocal: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive: boolean;
}

export interface PatientInvoice {
  id: string;
  patientId: string;
  appointmentId: string | null;
  totalAmount: string;
  paidAmount: string;
  debtAmount: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface PatientPayment {
  id: string;
  patientInvoiceId: string;
  amount: string;
  method: string;
  status: string;
  paidAt: string;
  cashierId: string | null;
}

export interface PatientInvoiceDetail extends PatientInvoice {
  payments: PatientPayment[];
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  appointmentId: string | null;
  doctorId: string;
  complaints: string | null;
  diagnosis: string | null;
  icdCode: string | null;
  treatment: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Prescription {
  id: string;
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  createdAt: string;
}

export interface TimelineEntry {
  record: MedicalRecord;
  prescriptions: Prescription[];
  files: FileItem[];
}
