import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.js';

export interface PresignedUpload {
  url: string;
  storageKey: string;
  expiresIn: number;
}

/**
 * Thin wrapper over the S3-compatible bucket. Credentials never leave the API:
 * the browser only ever receives short-lived presigned URLs.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  /** Signs URLs for the browser; identical to `client` unless the public
   *  endpoint differs from the internal one. */
  private readonly signer: S3Client;
  private readonly bucket: string;
  private readonly urlTtl: number;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.urlTtl = config.get('S3_URL_TTL', { infer: true });

    const credentials = {
      accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
      secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
    };
    const region = config.get('S3_REGION', { infer: true });

    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region,
      forcePathStyle: true,
      credentials,
    });

    // A presigned URL is signed for one specific host, so when the browser
    // reaches storage at a different address it needs its own signer.
    const publicEndpoint = config.get('S3_PUBLIC_ENDPOINT', { infer: true });
    this.signer = publicEndpoint
      ? new S3Client({
          endpoint: publicEndpoint,
          region,
          forcePathStyle: true,
          credentials,
        })
      : this.client;
  }

  /** Storage keys are generated, never derived from user-supplied file names. */
  buildStorageKey(dataRoomId: string): string {
    return `dataroom/${dataRoomId}/${randomUUID()}`;
  }

  async createUploadUrl(
    dataRoomId: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    const storageKey = this.buildStorageKey(dataRoomId);

    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: contentType,
      }),
      { expiresIn: this.urlTtl },
    );

    return { url, storageKey, expiresIn: this.urlTtl };
  }

  createDownloadUrl(
    storageKey: string,
    options: { fileName: string; inline: boolean },
  ): Promise<string> {
    const disposition = options.inline ? 'inline' : 'attachment';

    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ResponseContentType: 'application/pdf',
        ResponseContentDisposition: `${disposition}; filename="${sanitizeHeaderValue(options.fileName)}"`,
      }),
      { expiresIn: this.urlTtl },
    );
  }

  /** Confirms an upload actually landed, and reports its real size and type. */
  async statObject(
    storageKey: string,
  ): Promise<{ size: number; contentType: string } | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );

      return {
        size: head.ContentLength ?? 0,
        contentType: head.ContentType ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  /** Reads the first bytes of an object, used to verify the real file type. */
  async readPrefix(storageKey: string, length: number): Promise<Buffer | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Range: `bytes=0-${length - 1}`,
        }),
      );

      const bytes = await object.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  /**
   * Best-effort removal. Storage failures must not block the database delete,
   * so unremoved keys are logged loudly instead of thrown.
   */
  async deleteObjects(storageKeys: string[]): Promise<{ failed: string[] }> {
    const failed: string[] = [];

    for (let index = 0; index < storageKeys.length; index += 1000) {
      const batch = storageKeys.slice(index, index + 1000);

      try {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        );

        for (const error of result.Errors ?? []) {
          if (error.Key) failed.push(error.Key);
        }
      } catch (error) {
        failed.push(...batch);
        this.logger.error(
          `Failed to delete ${batch.length} storage objects`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (failed.length > 0) {
      this.logger.warn(
        `Orphaned storage objects left behind: ${failed.join(', ')}`,
      );
    }

    return { failed };
  }
}

/** Keeps quotes and control characters out of the Content-Disposition header. */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\w .()-]/g, '_');
}
