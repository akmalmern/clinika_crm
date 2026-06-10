'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, FileText, Pencil, Plus, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/common/states';
import { DocumentsManager } from '@/components/files/documents-manager';
import { useCan } from '@/components/session-provider';
import { Permission } from '@/lib/auth/permissions';
import { apiGet } from '@/lib/api/client';
import { EMR_FILE_CATEGORIES } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import type { MedicalRecord, TimelineEntry } from '@/types/domain';
import { MedicalRecordDialog } from './medical-record-dialog';
import { PrescriptionsManager } from './prescriptions-manager';

/** Bemor tibbiy tarixi (timeline): ko'rik + retsept + fayllar (yangidan eskiga). */
export function PatientHistory({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const can = useCan();
  const canManage = can(Permission.EMR_MANAGE);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MedicalRecord | null>(null);

  const query = useQuery({
    queryKey: ['patient-history', patientId],
    queryFn: () =>
      apiGet<TimelineEntry[]>(`/clinic/patients/${patientId}/history`),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['patient-history', patientId] });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Kasallik tarixi</h3>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Yangi ko&apos;rik
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState
          title="Tibbiy yozuvlar yo'q"
          description="Hali ko'rik yozuvi qo'shilmagan."
          icon={Stethoscope}
        />
      ) : (
        <div className="space-y-4">
          {query.data.map(({ record, prescriptions }) => (
            <Card key={record.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {formatDateTime(record.createdAt)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {record.icdCode && (
                      <Badge variant="secondary">ICD: {record.icdCode}</Badge>
                    )}
                    {record.diagnosis && (
                      <span className="text-sm font-medium text-foreground">
                        {record.diagnosis}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label="Retsept PDF">
                    <a
                      href={`/api/backend/clinic/medical-records/${record.id}/prescription-pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileDown className="h-4 w-4" />
                    </a>
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditRecord(record)}
                      aria-label="Tahrirlash"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {record.complaints && (
                  <Field label="Shikoyatlar" value={record.complaints} />
                )}
                {record.treatment && (
                  <Field label="Davolash" value={record.treatment} />
                )}
                {record.notes && <Field label="Eslatma" value={record.notes} />}

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Retsept
                  </p>
                  <PrescriptionsManager
                    recordId={record.id}
                    items={prescriptions}
                    canManage={canManage}
                    onChanged={invalidate}
                  />
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Biriktirilgan fayllar
                  </p>
                  <DocumentsManager
                    listPath={`/clinic/medical-records/${record.id}/files`}
                    uploadPath={`/clinic/medical-records/${record.id}/files`}
                    categories={EMR_FILE_CATEGORIES}
                    queryKey={`emr-files-${record.id}`}
                    canManage={canManage}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MedicalRecordDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        patientId={patientId}
      />
      <MedicalRecordDialog
        open={!!editRecord}
        onOpenChange={(o) => !o && setEditRecord(null)}
        patientId={patientId}
        record={editRecord}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
