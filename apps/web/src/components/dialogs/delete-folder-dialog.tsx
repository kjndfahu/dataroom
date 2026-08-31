"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefreshLocation } from "@/components/browser/use-refresh";
import { folders } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { formatBytes, pluralize } from "@/lib/format";

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataRoomId: string;
  /** Location to refresh once the folder is gone. */
  parentFolderId: string | null;
  folder: { id: string; name: string };
  onDeleted?: () => void;
}

/**
 * Destructive and irreversible, so the dialog spells out exactly what goes:
 * counts come from the API's subtree query rather than from what is on screen.
 */
export function DeleteFolderDialog({
  open,
  onOpenChange,
  dataRoomId,
  parentFolderId,
  folder,
  onDeleted,
}: DeleteFolderDialogProps) {
  const refresh = useRefreshLocation(dataRoomId);

  const stats = useQuery({
    queryKey: queryKeys.folderStats(folder.id),
    queryFn: () => folders.stats(folder.id),
    enabled: open,
  });

  const remove = useMutation({
    mutationFn: () => folders.remove(folder.id),
    onSuccess: async (result) => {
      await refresh(parentFolderId);
      toast.success(`“${folder.name}” deleted`);

      if (result.orphanedObjects > 0) {
        toast.warning(
          `${pluralize(result.orphanedObjects, "stored file")} could not be removed from storage and will be cleaned up later.`,
        );
      }

      onOpenChange(false);
      onDeleted?.();
    },
    onError: (cause) => toast.error(errorMessage(cause)),
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="truncate">
            Delete “{folder.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="text-sm">
          {stats.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : stats.isError ? (
            <p className="text-muted-foreground">
              Everything inside this folder. The exact contents could not be
              counted.
            </p>
          ) : (
            <ul className="text-muted-foreground space-y-1">
              <li>• {pluralize(stats.data.folderCount, "folder")}</li>
              <li>• {pluralize(stats.data.fileCount, "file")}</li>
              <li>• {formatBytes(stats.data.totalSize)} of data</li>
            </ul>
          )}
          <p className="text-foreground mt-4 font-medium">
            This action cannot be undone.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending && <Loader2 className="size-4 animate-spin" />}
            {remove.isPending ? "Deleting…" : "Delete folder"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
