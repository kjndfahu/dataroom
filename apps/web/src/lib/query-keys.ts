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
  filePreview: (id: string) => ["file", id, "preview"] as const,
};
