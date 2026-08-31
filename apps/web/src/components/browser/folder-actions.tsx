"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { DeleteFolderDialog } from "@/components/dialogs/delete-folder-dialog";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { useRefreshLocation } from "@/components/browser/use-refresh";
import { folders } from "@/lib/api/endpoints";
import type { FolderListItem } from "@/lib/api/types";

interface FolderActionsProps {
  dataRoomId: string;
  /** The folder currently on screen — where the row lives. */
  parentFolderId: string | null;
  folder: FolderListItem;
  canEdit: boolean;
  /** Only the data room owner may share. */
  canShare: boolean;
}

/** Row menu for folders. Rendered only when the user may edit this location. */
export function FolderActions({
  dataRoomId,
  parentFolderId,
  folder,
  canEdit,
  canShare,
}: FolderActionsProps) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const refresh = useRefreshLocation(dataRoomId);

  const rename = useMutation({
    mutationFn: (name: string) => folders.rename(folder.id, name),
    onSuccess: async (updated) => {
      await refresh(parentFolderId);
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
              aria-label={`Actions for ${folder.name}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-40">
          {canEdit && (
            <DropdownMenuItem onClick={() => setRenaming(true)}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
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
        kind="folder"
        currentName={folder.name}
        onRename={(name) => rename.mutateAsync(name)}
      />

      <DeleteFolderDialog
        open={deleting}
        onOpenChange={setDeleting}
        dataRoomId={dataRoomId}
        parentFolderId={parentFolderId}
        folder={folder}
      />

      {canShare && (
        <ShareDialog
          open={sharing}
          onOpenChange={setSharing}
          resourceType="FOLDER"
          resourceId={folder.id}
          resourceName={folder.name}
        />
      )}
    </>
  );
}
