/** Central list of cache keys so invalidations stay consistent. */
export const queryKeys = {
  session: ["session"] as const,
  dataRooms: ["datarooms"] as const,
  dataRoom: (id: string) => ["dataroom", id] as const,
  dataRoomTree: (id: string) => ["dataroom", id, "tree"] as const,
  folder: (id: string) => ["folder", id] as const,
  folderStats: (id: string) => ["folder", id, "stats"] as const,
  /** Items of one location: the room root when folderId is null. */
  items: (dataRoomId: string, folderId: string | null) =>
    ["items", dataRoomId, folderId ?? "root"] as const,
  file: (id: string) => ["file", id] as const,
  shares: (resourceType: string, resourceId: string) =>
    ["shares", resourceType, resourceId] as const,
  receivedShares: ["shares", "received"] as const,
  publicLinks: (resourceType: string, resourceId: string) =>
    ["public-links", resourceType, resourceId] as const,
  publicView: (token: string, folderId: string | null) =>
    ["public", token, folderId ?? "root"] as const,
  publicItems: (token: string, folderId: string | null) =>
    ["public", token, "items", folderId ?? "root"] as const,
  filePreview: (id: string) => ["file", id, "preview"] as const,
};
