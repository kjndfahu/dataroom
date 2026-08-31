"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

/**
 * Invalidations after a mutation. Room stats and the move-dialog tree depend on
 * the same data as the listing, so they are refreshed together.
 */
export function useRefreshLocation(dataRoomId: string) {
  const queryClient = useQueryClient();

  return async (folderId: string | null) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.items(dataRoomId, folderId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dataRoom(dataRoomId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dataRoomTree(dataRoomId),
      }),
    ]);
  };
}
