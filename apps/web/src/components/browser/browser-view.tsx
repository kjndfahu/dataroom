"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/browser/breadcrumbs";
import { ItemTable, ItemTableSkeleton } from "@/components/browser/item-table";
import { useFolderContents } from "@/components/browser/use-folder-contents";
import { PdfPreviewDialog } from "@/components/files/pdf-preview-dialog";
import { FolderActions } from "@/components/browser/folder-actions";
import { FileActions } from "@/components/browser/file-actions";
import { CreateFolderDialog } from "@/components/dialogs/create-folder-dialog";
import { ShareDialog } from "@/components/sharing/share-dialog";
import {
  UploadButton,
  UploadDropzone,
} from "@/components/upload/upload-dropzone";
import { UploadQueue } from "@/components/upload/upload-queue";
import { useUploadQueue } from "@/components/upload/use-upload-queue";
import { useRefreshLocation } from "@/components/browser/use-refresh";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dataRooms, folders as foldersApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { formatBytes, pluralize } from "@/lib/format";
import type { Breadcrumb, FileListItem } from "@/lib/api/types";

interface BrowserViewProps {
  dataRoomId: string;
  /** null renders the root of the data room. */
  folderId: string | null;
}

export function BrowserView({ dataRoomId, folderId }: BrowserViewProps) {
  const router = useRouter();
  const [previewFile, setPreviewFile] = useState<FileListItem | null>(null);
  const [sharing, setSharing] = useState(false);

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
  const refresh = useRefreshLocation(dataRoomId);

  const uploads = useUploadQueue({
    dataRoomId,
    folderId,
    onUploaded: () => void refresh(folderId),
  });

  // A folder can vanish, or its share be revoked, while it is on screen.
  const folderGone =
    folder.error instanceof ApiError && folder.error.isAccessProblem;

  // With room access there is a sensible place to land; without it (a folder
  // shared on its own, now revoked) staying put with an explanation is better
  // than bouncing into another error.
  const canFallBackToRoom = room.isSuccess;

  useEffect(() => {
    if (!folderGone || !canFallBackToRoom) return;
    toast.error("That folder is no longer available.");
    router.replace(`/dataroom/${dataRoomId}`);
  }, [folderGone, canFallBackToRoom, router, dataRoomId]);

  if (folderGone && !canFallBackToRoom) {
    return (
      <div className="p-6">
        <ErrorState
          title="Access revoked"
          description="You no longer have access to this folder."
          action={
            <Button onClick={() => router.replace("/dashboard")}>
              Back to data rooms
            </Button>
          }
        />
      </div>
    );
  }

  // Someone with a folder-level share can open the folder but not the room, so
  // the room query failing is only fatal when the room itself is the target.
  const primaryFailed = folderId ? folder.isError : room.isError;

  if (primaryFailed) {
    const error = folderId ? folder.error : room.error;
    const denied = error instanceof ApiError && error.isAccessProblem;

    return (
      <div className="p-6">
        <ErrorState
          title={denied ? "This is no longer available" : "Something went wrong"}
          description={
            denied
              ? "It was deleted, or your access to it was removed."
              : "The server did not respond. Try again in a moment."
          }
          onRetry={
            denied
              ? undefined
              : () => void (folderId ? folder.refetch() : room.refetch())
          }
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

  const isLoadingHeader = folderId ? folder.isPending : room.isPending;
  // The API decides: viewers never receive edit rights, so no controls render.
  const canEdit = folderId ? (folder.data?.canEdit ?? false) : contents.canEdit;
  // Only the owner may share, and only owners get the OWNER role back.
  const canShare = folderId
    ? folder.data?.role === "OWNER"
    : (room.data?.isOwner ?? false);
  const roomReachable = room.isSuccess;

  const trail: Breadcrumb[] = folderId
    ? (folder.data?.breadcrumbs ?? [])
    : [{ id: null, name: room.data?.name ?? "" }];

  const hrefFor = (entry: Breadcrumb) => {
    if (entry.id) return `/dataroom/${dataRoomId}/folder/${entry.id}`;
    // Without room access the root crumb is a label, not a dead link.
    return roomReachable ? `/dataroom/${dataRoomId}` : null;
  };

  return (
    <UploadDropzone disabled={!canEdit} onFiles={uploads.enqueue}>
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
              <Breadcrumbs trail={trail} hrefFor={hrefFor} />
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

                <div className="flex flex-wrap items-center gap-2">
                  {canEdit && (
                    <>
                      <CreateFolderDialog
                        dataRoomId={dataRoomId}
                        parentFolderId={folderId}
                      />
                      <UploadButton onFiles={uploads.enqueue} />
                    </>
                  )}
                  {canShare && (
                    <Button variant="outline" onClick={() => setSharing(true)}>
                      <Share2 className="size-4" />
                      Share
                    </Button>
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
              canEdit
                ? "Drop a PDF here, or use Upload and New folder above."
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
              renderFolderActions={
                canEdit || canShare
                  ? (item) => (
                      <FolderActions
                        dataRoomId={dataRoomId}
                        parentFolderId={folderId}
                        folder={item}
                        canEdit={canEdit}
                        canShare={canShare}
                      />
                    )
                  : undefined
              }
              renderFileActions={
                canEdit || canShare
                  ? (item) => (
                      <FileActions
                        dataRoomId={dataRoomId}
                        folderId={folderId}
                        file={item}
                        canEdit={canEdit}
                        canShare={canShare}
                      />
                    )
                  : undefined
              }
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

        {canShare && (
          <ShareDialog
            open={sharing}
            onOpenChange={setSharing}
            resourceType={folderId ? "FOLDER" : "DATA_ROOM"}
            resourceId={folderId ?? dataRoomId}
            resourceName={
              (folderId ? folder.data?.name : room.data?.name) ?? "this item"
            }
          />
        )}

        <UploadQueue
          items={uploads.items}
          onRetry={uploads.retry}
          onKeepBoth={uploads.keepBoth}
          onCancel={uploads.cancel}
          onDismiss={uploads.dismiss}
          onClearFinished={uploads.clearFinished}
        />
      </div>
    </UploadDropzone>
  );
}
