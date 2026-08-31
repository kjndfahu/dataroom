import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ShareRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { canEdit } from '../authorization/access.types.js';
import { normalizeName } from '../common/naming.js';

export interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

export interface FolderDetail {
  id: string;
  name: string;
  dataRoomId: string;
  parentFolderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: ShareRole;
  canEdit: boolean;
  /** Root-first path, starting with the data room itself (id: null). */
  breadcrumbs: BreadcrumbEntry[];
}

export interface SubtreeStats {
  folderCount: number;
  fileCount: number;
  totalSize: number;
}

@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly authorization: AuthorizationService,
  ) {}

  async create(
    userId: string,
    input: { dataRoomId: string; parentFolderId?: string | null; name: string },
  ): Promise<FolderDetail> {
    const name = normalizeName(input.name);
    const parentFolderId = input.parentFolderId ?? null;

    // Editing rights come from the destination: the parent folder if there is
    // one, otherwise the data room itself.
    if (parentFolderId) {
      const parent = await this.prisma.folder.findUnique({
        where: { id: parentFolderId },
        select: { dataRoomId: true },
      });

      if (!parent || parent.dataRoomId !== input.dataRoomId) {
        throw new NotFoundException('That folder no longer exists.');
      }

      await this.authorization.requireFolderEdit(userId, parentFolderId);
    } else {
      await this.authorization.requireDataRoomEdit(userId, input.dataRoomId);
    }

    await this.assertNameIsFree(input.dataRoomId, parentFolderId, name);

    const folder = await this.prisma.folder.create({
      data: { name, dataRoomId: input.dataRoomId, parentFolderId },
    });

    return this.findOne(userId, folder.id);
  }

  async findOne(userId: string, folderId: string): Promise<FolderDetail> {
    const grant = await this.authorization.requireFolderRead(userId, folderId);

    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: { dataRoom: { select: { name: true } } },
    });
    if (!folder) throw new NotFoundException('That folder no longer exists.');

    return {
      id: folder.id,
      name: folder.name,
      dataRoomId: folder.dataRoomId,
      parentFolderId: folder.parentFolderId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      role: grant.role,
      canEdit: canEdit(grant),
      breadcrumbs: await this.breadcrumbs(folder.id, folder.dataRoom.name),
    };
  }

  async rename(
    userId: string,
    folderId: string,
    rawName: string,
  ): Promise<FolderDetail> {
    await this.authorization.requireFolderEdit(userId, folderId);
    const name = normalizeName(rawName);

    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { dataRoomId: true, parentFolderId: true, name: true },
    });
    if (!folder) throw new NotFoundException('That folder no longer exists.');

    if (folder.name !== name) {
      await this.assertNameIsFree(
        folder.dataRoomId,
        folder.parentFolderId,
        name,
      );
      await this.prisma.folder.update({ where: { id: folderId }, data: { name } });
    }

    return this.findOne(userId, folderId);
  }

  /**
   * Deletes the folder with everything below it.
   *
   * Storage objects go first: a failure there is logged and tolerated (the keys
   * are reported), while deleting rows first could leave files that are visible
   * in the UI but missing from the bucket.
   */
  async remove(
    userId: string,
    folderId: string,
  ): Promise<{ deleted: SubtreeStats; orphanedObjects: number }> {
    await this.authorization.requireFolderEdit(userId, folderId);

    const stats = await this.subtreeStats(userId, folderId);
    const storageKeys = await this.descendantStorageKeys(folderId);

    const { failed } = await this.storage.deleteObjects(storageKeys);

    // Folder rows cascade to nested folders and files.
    await this.prisma.folder.delete({ where: { id: folderId } });

    if (failed.length > 0) {
      this.logger.warn(
        `Deleted folder ${folderId} but ${failed.length} storage objects remain`,
      );
    }

    return { deleted: stats, orphanedObjects: failed.length };
  }

  /** Totals for the delete confirmation dialog, over the whole subtree. */
  async subtreeStats(userId: string, folderId: string): Promise<SubtreeStats> {
    await this.authorization.requireFolderRead(userId, folderId);

    const [row] = await this.prisma.$queryRaw<
      Array<{ folder_count: bigint; file_count: bigint; total_size: bigint }>
    >`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "Folder" WHERE id = ${folderId}
        UNION ALL
        SELECT child.id
        FROM "Folder" child
        JOIN subtree parent ON child."parentFolderId" = parent.id
      )
      SELECT
        (SELECT COUNT(*) FROM subtree) - 1            AS folder_count,
        COALESCE(COUNT(f.id), 0)                      AS file_count,
        COALESCE(SUM(f.size), 0)                      AS total_size
      FROM subtree
      LEFT JOIN "File" f ON f."folderId" = subtree.id
    `;

    return {
      folderCount: Number(row?.folder_count ?? 0),
      fileCount: Number(row?.file_count ?? 0),
      totalSize: Number(row?.total_size ?? 0),
    };
  }

  /**
   * Flat list of every folder in the room, for the move dialog. Flat rather
   * than nested so the client can build the tree without a recursive payload.
   */
  async tree(
    userId: string,
    dataRoomId: string,
  ): Promise<{
    folders: Array<{ id: string; name: string; parentFolderId: string | null }>;
    canEdit: boolean;
  }> {
    const grant = await this.authorization.requireDataRoomRead(
      userId,
      dataRoomId,
    );

    const folders = await this.prisma.folder.findMany({
      where: { dataRoomId },
      select: { id: true, name: true, parentFolderId: true },
      orderBy: { name: 'asc' },
    });

    return { folders, canEdit: canEdit(grant) };
  }

  /** Data room root → … → this folder. */
  async breadcrumbs(
    folderId: string,
    dataRoomName: string,
  ): Promise<BreadcrumbEntry[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; depth: number }>
    >`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, "parentFolderId", 0 AS depth
        FROM "Folder"
        WHERE id = ${folderId}
        UNION ALL
        SELECT parent.id, parent.name, parent."parentFolderId", child.depth + 1
        FROM "Folder" parent
        JOIN ancestors child ON parent.id = child."parentFolderId"
      )
      SELECT id, name, depth FROM ancestors ORDER BY depth DESC
    `;

    return [
      { id: null, name: dataRoomName },
      ...rows.map((row) => ({ id: row.id, name: row.name })),
    ];
  }

  /** Storage keys of every file in the subtree, for blob cleanup. */
  private async descendantStorageKeys(folderId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ storageKey: string }>>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "Folder" WHERE id = ${folderId}
        UNION ALL
        SELECT child.id
        FROM "Folder" child
        JOIN subtree parent ON child."parentFolderId" = parent.id
      )
      SELECT f."storageKey"
      FROM "File" f
      JOIN subtree ON f."folderId" = subtree.id
    `;

    return rows.map((row) => row.storageKey);
  }

  /**
   * The database enforces this too (unique index with NULLS NOT DISTINCT);
   * checking first turns a constraint violation into a helpful message.
   */
  private async assertNameIsFree(
    dataRoomId: string,
    parentFolderId: string | null,
    name: string,
  ): Promise<void> {
    const clash = await this.prisma.folder.findFirst({
      where: { dataRoomId, parentFolderId, name },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(
        `A folder named “${name}” already exists here.`,
      );
    }
  }

}
