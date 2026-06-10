'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, apiUpload, getFileUrl } from '@/lib/api/client';
import { ACCEPTED_IMAGE_TYPES } from '@/lib/constants';
import { initials } from '@/lib/utils';

async function croppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const out = 512;
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas xatosi');
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    out,
    out,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Blob xatosi'))),
      'image/jpeg',
      0.9,
    ),
  );
}

/**
 * Avatar ko'rsatish + yuklash (crop bilan). Joriy rasm signed URL orqali. Yuklash:
 * fayl tanlash -> kvadrat crop -> blob -> backend avatar endpoint. localStorage yo'q.
 */
export function AvatarUploader({
  avatarFileId,
  fullName,
  uploadPath,
  onUploaded,
  canManage,
}: {
  avatarFileId: string | null;
  fullName: string;
  uploadPath: string;
  onUploaded: () => void;
  canManage: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);

  const avatarUrl = useQuery({
    queryKey: ['file-url', avatarFileId],
    queryFn: () => getFileUrl(avatarFileId as string),
    enabled: !!avatarFileId,
    staleTime: 60_000,
  });

  function onSelect(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result?.toString() ?? '');
      setOpen(true);
    };
    reader.readAsDataURL(file);
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const c = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
      width,
      height,
    );
    setCrop(c);
  }

  async function save() {
    if (!imgRef.current || !completed?.width) {
      toast.error('Iltimos, rasmni belgilang');
      return;
    }
    try {
      setUploading(true);
      const blob = await croppedBlob(imgRef.current, completed);
      await apiUpload(uploadPath, blob, undefined, 'avatar.jpg');
      toast.success('Rasm yangilandi');
      setOpen(false);
      setImgSrc('');
      onUploaded();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Rasmni yuklab bo`lmadi'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
          {avatarFileId && avatarUrl.data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl.data}
              alt={fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(fullName)
          )}
        </div>
        {canManage && (
          <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-secondary text-secondary-foreground shadow hover:bg-secondary/80">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              className="hidden"
              onChange={(e) => {
                onSelect(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setImgSrc('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rasmni qirqish</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompleted(c)}
                aspect={1}
                circularCrop
                keepSelection
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Qirqish"
                  onLoad={onImageLoad}
                  className="max-h-[60vh] w-auto"
                />
              </ReactCrop>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Bekor qilish
            </Button>
            <Button onClick={save} disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
