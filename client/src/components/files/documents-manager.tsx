'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FileDropzone } from './file-dropzone';
import { FilePreviewDialog } from './file-preview-dialog';
import { apiDelete, apiErrorMessage, apiGet, apiUpload } from '@/lib/api/client';
import {
  ACCEPTED_FILE_TYPES,
  FILE_CATEGORY_LABEL,
} from '@/lib/constants';
import { formatDate, formatFileSize } from '@/lib/format';
import type { FileItem } from '@/types/domain';

/**
 * Hujjatlar bo'limi (bemor/xodim/EMR): kategoriya tanlash + drag&drop yuklash +
 * ro'yxat (preview/yuklab olish/o'chirish). Fayllar signed URL orqali ochiladi.
 */
export function DocumentsManager({
  listPath,
  uploadPath,
  deletePath,
  categories,
  queryKey,
  canManage,
}: {
  listPath: string;
  uploadPath: string;
  deletePath?: (fileId: string) => string;
  categories: string[];
  queryKey: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [category, setCategory] = useState(categories[0]);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [toDelete, setToDelete] = useState<FileItem | null>(null);

  const query = useQuery({
    queryKey: [queryKey],
    queryFn: () => apiGet<FileItem[]>(listPath),
  });

  const upload = useMutation({
    mutationFn: (file: File) => apiUpload(uploadPath, file, { category }),
    onSuccess: () => {
      toast.success('Fayl yuklandi');
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Yuklab bo`lmadi')),
  });

  const remove = useMutation({
    mutationFn: (fileId: string) =>
      deletePath ? apiDelete(deletePath(fileId)) : Promise.resolve(null),
    onSuccess: () => {
      toast.success("Fayl o'chirildi");
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  async function handleFiles(files: File[]) {
    for (const f of files) {
      await upload.mutateAsync(f);
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Hujjat turi</p>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {FILE_CATEGORY_LABEL[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <FileDropzone
              onFiles={handleFiles}
              accept={ACCEPTED_FILE_TYPES}
              multiple
              disabled={upload.isPending}
            />
            {upload.isPending && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      )}

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState title="Hujjatlar yo'q" description="Hali fayl biriktirilmagan." />
      ) : (
        <ul className="divide-y rounded-lg border">
          {query.data.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {f.mimeType.startsWith('image/') ? (
                  <ImageIcon className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(f.size)} · {formatDate(f.createdAt)}
                </p>
              </div>
              <Badge variant="outline">
                {FILE_CATEGORY_LABEL[f.category] ?? f.category}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreview(f)}
                aria-label="Ko'rish"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {canManage && deletePath && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setToDelete(f)}
                  aria-label="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <FilePreviewDialog
        file={preview}
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Faylni o'chirish"
        description={toDelete?.originalName}
        onConfirm={() => toDelete && remove.mutateAsync(toDelete.id)}
      />
    </div>
  );
}
