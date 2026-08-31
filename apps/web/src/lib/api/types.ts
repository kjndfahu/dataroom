export type ShareRole = "VIEWER" | "EDITOR" | "OWNER";
export type ResourceType = "DATA_ROOM" | "FOLDER" | "FILE";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface DataRoomSummary {
  id: string;
  name: string;
  role: ShareRole;
  isOwner: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataRoomStats {
  folderCount: number;
  fileCount: number;
  totalSize: number;
}

export interface DataRoomDetail extends DataRoomSummary {
  owner: { id: string; name: string; email: string };
  stats: DataRoomStats;
}

export interface Breadcrumb {
  /** null identifies the data room root. */
  id: string | null;
  name: string;
}

export interface FolderDetail {
  id: string;
  name: string;
  dataRoomId: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  role: ShareRole;
  canEdit: boolean;
  breadcrumbs: Breadcrumb[];
}

export interface FolderListItem {
  id: string;
  type: "folder";
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileListItem {
  id: string;
  type: "file";
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export type ListItem = FolderListItem | FileListItem;

export interface ListingPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface FolderContents {
  folders: ListingPage<FolderListItem>;
  files: ListingPage<FileListItem>;
  canEdit: boolean;
}

export interface FileDetail {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataRoomId: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilePreview {
  url: string;
  name: string;
  size: number;
  expiresIn: number;
}

export interface SubtreeStats {
  folderCount: number;
  fileCount: number;
  totalSize: number;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  parentFolderId: string | null;
}

export type ConflictStrategy = "fail" | "keepBoth";
