"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
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
import { dataRooms } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export function CreateDataRoomDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const create = useMutation({
    mutationFn: (value: string) => dataRooms.create(value),
    onSuccess: async (room) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dataRooms });
      toast.success(`“${room.name}” created`);
      setOpen(false);
      setName("");
      router.push(`/dataroom/${room.id}`);
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const trimmed = name.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (create.isPending) return;
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        New data room
      </DialogTrigger>

      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (!trimmed) {
              setError("Enter a name for the data room.");
              return;
            }
            create.mutate(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>New data room</DialogTitle>
            <DialogDescription>
              A separate space with its own folders, files and sharing.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Field id="dataroom-name" label="Name" error={error ?? undefined}>
              <Input
                id="dataroom-name"
                autoFocus
                value={name}
                maxLength={100}
                placeholder="Acquisition Data Room"
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !trimmed}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
