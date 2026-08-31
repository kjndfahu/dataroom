"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { dataRooms, folders } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query-keys";
import type { FileListItem, FolderContents, FolderListItem } from "@/lib/api/types";

interface Cursors {
  folderCursor?: string;
  fileCursor?: string;
}

/**
 * Loads one location's direct children, page by page.
 *
 * Folders and files carry independent cursors, so a page may repeat the first
 * slice of whichever list is already exhausted; results are keyed by id to
 * absorb that instead of complicating the API.
 */
export function useFolderContents(
  dataRoomId: string,
  folderId: string | null,
  options: { enabled?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.items(dataRoomId, folderId),
    enabled: options.enabled ?? true,
    initialPageParam: {} as Cursors,
    queryFn: ({ pageParam }) =>
      folderId
        ? folders.items(folderId, pageParam)
        : dataRooms.items(dataRoomId, pageParam),
    getNextPageParam: (lastPage: FolderContents) => {
      const next: Cursors = {};
      if (lastPage.folders.nextCursor) next.folderCursor = lastPage.folders.nextCursor;
      if (lastPage.files.nextCursor) next.fileCursor = lastPage.files.nextCursor;
      return next.folderCursor ?? next.fileCursor ? next : undefined;
    },
  });

  const pages = query.data?.pages ?? [];

  return {
    folders: dedupe(pages.flatMap((page) => page.folders.items)),
    files: dedupe(pages.flatMap((page) => page.files.items)),
    canEdit: pages[0]?.canEdit ?? false,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  };
}

function dedupe<T extends FolderListItem | FileListItem>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(item.id, item);
  return [...seen.values()];
}
