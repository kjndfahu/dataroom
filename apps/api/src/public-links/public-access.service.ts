import { Injectable, NotFoundException } from '@nestjs/common';
import type { ResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { ListingService, type FolderContents } from '../folders/listing.service.js';
import { FilesService } from '../files/files.service.js';
import type { BreadcrumbEntry } from '../folders/folders.service.js';

export interface PublicResource {
  resourceType: ResourceType;
  name: string;
  dataRoomId: string;
  /** Folder the public browser starts in; null means the data room root. */
  rootFolderId: string | null;
  /** Set only for single-file links. */
  fileId: string | null;
}

export interface PublicView extends PublicResource {
  breadcrumbs: BreadcrumbEntry[];
}

/**
 * Everything a link holder may do, kept apart from the signed-in authorization
 * path: there is no user here, only a token and the subtree it covers.
 */
@Injectable()
export class PublicAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly listing: ListingService,
    private readonly files: FilesService,
  ) {}

  /** Resolves the token, rejecting links that are disabled or expired. */
  async resolve(token: string): Promise<PublicResource> {
    const link = await this.prisma.publicLink.findUnique({
      where: { token },
      include: {
        dataRoom: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, dataRoomId: true } },
        file: { select: { id: true, name: true, dataRoomId: true } },
      },
    });

    const unavailable = new NotFoundException(
      'This link is invalid or no longer available.',
    );

    if (!link || !link.active) throw unavailable;
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw unavailable;
    }

    switch (link.resourceType) {
      case 'DATA_ROOM':
        if (!link.dataRoom) throw unavailable;
        return {
          resourceType: 'DATA_ROOM',
          name: link.dataRoom.name,
          dataRoomId: link.dataRoom.id,
          rootFolderId: null,
          fileId: null,
        };

      case 'FOLDER':
        if (!link.folder) throw unavailable;
        return {
          resourceType: 'FOLDER',
          name: link.folder.name,
          dataRoomId: link.folder.dataRoomId,
          rootFolderId: link.folder.id,
          fileId: null,
        };

      case 'FILE':
        if (!link.file) throw unavailable;
        return {
          resourceType: 'FILE',
          name: link.file.name,
          dataRoomId: link.file.dataRoomId,
          rootFolderId: null,
          fileId: link.file.id,
        };
    }
  }

  /** The landing view: what the link points at, plus its breadcrumb root. */
  async view(token: string, folderId?: string): Promise<PublicView> {
    const resource = await this.resolve(token);

    if (!folderId) {
      return {
        ...resource,
        breadcrumbs: [{ id: resource.rootFolderId, name: resource.name }],
      };
    }

    await this.assertFolderInScope(resource, folderId);

    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, name: true },
    });
    if (!folder) throw new NotFoundException('That folder no longer exists.');

    return {
      ...resource,
      name: folder.name,
      breadcrumbs: await this.breadcrumbsWithinScope(resource, folderId),
    };
  }

  /** Read-only listing; canEdit is always false for link holders. */
  async listItems(
    token: string,
    folderId: string | undefined,
    cursors: { folderCursor?: string; fileCursor?: string; limit?: number },
  ): Promise<FolderContents> {
    const resource = await this.resolve(token);

    if (resource.resourceType === 'FILE') {
      throw new NotFoundException('This link points at a single file.');
    }

    const target = folderId ?? resource.rootFolderId;
    if (target) await this.assertFolderInScope(resource, target);

    return this.listing.list(resource.dataRoomId, target, cursors, false);
  }

  async previewFile(
    token: string,
    fileId: string,
  ): Promise<{ url: string; name: string; size: number; expiresIn: number }> {
    const resource = await this.resolve(token);

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        name: true,
        size: true,
        storageKey: true,
        folderId: true,
        dataRoomId: true,
      },
    });

    if (!file) throw new NotFoundException('That file no longer exists.');
    await this.assertFileInScope(resource, file);

    return this.files.previewUrlFor(file);
  }

  // ── scope checks ──────────────────────────────────────────────────────────

  /**
   * A shared folder covers its whole subtree, so a folder is in scope when the
   * shared folder appears in its ancestry.
   */
  private async assertFolderInScope(
    resource: PublicResource,
    folderId: string,
  ): Promise<void> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, dataRoomId: true },
    });

    const outOfScope = new NotFoundException(
      'That folder is not part of this link.',
    );

    if (!folder || folder.dataRoomId !== resource.dataRoomId) throw outOfScope;
    if (resource.resourceType === 'DATA_ROOM') return;
    if (resource.resourceType === 'FILE') throw outOfScope;

    const ancestry = await this.authorization.folderAncestry(folderId);
    if (!ancestry.includes(resource.rootFolderId!)) throw outOfScope;
  }

  private async assertFileInScope(
    resource: PublicResource,
    file: { id: string; dataRoomId: string; folderId: string | null },
  ): Promise<void> {
    const outOfScope = new NotFoundException(
      'That file is not part of this link.',
    );

    if (resource.resourceType === 'FILE') {
      if (resource.fileId !== file.id) throw outOfScope;
      return;
    }

    if (file.dataRoomId !== resource.dataRoomId) throw outOfScope;
    if (resource.resourceType === 'DATA_ROOM') return;

    if (!file.folderId) throw outOfScope;
    await this.assertFolderInScope(resource, file.folderId);
  }

  /** Breadcrumbs stop at the shared root — nothing above it is revealed. */
  private async breadcrumbsWithinScope(
    resource: PublicResource,
    folderId: string,
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

    if (resource.resourceType === 'DATA_ROOM') {
      return [
        { id: null, name: resource.name },
        ...rows.map((row) => ({ id: row.id, name: row.name })),
      ];
    }

    const rootIndex = rows.findIndex((row) => row.id === resource.rootFolderId);
    return rows
      .slice(rootIndex === -1 ? 0 : rootIndex)
      .map((row) => ({ id: row.id, name: row.name }));
  }
}
