import { apiFetch } from "./client";
import type {
  ConflictStrategy,
  PublicLinkSummary,
  PublicView,
  ReceivedShare,
  ResourceType,
  ShareSummary,
  DataRoomDetail,
  DataRoomSummary,
  FileDetail,
  FilePreview,
  FolderContents,
  FolderDetail,
  FolderTreeNode,
  SessionUser,
  SubtreeStats,
} from "./types";

export const auth = {
  me: () => apiFetch<SessionUser>("/auth/me"),

  login: (body: { email: string; password: string }) =>
    apiFetch<SessionUser>("/auth/login", { method: "POST", body }),

  register: (body: { email: string; name: string; password: string }) =>
    apiFetch<SessionUser>("/auth/register", { method: "POST", body }),

  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
};

export const dataRooms = {
  list: () =>
    apiFetch<{ owned: DataRoomSummary[]; shared: DataRoomSummary[] }>(
      "/datarooms",
    ),

  get: (id: string) => apiFetch<DataRoomDetail>(`/datarooms/${id}`),

  create: (name: string) =>
    apiFetch<DataRoomSummary>("/datarooms", { method: "POST", body: { name } }),

  items: (id: string, cursors?: { folderCursor?: string; fileCursor?: string }) =>
    apiFetch<FolderContents>(`/datarooms/${id}/items${query(cursors)}`),

  tree: (id: string) =>
    apiFetch<{ folders: FolderTreeNode[]; canEdit: boolean }>(
      `/datarooms/${id}/tree`,
    ),
};

export const folders = {
  get: (id: string) => apiFetch<FolderDetail>(`/folders/${id}`),

  items: (id: string, cursors?: { folderCursor?: string; fileCursor?: string }) =>
    apiFetch<FolderContents>(`/folders/${id}/items${query(cursors)}`),

  stats: (id: string) => apiFetch<SubtreeStats>(`/folders/${id}/stats`),

  create: (body: {
    dataRoomId: string;
    parentFolderId?: string | null;
    name: string;
  }) =>
    apiFetch<FolderDetail>("/folders", {
      method: "POST",
      body: {
        dataRoomId: body.dataRoomId,
        name: body.name,
        ...(body.parentFolderId ? { parentFolderId: body.parentFolderId } : {}),
      },
    }),

  rename: (id: string, name: string) =>
    apiFetch<FolderDetail>(`/folders/${id}`, { method: "PATCH", body: { name } }),

  remove: (id: string) =>
    apiFetch<{ deleted: SubtreeStats; orphanedObjects: number }>(
      `/folders/${id}`,
      { method: "DELETE" },
    ),
};

export const files = {
  get: (id: string) =>
    apiFetch<FileDetail & { canEdit: boolean }>(`/files/${id}`),

  preview: (id: string) => apiFetch<FilePreview>(`/files/${id}/preview`),

  createUploadUrl: (body: {
    dataRoomId: string;
    folderId?: string | null;
    fileName: string;
    size: number;
    mimeType: string;
  }) =>
    apiFetch<{
      uploadUrl: string;
      storageKey: string;
      expiresIn: number;
      nameTaken: boolean;
      suggestedName: string;
    }>("/files/upload-url", {
      method: "POST",
      body: {
        dataRoomId: body.dataRoomId,
        fileName: body.fileName,
        size: body.size,
        mimeType: body.mimeType,
        ...(body.folderId ? { folderId: body.folderId } : {}),
      },
    }),

  confirmUpload: (body: {
    dataRoomId: string;
    folderId?: string | null;
    storageKey: string;
    fileName: string;
    onConflict?: ConflictStrategy;
  }) =>
    apiFetch<FileDetail>("/files", {
      method: "POST",
      body: {
        dataRoomId: body.dataRoomId,
        storageKey: body.storageKey,
        fileName: body.fileName,
        ...(body.folderId ? { folderId: body.folderId } : {}),
        ...(body.onConflict ? { onConflict: body.onConflict } : {}),
      },
    }),

  discardUpload: (storageKey: string) =>
    apiFetch<void>("/files/discard", { method: "POST", body: { storageKey } }),

  rename: (id: string, name: string, onConflict?: ConflictStrategy) =>
    apiFetch<FileDetail>(`/files/${id}`, {
      method: "PATCH",
      body: { name, ...(onConflict ? { onConflict } : {}) },
    }),

  move: (id: string, folderId: string | null, onConflict?: ConflictStrategy) =>
    apiFetch<FileDetail>(`/files/${id}/move`, {
      method: "POST",
      body: { folderId, ...(onConflict ? { onConflict } : {}) },
    }),

  remove: (id: string) =>
    apiFetch<{ id: string; orphanedObjects: number }>(`/files/${id}`, {
      method: "DELETE",
    }),
};

export const shares = {
  list: (resourceType: ResourceType, resourceId: string) =>
    apiFetch<ShareSummary[]>(
      `/shares${query({ resourceType, resourceId })}`,
    ),

  received: () => apiFetch<ReceivedShare[]>("/shares/received"),

  create: (body: {
    resourceType: ResourceType;
    resourceId: string;
    email: string;
  }) => apiFetch<ShareSummary>("/shares", { method: "POST", body }),

  revoke: (id: string) => apiFetch<void>(`/shares/${id}`, { method: "DELETE" }),
};

export const publicLinks = {
  list: (resourceType: ResourceType, resourceId: string) =>
    apiFetch<PublicLinkSummary[]>(
      `/public-links${query({ resourceType, resourceId })}`,
    ),

  create: (body: { resourceType: ResourceType; resourceId: string }) =>
    apiFetch<PublicLinkSummary>("/public-links", { method: "POST", body }),

  revoke: (id: string) =>
    apiFetch<void>(`/public-links/${id}`, { method: "DELETE" }),
};

/** Anonymous browsing of a shared resource; no session is involved. */
export const publicShare = {
  view: (token: string, folderId?: string) =>
    apiFetch<PublicView>(
      `/public/${encodeURIComponent(token)}${query({ folderId })}`,
    ),

  items: (
    token: string,
    params?: { folderId?: string; folderCursor?: string; fileCursor?: string },
  ) =>
    apiFetch<FolderContents>(
      `/public/${encodeURIComponent(token)}/items${query(params)}`,
    ),

  preview: (token: string, fileId: string) =>
    apiFetch<FilePreview>(
      `/public/${encodeURIComponent(token)}/files/${fileId}/preview`,
    ),
};

function query(params?: Record<string, string | undefined>): string {
  if (!params) return "";

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}
