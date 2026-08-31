"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useRefreshLocation } from "@/components/browser/use-refresh";
import { folders } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/client";

interface CreateFolderDialogProps {
  dataRoomId: string;
  parentFolderId: string | null;
}

export function CreateFolderDialog({
  dataRoomId,
  parentFolderId,
}: CreateFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = useRefreshLocation(dataRoomId);

  const create = useMutation({
    mutationFn: (value: string) =>
      folders.create({ dataRoomId, parentFolderId, name: value }),
    onSuccess: async (folder) => {
      await refresh(parentFolderId);
      toast.success(`Folder “${folder.name}” created`);
      close();
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  function close() {
    setOpen(false);
    setName("");
    setError(null);
  }

  const trimmed = name.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (create.isPending) return;
        next ? setOpen(true) : close();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <FolderPlus className="size-4" />
        New folder
      </DialogTrigger>

      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (!trimmed) {
              setError("Enter a folder name.");
              return;
            }
            create.mutate(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Folders can be nested as deeply as you need.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Field id="folder-name" label="Name" error={error ?? undefined}>
              <Input
                id="folder-name"
                autoFocus
                value={name}
                maxLength={255}
                placeholder="Financials"
                disabled={create.isPending}
                aria-invalid={Boolean(error)}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !trimmed}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              {create.isPending ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
