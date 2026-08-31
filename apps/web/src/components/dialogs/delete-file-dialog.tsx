"use client";

import { useMutation } from "@tanstack/react-query";
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
import { useRefreshLocation } from "@/components/browser/use-refresh";
import { files as filesApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/client";

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataRoomId: string;
  folderId: string | null;
  file: { id: string; name: string };
  onDeleted?: () => void;
}

export function DeleteFileDialog({
  open,
  onOpenChange,
  dataRoomId,
  folderId,
  file,
  onDeleted,
}: DeleteFileDialogProps) {
  const refresh = useRefreshLocation(dataRoomId);

  const remove = useMutation({
    mutationFn: () => filesApi.remove(file.id),
    onSuccess: async (result) => {
      await refresh(folderId);
      toast.success(`“${file.name}” deleted`);

      if (result.orphanedObjects > 0) {
        toast.warning(
          "The stored copy could not be removed and will be cleaned up later.",
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
            Delete “{file.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This file will be permanently deleted, including the stored
            document. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

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
            {remove.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
