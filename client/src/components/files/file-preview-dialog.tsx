'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFileUrl, apiErrorMessage } from '@/lib/api/client';
import type { FileItem } from '@/types/domain';

function isImage(mime: string) {
  return mime.startsWith('image/');
}
function isPdf(mime: string) {
  return mime === 'application/pdf';
}

/** Fayl preview (rasm/PDF) — signed URL orqali (public URL yo'q). */
export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
}: {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    setUrl(null);
    setErr(null);
    setLoading(true);
    getFileUrl(file.id)
      .then(setUrl)
      .catch((e) => setErr(apiErrorMessage(e, 'Faylni ochib bo`lmadi')))
      .finally(() => setLoading(false));
  }, [open, file]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {file?.originalName ?? 'Fayl'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[300px] items-center justify-center rounded-lg border bg-muted/30">
          {loading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {err && <p className="text-sm text-destructive">{err}</p>}
          {!loading && !err && url && file && (
            <>
              {isImage(file.mimeType) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={file.originalName}
                  className="max-h-[70vh] w-auto rounded-md object-contain"
                />
              )}
              {isPdf(file.mimeType) && (
                <iframe
                  src={url}
                  title={file.originalName}
                  className="h-[70vh] w-full rounded-md"
                />
              )}
              {!isImage(file.mimeType) && !isPdf(file.mimeType) && (
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                  <FileText className="h-10 w-10" />
                  <p className="text-sm">Ushbu turdagi fayl preview qilinmaydi</p>
                </div>
              )}
            </>
          )}
        </div>

        {url && (
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <a href={url} target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4" />
                Yuklab olish
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
