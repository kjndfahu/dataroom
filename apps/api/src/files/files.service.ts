import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { buildUniqueName, normalizeName, splitExtension } from '../common/naming.js';
import { canEdit } from '../authorization/access.types.js';
import type { Env } from '../config/env.js';

export const PDF_MIME_TYPE = 'application/pdf';
const PDF_MAGIC_BYTES = '%PDF-';

export interface FileDetail {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataRoomId: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConflictStrategy = 'fail' | 'keepBoth';

@Injectable()
export class FilesService {
  private readonly maxFileSize: number;
  private readonly urlTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly authorization: AuthorizationService,
    config: ConfigService<Env, true>,
  ) {
    this.maxFileSize = config.get('MAX_FILE_SIZE', { infer: true });
    this.urlTtl = config.get('S3_URL_TTL', { infer: true });
  }

  /**
   * Step 1 of an upload: check permissions and constraints, then hand back a
   * short-lived presigned PUT. No database row is created yet, so an upload the
   * user abandons leaves nothing behind but an unreferenced object.
   */
  async createUploadUrl(
    userId: string,
    input: {
      dataRoomId: string;
      folderId?: string | null;
      fileName: string;
      size: number;
      mimeType: string;
    },
  ): Promise<{
    uploadUrl: string;
    storageKey: string;
    expiresIn: number;
    nameTaken: boolean;
    suggestedName: string;
  }> {
    const folderId = input.folderId ?? null;
    await this.requireWritableLocation(userId, input.dataRoomId, folderId);

    const name = this.validateUpload(input.fileName, input.size, input.mimeType);

    const taken = await this.takenNames(input.dataRoomId, folderId);
    const upload = await this.storage.createUploadUrl(
      input.dataRoomId,
      PDF_MIME_TYPE,
    );

    return {
      uploadUrl: upload.url,
      storageKey: upload.storageKey,
      expiresIn: upload.expiresIn,
      // Lets the client warn about a clash before spending bandwidth.
      nameTaken: taken.has(name),
      suggestedName: buildUniqueName(name, taken),
    };
  }

  /**
   * Step 2: the browser finished uploading. The object is verified against what
   * was promised — existence, size and real PDF magic bytes — before a row is
   * created, so a failed or spoofed upload never becomes a file.
   */
  async confirmUpload(
    userId: string,
    input: {
      dataRoomId: string;
      folderId?: string | null;
      storageKey: string;
      fileName: string;
      onConflict?: ConflictStrategy;
    },
  ): Promise<FileDetail> {
    const folderId = input.folderId ?? null;
    await this.requireWritableLocation(userId, input.dataRoomId, folderId);
    this.assertKeyBelongsToDataRoom(input.storageKey, input.dataRoomId);

    const alreadyUsed = await this.prisma.file.findUnique({
      where: { storageKey: input.storageKey },
      select: { id: true },
    });
    if (alreadyUsed) {
      throw new ConflictException('This upload was already saved.');
    }

    const object = await this.storage.statObject(input.storageKey);
    if (!object) {
      throw new BadRequestException(
        'The upload did not finish. Please try again.',
      );
    }

    const name = this.validateUpload(
      input.fileName,
      object.size,
      object.contentType,
    );
    await this.assertReallyPdf(input.storageKey);

    const taken = await this.takenNames(input.dataRoomId, folderId);
    const finalName = this.resolveName(name, taken, input.onConflict ?? 'fail');

    const file = await this.prisma.file.create({
      data: {
        name: finalName,
        originalName: input.fileName.trim(),
        mimeType: PDF_MIME_TYPE,
        size: BigInt(object.size),
        storageKey: input.storageKey,
        dataRoomId: input.dataRoomId,
        folderId,
        uploadedById: userId,
      },
    });

    return toFileDetail(file);
  }

  async findOne(userId: string, fileId: string): Promise<FileDetail & { canEdit: boolean }> {
    const grant = await this.authorization.requireFileRead(userId, fileId);
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('That file no longer exists.');

    return { ...toFileDetail(file), canEdit: canEdit(grant) };
  }

  /** A short-lived inline URL; the bucket itself stays private. */
  async createPreviewUrl(
    userId: string,
    fileId: string,
  ): Promise<{ url: string; name: string; size: number; expiresIn: number }> {
    await this.authorization.requireFileRead(userId, fileId);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('That file no longer exists.');

    return this.previewUrlFor(file);
  }

  /** Shared with the public-link flow once access has been established. */
  async previewUrlFor(file: {
    storageKey: string;
    name: string;
    size: bigint;
  }): Promise<{ url: string; name: string; size: number; expiresIn: number }> {
    const url = await this.storage.createDownloadUrl(file.storageKey, {
      fileName: file.name,
      inline: true,
    });

    return {
      url,
      name: file.name,
      size: Number(file.size),
      expiresIn: this.urlTtl,
    };
  }

