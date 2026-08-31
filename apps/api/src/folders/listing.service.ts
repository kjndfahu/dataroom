import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { canEdit } from '../authorization/access.types.js';

export interface FolderListItem {
  id: string;
  type: 'folder';
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileListItem {
  id: string;
  type: 'file';
  name: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface FolderContents {
  folders: ListingPage<FolderListItem>;
  files: ListingPage<FileListItem>;
  canEdit: boolean;
}

export interface ListQuery {
  folderCursor?: string;
  fileCursor?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Lists the direct children of one location — never the whole subtree.
 *
 * Folders and files are paginated independently: they are separate tables with
 * separate cursors, which keeps each page a single indexed range scan.
 */
@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async listDataRoomRoot(
    userId: string,
    dataRoomId: string,
    query: ListQuery,
  ): Promise<FolderContents> {
    const grant = await this.authorization.requireDataRoomRead(
      userId,
      dataRoomId,
    );

    return this.list(dataRoomId, null, query, canEdit(grant));
  }

  async listFolder(
    userId: string,
    folderId: string,
    query: ListQuery,
  ): Promise<FolderContents> {
    const grant = await this.authorization.requireFolderRead(userId, folderId);

    return this.list(grant.dataRoomId, folderId, query, canEdit(grant));
  }

  /** Shared by the authenticated and public listings once access is settled. */
  async list(
    dataRoomId: string,
    folderId: string | null,
    query: ListQuery,
    editable: boolean,
  ): Promise<FolderContents> {
    const take = clampLimit(query.limit);

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { dataRoomId, parentFolderId: folderId },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: take + 1,
        ...cursorOf(query.folderCursor),
      }),
      this.prisma.file.findMany({
        where: { dataRoomId, folderId },
        select: {
          id: true,
          name: true,
          size: true,
          mimeType: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: take + 1,
        ...cursorOf(query.fileCursor),
      }),
    ]);

    const folderPage = paginate(folders, take);
    const filePage = paginate(files, take);

    return {
      folders: {
        items: folderPage.items.map((folder) => ({
          ...folder,
          type: 'folder' as const,
        })),
        nextCursor: folderPage.nextCursor,
      },
      files: {
        items: filePage.items.map((file) => ({
          ...file,
          type: 'file' as const,
          size: Number(file.size),
        })),
        nextCursor: filePage.nextCursor,
      },
      canEdit: editable,
    };
  }
}

function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

/** The cursor is the last id of the previous page. */
function cursorOf(
  cursor: string | undefined,
): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

function paginate<T extends { id: string }>(
  rows: T[],
  take: number,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= take) return { items: rows, nextCursor: null };

  const items = rows.slice(0, take);
  return { items, nextCursor: items[items.length - 1]?.id ?? null };
}
