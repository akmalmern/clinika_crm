'use client';

import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CreateClinicResult } from '@/types/admin';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Nusxalandi');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm font-medium">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={copy} aria-label="Nusxalash">
        {copied ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

/** Klinika yaratilgach login/parolni ko'rsatadi (admin nusxalab beradi). */
export function CredentialsDialog({
  result,
  open,
  onOpenChange,
}: {
  result: CreateClinicResult | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
            <KeyRound className="h-5 w-5" />
          </div>
          <DialogTitle>Klinika yaratildi</DialogTitle>
          <DialogDescription>
            Ushbu kirish ma&apos;lumotlarini administratorga yetkazing. Parol
            faqat hozir ko&apos;rsatiladi.
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-2">
            <CopyRow label="Klinika" value={result.clinic.name} />
            <CopyRow label="Slug" value={result.clinic.slug} />
            <CopyRow label="Login (email)" value={result.admin.email ?? '—'} />
            {result.admin.temporaryPassword ? (
              <CopyRow label="Parol" value={result.admin.temporaryPassword} />
            ) : (
              <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                Parol siz kiritgan qiymat bilan o&apos;rnatildi.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Yopish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
