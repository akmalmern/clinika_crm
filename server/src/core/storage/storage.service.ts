import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinioConfig } from '../../config/configuration';

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  size?: number;
}

/**
 * S3-mos object storage servisi (MinIO yoki AWS S3). AWS SDK v3 ishlatadi —
 * shuning uchun MinIO'dan AWS S3'ga o'tish faqat .env (endpoint/keys) o'zgarishi
 * (spec 11 — File moduli alohida chiqarilishi oson). Fayllarning o'zi shu yerda;
 * bazada faqat metadata. O'qish FAQAT signed URL orqali (public URL YO'Q, spec 6.4).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<MinioConfig>('minio');
    this.bucket = cfg.bucket;
    const protocol = cfg.useSsl ? 'https' : 'http';
    this.client = new S3Client({
      endpoint: `${protocol}://${cfg.endpoint}:${cfg.port}`,
      region: 'us-east-1', // MinIO uchun ahamiyatsiz, lekin SDK talab qiladi
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
      forcePathStyle: true, // MinIO path-style talab qiladi
    });
  }

  /** Ilova ko'tarilganda bucket mavjudligini ta'minlaydi (yo'q bo'lsa yaratadi). */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket tayyor: ${this.bucket}`);
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Bucket yaratildi: ${this.bucket}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Storage hali tayyor bo'lmasligi mumkin — ilovani bloklamaymiz, loglaymiz.
        this.logger.warn(`Bucket tekshirib/yaratib bo'lmadi: ${msg}`);
      }
    }
  }

  /** Faylni yuklaydi (server orqali, validatsiyadan keyin). */
  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.size,
      }),
    );
  }

  /** Object'ni storage'dan o'chiradi (cleanup / delete). */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Vaqtinchalik (muddatli) signed download URL. public URL EMAS — faqat shu havola
   * orqali, belgilangan muddat ichida ochiladi (spec 6.3/6.4).
   * downloadName berilsa — brauzer shu nom bilan yuklab oladi.
   */
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
    downloadName?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(downloadName
        ? {
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
              downloadName,
            )}"`,
          }
        : {}),
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }
}
