import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ShareRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AccessGrant, ROLE_RANK, canEdit } from './access.types.js';

/**
 * The single place that answers "may this user touch this resource?".
 *
 * Access comes from two sources:
 *   1. owning the data room, which grants everything inside it;
 *   2. an active share on the resource itself or on any ancestor container.
 *
 * Shares are never duplicated per descendant — a folder share is resolved by
 * walking the folder's ancestry at query time.
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── data rooms ────────────────────────────────────────────────────────────

  async resolveDataRoomAccess(
    userId: string,
    dataRoomId: string,
  ): Promise<AccessGrant | null> {
    const dataRoom = await this.prisma.dataRoom.findUnique({
      where: { id: dataRoomId },
      select: { id: true, ownerId: true },
    });
    if (!dataRoom) return null;

    if (dataRoom.ownerId === userId) {
      return { role: 'OWNER', isOwner: true, dataRoomId: dataRoom.id };
    }

    const role = await this.bestSharedRole(userId, { dataRoomId: dataRoom.id });
    return role ? { role, isOwner: false, dataRoomId: dataRoom.id } : null;
  }

  canReadDataRoom(userId: string, dataRoomId: string): Promise<boolean> {
    return this.resolveDataRoomAccess(userId, dataRoomId).then(Boolean);
  }

  async canEditDataRoom(userId: string, dataRoomId: string): Promise<boolean> {
    const grant = await this.resolveDataRoomAccess(userId, dataRoomId);
    return grant ? canEdit(grant) : false;
  }

  requireDataRoomRead(userId: string, dataRoomId: string): Promise<AccessGrant> {
    return this.require(this.resolveDataRoomAccess(userId, dataRoomId), 'read');
  }

  requireDataRoomEdit(userId: string, dataRoomId: string): Promise<AccessGrant> {
    return this.require(this.resolveDataRoomAccess(userId, dataRoomId), 'edit');
  }

  // ── folders ───────────────────────────────────────────────────────────────

  async resolveFolderAccess(
    userId: string,
    folderId: string,
  ): Promise<AccessGrant | null> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, dataRoomId: true, dataRoom: { select: { ownerId: true } } },
    });
    if (!folder) return null;

    if (folder.dataRoom.ownerId === userId) {
      return { role: 'OWNER', isOwner: true, dataRoomId: folder.dataRoomId };
    }

    const ancestry = await this.folderAncestry(folder.id);
    const role = await this.bestSharedRole(userId, {
      dataRoomId: folder.dataRoomId,
      folderIds: ancestry,
    });

    return role ? { role, isOwner: false, dataRoomId: folder.dataRoomId } : null;
  }

  canReadFolder(userId: string, folderId: string): Promise<boolean> {
    return this.resolveFolderAccess(userId, folderId).then(Boolean);
  }

  async canEditFolder(userId: string, folderId: string): Promise<boolean> {
    const grant = await this.resolveFolderAccess(userId, folderId);
    return grant ? canEdit(grant) : false;
  }

  requireFolderRead(userId: string, folderId: string): Promise<AccessGrant> {
    return this.require(this.resolveFolderAccess(userId, folderId), 'read');
  }

  requireFolderEdit(userId: string, folderId: string): Promise<AccessGrant> {
    return this.require(this.resolveFolderAccess(userId, folderId), 'edit');
  }

  // ── files ─────────────────────────────────────────────────────────────────

  async resolveFileAccess(
    userId: string,
    fileId: string,
  ): Promise<AccessGrant | null> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        folderId: true,
        dataRoomId: true,
        dataRoom: { select: { ownerId: true } },
      },
    });
    if (!file) return null;

    if (file.dataRoom.ownerId === userId) {
      return { role: 'OWNER', isOwner: true, dataRoomId: file.dataRoomId };
    }

    const ancestry = file.folderId
      ? await this.folderAncestry(file.folderId)
      : [];

    const role = await this.bestSharedRole(userId, {
      dataRoomId: file.dataRoomId,
      folderIds: ancestry,
      fileId: file.id,
    });

    return role ? { role, isOwner: false, dataRoomId: file.dataRoomId } : null;
  }

  canReadFile(userId: string, fileId: string): Promise<boolean> {
    return this.resolveFileAccess(userId, fileId).then(Boolean);
  }

  async canEditFile(userId: string, fileId: string): Promise<boolean> {
    const grant = await this.resolveFileAccess(userId, fileId);
    return grant ? canEdit(grant) : false;
  }

  requireFileRead(userId: string, fileId: string): Promise<AccessGrant> {
    return this.require(this.resolveFileAccess(userId, fileId), 'read');
  }

  requireFileEdit(userId: string, fileId: string): Promise<AccessGrant> {
    return this.require(this.resolveFileAccess(userId, fileId), 'edit');
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /**
   * Folder ids from the given folder up to the data room root, inclusive.
   * One recursive query instead of a walk with a query per level.
   */
  async folderAncestry(folderId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE ancestors AS (
        SELECT id, "parentFolderId"
        FROM "Folder"
        WHERE id = ${folderId}::uuid
        UNION ALL
        SELECT parent.id, parent."parentFolderId"
        FROM "Folder" parent
        JOIN ancestors child ON parent.id = child."parentFolderId"
      )
      SELECT id FROM ancestors
    `;

    return rows.map((row) => row.id);
  }

  /** Highest role granted to the user by any active share covering the resource. */
  private async bestSharedRole(
    userId: string,
    resource: { dataRoomId: string; folderIds?: string[]; fileId?: string },
  ): Promise<ShareRole | null> {
    const targets: Array<Record<string, unknown>> = [
      { resourceType: 'DATA_ROOM', dataRoomId: resource.dataRoomId },
    ];

    if (resource.folderIds?.length) {
      targets.push({
        resourceType: 'FOLDER',
        folderId: { in: resource.folderIds },
      });
    }

    if (resource.fileId) {
      targets.push({ resourceType: 'FILE', fileId: resource.fileId });
    }

    const shares = await this.prisma.share.findMany({
      where: {
        recipientUserId: userId,
        revokedAt: null,
        OR: targets,
      },
      select: { role: true },
    });

    if (shares.length === 0) return null;

    return shares.reduce<ShareRole>(
      (best, share) =>
        ROLE_RANK[share.role] > ROLE_RANK[best] ? share.role : best,
      'VIEWER',
    );
  }

  /**
   * Missing and invisible resources are both reported as 404 so the API never
   * confirms that someone else's data room exists.
   */
  private async require(
    lookup: Promise<AccessGrant | null>,
    level: 'read' | 'edit',
  ): Promise<AccessGrant> {
    const grant = await lookup;

    if (!grant) {
      throw new NotFoundException('This item does not exist or was removed.');
    }

    if (level === 'edit' && !canEdit(grant)) {
      throw new ForbiddenException('You have read-only access to this item.');
    }

    return grant;
  }
}
