"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/browser/breadcrumbs";
import { ItemTable, ItemTableSkeleton } from "@/components/browser/item-table";
import { useFolderContents } from "@/components/browser/use-folder-contents";
import { PdfPreviewDialog } from "@/components/files/pdf-preview-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dataRooms, folders as foldersApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { formatBytes, pluralize } from "@/lib/format";
import type { FileListItem } from "@/lib/api/types";

interface BrowserViewProps {
  dataRoomId: string;
  /** null renders the root of the data room. */
  folderId: string | null;
}

export function BrowserView({ dataRoomId, folderId }: BrowserViewProps) {
  const router = useRouter();
  const [previewFile, setPreviewFile] = useState<FileListItem | null>(null);

  const room = useQuery({
    queryKey: queryKeys.dataRoom(dataRoomId),
    queryFn: () => dataRooms.get(dataRoomId),
  });

  const folder = useQuery({
    queryKey: queryKeys.folder(folderId ?? "root"),
    queryFn: () => foldersApi.get(folderId!),
    enabled: Boolean(folderId),
  });

  const contents = useFolderContents(dataRoomId, folderId);

  // A folder can vanish while it is on screen — fall back to the room root.
  const folderGone =
    folder.error instanceof ApiError && folder.error.isAccessProblem;

  useEffect(() => {
    if (!folderGone) return;
    toast.error("That folder is no longer available.");
    router.replace(`/dataroom/${dataRoomId}`);
  }, [folderGone, router, dataRoomId]);

  if (room.isError) {
    const denied = room.error instanceof ApiError && room.error.isAccessProblem;
    return (
      <div className="p-6">
        <ErrorState
          title={denied ? "This data room is not available" : "Could not load this data room"}
          description={
            denied
              ? "It was deleted, or your access to it was removed."
              : "The server did not respond. Try again in a moment."
          }
          onRetry={denied ? undefined : () => void room.refetch()}
          action={
            denied ? (
              <Button onClick={() => router.replace("/dashboard")}>
                Back to data rooms
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const isLoadingHeader = room.isPending || (Boolean(folderId) && folder.isPending);
  const trail = folderId
    ? (folder.data?.breadcrumbs ?? [])
    : [{ id: null, name: room.data?.name ?? "" }];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="space-y-3">
        {isLoadingHeader ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : (
          <>
            <Breadcrumbs dataRoomId={dataRoomId} trail={trail} />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {folderId ? folder.data?.name : room.data?.name}
                </h1>
                {room.data && !folderId && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {pluralize(room.data.stats.folderCount, "folder")} ·{" "}
                    {pluralize(room.data.stats.fileCount, "file")} ·{" "}
                    {formatBytes(room.data.stats.totalSize)}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {contents.isPending ? (
        <ItemTableSkeleton />
      ) : contents.isError ? (
        <ErrorState
          title="Could not load these items"
          description="The list failed to load. Try again in a moment."
          onRetry={contents.refetch}
        />
      ) : contents.folders.length === 0 && contents.files.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="size-8" />}
          title="This folder is empty"
          description={
            contents.canEdit
              ? "Upload a PDF or create a folder to get started."
              : "Nothing has been added here yet."
          }
        />
      ) : (
        <div className="space-y-4">
          <ItemTable
            dataRoomId={dataRoomId}
            folders={contents.folders}
            files={contents.files}
            onOpenFile={setPreviewFile}
          />

          {contents.hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={contents.loadMore}
                disabled={contents.isLoadingMore}
              >
                {contents.isLoadingMore && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {contents.isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}

      <PdfPreviewDialog
        file={previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />
    </div>
  );
}
