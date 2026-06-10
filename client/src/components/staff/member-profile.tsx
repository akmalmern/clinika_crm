'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState, LoadingState } from '@/components/common/states';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { AvatarUploader } from '@/components/files/avatar-uploader';
import { DocumentsManager } from '@/components/files/documents-manager';
import { apiDelete, apiErrorMessage, apiGet } from '@/lib/api/client';
import { STAFF_DOC_CATEGORIES } from '@/lib/constants';
import { roleLabel } from '@/lib/auth/labels';
import { formatDate } from '@/lib/format';
import type { Member } from '@/types/domain';
import { MemberFormDialog } from './member-form-dialog';

export function MemberProfile({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const query = useQuery({
    queryKey: ['member', id],
    queryFn: () => apiGet<Member>(`/clinic/members/${id}`),
  });

  const remove = useMutation({
    mutationFn: () => apiDelete(`/clinic/members/${id}`),
    onSuccess: () => {
      toast.success("Xodim o'chirildi");
      qc.invalidateQueries({ queryKey: ['members'] });
      router.push('/clinic/staff');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState onRetry={() => query.refetch()} />;

  const m = query.data;
  const info: { label: string; value: string }[] = [
    { label: 'Rol', value: roleLabel(m.role) },
    { label: 'Email', value: m.email ?? '—' },
    { label: 'Telefon', value: m.phone ?? '—' },
    { label: 'Lavozim', value: m.position ?? '—' },
    { label: 'Mutaxassislik', value: m.specialization ?? '—' },
    { label: "Qo'shilgan", value: formatDate(m.createdAt) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{m.fullName}</h1>
              <Badge variant={m.isActive ? 'success' : 'secondary'}>
                {m.isActive ? 'Faol' : 'Nofaol'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{roleLabel(m.role)}</p>
          </div>
        </div>
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
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Ma&apos;lumot</TabsTrigger>
          <TabsTrigger value="docs">Rasm va hujjatlar</TabsTrigger>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-6">
                <AvatarUploader
                  avatarFileId={m.avatarFileId}
                  fullName={m.fullName}
                  uploadPath={`/clinic/members/${id}/avatar`}
                  canManage
                  onUploaded={() =>
                    qc.invalidateQueries({ queryKey: ['member', id] })
                  }
                />
                <p className="text-sm font-medium">{m.fullName}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <DocumentsManager
                  listPath={`/clinic/members/${id}/documents`}
                  uploadPath={`/clinic/members/${id}/documents`}
                  deletePath={(fid) => `/clinic/members/${id}/documents/${fid}`}
                  categories={STAFF_DOC_CATEGORIES}
                  queryKey={`member-docs-${id}`}
                  canManage
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <MemberFormDialog open={editOpen} onOpenChange={setEditOpen} member={m} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Xodimni o'chirish"
        description={`${m.fullName} o'chiriladi.`}
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  );
}
