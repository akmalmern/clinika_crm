'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState, ErrorState } from '@/components/common/states';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { AvatarUploader } from '@/components/files/avatar-uploader';
import { DocumentsManager } from '@/components/files/documents-manager';
import { PatientHistory } from '@/components/emr/patient-history';
import { useCan } from '@/components/session-provider';
import { Permission } from '@/lib/auth/permissions';
import { apiDelete, apiErrorMessage, apiGet } from '@/lib/api/client';
import { GENDER_LABEL, PATIENT_DOC_CATEGORIES } from '@/lib/constants';
import { ageFromBirthDate, formatDate } from '@/lib/format';
import type { Patient } from '@/types/domain';
import { PatientFormDialog } from './patient-form-dialog';

export function PatientProfile({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const can = useCan();
  const canManage = can(Permission.PATIENT_MANAGE);
  const canEmr = can(Permission.EMR_READ);

  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const query = useQuery({
    queryKey: ['patient', id],
    queryFn: () => apiGet<Patient>(`/clinic/patients/${id}`),
  });

  const remove = useMutation({
    mutationFn: () => apiDelete(`/clinic/patients/${id}`),
    onSuccess: () => {
      toast.success("Bemor o'chirildi");
      qc.invalidateQueries({ queryKey: ['patients'] });
      router.push('/clinic/patients');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState onRetry={() => query.refetch()} />;

  const p = query.data;
  const age = ageFromBirthDate(p.birthDate);

  const info: { label: string; value: string }[] = [
    { label: 'Telefon', value: p.phone ?? '—' },
    {
      label: 'Jins',
      value: p.gender ? GENDER_LABEL[p.gender] ?? p.gender : '—',
    },
    {
      label: "Tug'ilgan sana",
      value: p.birthDate
        ? `${formatDate(p.birthDate)}${age !== null ? ` (${age} yosh)` : ''}`
        : '—',
    },
    { label: 'Qon guruhi', value: p.bloodType ?? '—' },
    { label: 'Manzil', value: p.address ?? '—' },
    { label: 'Allergiya', value: p.allergies ?? '—' },
    { label: "Ro'yxatga olingan", value: formatDate(p.createdAt) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{p.fullName}</h1>
            <p className="text-sm text-muted-foreground">Bemor profili</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Tahrirlash
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setDelOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              O&apos;chirish
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Ma&apos;lumot</TabsTrigger>
          <TabsTrigger value="docs">Rasm va hujjatlar</TabsTrigger>
          {canEmr && <TabsTrigger value="history">Tarix</TabsTrigger>}
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardContent className="grid gap-x-8 gap-y-4 py-6 sm:grid-cols-2">
              {info.map((row) => (
                <div key={row.label}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-sm">{row.value}</p>
                </div>
              ))}
              {p.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Eslatma
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{p.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-6">
                <AvatarUploader
                  avatarFileId={p.avatarFileId}
                  fullName={p.fullName}
                  uploadPath={`/clinic/patients/${id}/avatar`}
                  canManage={canManage}
                  onUploaded={() =>
                    qc.invalidateQueries({ queryKey: ['patient', id] })
                  }
                />
                <p className="text-sm font-medium">{p.fullName}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <DocumentsManager
                  listPath={`/clinic/patients/${id}/documents`}
                  uploadPath={`/clinic/patients/${id}/documents`}
                  deletePath={(fid) => `/clinic/patients/${id}/documents/${fid}`}
                  categories={PATIENT_DOC_CATEGORIES}
                  queryKey={`patient-docs-${id}`}
                  canManage={canManage}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canEmr && (
          <TabsContent value="history">
            <PatientHistory patientId={id} />
          </TabsContent>
        )}
      </Tabs>

      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={p}
      />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Bemorni o'chirish"
        description={`${p.fullName} o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  );
}