  async rename(
    userId: string,
    fileId: string,
    rawName: string,
    onConflict: ConflictStrategy = 'fail',
  ): Promise<FileDetail> {
    await this.authorization.requireFileEdit(userId, fileId);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('That file no longer exists.');

    const name = ensurePdfExtension(normalizeName(rawName));
    if (name === file.name) return toFileDetail(file);

    const taken = await this.takenNames(file.dataRoomId, file.folderId, file.id);
    const finalName = this.resolveName(name, taken, onConflict);

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { name: finalName },
    });

    return toFileDetail(updated);
  }

  /** Moves a file to another folder (or the root) inside the same data room. */
  async move(
    userId: string,
    fileId: string,
    targetFolderId: string | null,
    onConflict: ConflictStrategy = 'fail',
  ): Promise<FileDetail> {
    await this.authorization.requireFileEdit(userId, fileId);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('That file no longer exists.');

    if (file.folderId === targetFolderId) return toFileDetail(file);

    await this.requireWritableLocation(userId, file.dataRoomId, targetFolderId);

    const taken = await this.takenNames(file.dataRoomId, targetFolderId);
    const finalName = this.resolveName(file.name, taken, onConflict);

    const moved = await this.prisma.file.update({
      where: { id: fileId },
      data: { folderId: targetFolderId, name: finalName },
    });

    return toFileDetail(moved);
  }

  /**
   * Storage object first, then the row: a failed blob delete is logged rather
   * than leaving a row the user can see but not open.
   */
  async remove(
    userId: string,
    fileId: string,
  ): Promise<{ id: string; orphanedObjects: number }> {
    await this.authorization.requireFileEdit(userId, fileId);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('That file no longer exists.');

    const { failed } = await this.storage.deleteObjects([file.storageKey]);
    await this.prisma.file.delete({ where: { id: fileId } });

    return { id: fileId, orphanedObjects: failed.length };
  }

  /**
   * Called when the user cancels after the bytes have already landed, so the
   * bucket does not accumulate objects no row will ever point at.
   */
  async discardUpload(userId: string, storageKey: string): Promise<void> {
    const dataRoomId = parseDataRoomFromKey(storageKey);
    if (!dataRoomId) throw new BadRequestException('Unknown upload.');

    await this.authorization.requireDataRoomEdit(userId, dataRoomId);

    const claimed = await this.prisma.file.findUnique({
      where: { storageKey },
      select: { id: true },
    });
    if (claimed) {
      throw new ConflictException('This upload is already saved as a file.');
    }

    await this.storage.deleteObjects([storageKey]);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Editing a location means editing the folder, or the room when at root. */
  private async requireWritableLocation(
    userId: string,
    dataRoomId: string,
    folderId: string | null,
  ): Promise<void> {
    if (!folderId) {
      await this.authorization.requireDataRoomEdit(userId, dataRoomId);
      return;
    }

    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { dataRoomId: true },
    });

    if (!folder || folder.dataRoomId !== dataRoomId) {
      throw new NotFoundException('That folder no longer exists.');
    }

    await this.authorization.requireFolderEdit(userId, folderId);
  }

  private validateUpload(
    fileName: string,
    size: number,
    mimeType: string,
  ): string {
    const name = normalizeName(fileName);

    if (!name.toLowerCase().endsWith('.pdf')) {
      throw new UnsupportedMediaTypeException('Only PDF files can be uploaded.');
    }

    if (mimeType !== PDF_MIME_TYPE) {
      throw new UnsupportedMediaTypeException('Only PDF files can be uploaded.');
    }

    if (size <= 0) {
      throw new BadRequestException('The file is empty.');
    }

    if (size > this.maxFileSize) {
      throw new PayloadTooLargeException(
        `Files must be ${Math.floor(this.maxFileSize / 1024 / 1024)} MB or smaller.`,
      );
    }

    return name;
  }

  /** A declared MIME type is client input; the bytes are not. */
  private async assertReallyPdf(storageKey: string): Promise<void> {
    const prefix = await this.storage.readPrefix(
      storageKey,
      PDF_MAGIC_BYTES.length,
    );

    if (prefix?.toString('latin1') !== PDF_MAGIC_BYTES) {
      await this.storage.deleteObjects([storageKey]);
      throw new UnsupportedMediaTypeException(
        'That file is not a valid PDF document.',
      );
    }
  }

  private async takenNames(
    dataRoomId: string,
    folderId: string | null,
    excludeFileId?: string,
  ): Promise<Set<string>> {
    const files = await this.prisma.file.findMany({
      where: {
        dataRoomId,
        folderId,
        ...(excludeFileId ? { id: { not: excludeFileId } } : {}),
      },
      select: { name: true },
    });

    return new Set(files.map((file) => file.name));
  }

  /** "fail" surfaces the clash to the UI; "keepBoth" numbers the new copy. */
  private resolveName(
    name: string,
    taken: Set<string>,
    strategy: ConflictStrategy,
  ): string {
    if (!taken.has(name)) return name;

    if (strategy === 'keepBoth') return buildUniqueName(name, taken);

    throw new ConflictException({
      code: 'ALREADY_EXISTS',
      message: `“${name}” already exists in this folder.`,
      details: { suggestedName: buildUniqueName(name, taken) },
    });
  }

  /** Stops a caller from attaching an object that belongs to another room. */
  private assertKeyBelongsToDataRoom(
    storageKey: string,
    dataRoomId: string,
  ): void {
    if (parseDataRoomFromKey(storageKey) !== dataRoomId) {
      throw new BadRequestException('Unknown upload.');
    }
  }
}

/** Renaming must not turn a PDF into an extension-less file. */
function ensurePdfExtension(name: string): string {
  const [, extension] = splitExtension(name);
  return extension.toLowerCase() === '.pdf' ? name : `${name}.pdf`;
}

function parseDataRoomFromKey(storageKey: string): string | null {
  const match = /^dataroom\/([0-9a-f-]{36})\/[0-9a-f-]{36}$/.exec(storageKey);
  return match?.[1] ?? null;
}

export function toFileDetail(file: {
  id: string;
  name: string;
  mimeType: string;
  size: bigint;
  dataRoomId: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FileDetail {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size),
    dataRoomId: file.dataRoomId,
    folderId: file.folderId,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}
