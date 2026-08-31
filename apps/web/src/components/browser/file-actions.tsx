"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FolderInput,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { MoveFileDialog } from "@/components/dialogs/move-file-dialog";
import { DeleteFileDialog } from "@/components/dialogs/delete-file-dialog";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { useRefreshLocation } from "@/components/browser/use-refresh";
import { files as filesApi } from "@/lib/api/endpoints";
import type { ConflictStrategy, FileListItem } from "@/lib/api/types";

interface FileActionsProps {
  dataRoomId: string;
  folderId: string | null;
  file: FileListItem;
  canEdit: boolean;
  /** Only the data room owner may share. */
  canShare: boolean;
}

/** Row menu for files — only rendered where the API grants edit rights. */
export function FileActions({
  dataRoomId,
  folderId,
  file,
  canEdit,
  canShare,
}: FileActionsProps) {
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const refresh = useRefreshLocation(dataRoomId);

  const rename = useMutation({
    mutationFn: (input: { name: string; onConflict?: ConflictStrategy }) =>
      filesApi.rename(file.id, input.name, input.onConflict),
    onSuccess: async (updated) => {
      await refresh(folderId);
      toast.success(`Renamed to “${updated.name}”`);
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${file.name}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-40">
          {canEdit && (
            <>
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMoving(true)}>
                <FolderInput className="size-4" />
                Move
              </DropdownMenuItem>
            </>
          )}
          {canShare && (
            <DropdownMenuItem onClick={() => setSharing(true)}>
              <Share2 className="size-4" />
              Share
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        kind="file"
        currentName={file.name}
        onRename={(name, onConflict) =>
          rename.mutateAsync({ name, onConflict })
        }
      />

      <MoveFileDialog
        open={moving}
        onOpenChange={setMoving}
        dataRoomId={dataRoomId}
        currentFolderId={folderId}
        file={file}
      />

      <DeleteFileDialog
        open={deleting}
        onOpenChange={setDeleting}
        dataRoomId={dataRoomId}
        folderId={folderId}
        file={file}
      />

      {canShare && (
        <ShareDialog
          open={sharing}
          onOpenChange={setSharing}
          resourceType="FILE"
          resourceId={file.id}
          resourceName={file.name}
        />
      )}
    </>
  );
}
