"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { ConflictStrategy } from "@/lib/api/types";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "folder" | "file";
  currentName: string;
  onRename: (name: string, onConflict?: ConflictStrategy) => Promise<unknown>;
}

/**
 * Rename with conflict resolution: a clashing name is never applied silently.
 * When the API offers an alternative ("contract (1).pdf") it is offered as a
 * one-click choice; otherwise the user simply picks another name.
 */
export function RenameDialog({
  open,
  onOpenChange,
  kind,
  currentName,
  onRename,
}: RenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so the form always starts from the
            current name without syncing state in an effect. */}
        {open && (
          <RenameForm
            kind={kind}
            currentName={currentName}
            onRename={onRename}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  kind,
  currentName,
  onRename,
  onDone,
}: {
  kind: "folder" | "file";
  currentName: string;
  onRename: (name: string, onConflict?: ConflictStrategy) => Promise<unknown>;
  onDone: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const rename = useMutation({
    mutationFn: (input: { value: string; strategy?: ConflictStrategy }) =>
      onRename(input.value, input.strategy),
    onSuccess: onDone,
    onError: (cause) => {
      if (cause instanceof ApiError && cause.isConflict) {
        setSuggestion(cause.suggestedName ?? null);
        setError(cause.message);
        return;
      }
      setSuggestion(null);
      setError(errorMessage(cause));
    },
  });

  const trimmed = name.trim();
  const unchanged = trimmed === currentName;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuggestion(null);
        if (!trimmed) {
          setError("Enter a name.");
          return;
        }
        rename.mutate({ value: trimmed });
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename {kind}</DialogTitle>
        <DialogDescription className="truncate">
          Currently “{currentName}”.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-4">
        <Field id="rename-input" label="New name" error={error ?? undefined}>
          <Input
            id="rename-input"
            autoFocus
            value={name}
            maxLength={255}
            disabled={rename.isPending}
            aria-invalid={Boolean(error)}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        {suggestion && (
          <div className="bg-muted/60 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm">
            <span className="text-muted-foreground">Keep both as</span>
            <span className="font-medium">“{suggestion}”</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="ml-auto"
              disabled={rename.isPending}
              onClick={() =>
                rename.mutate({ value: trimmed, strategy: "keepBoth" })
              }
            >
              Keep both
            </Button>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={rename.isPending}
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={rename.isPending || !trimmed || unchanged}
        >
          {rename.isPending && <Loader2 className="size-4 animate-spin" />}
          {rename.isPending ? "Renaming…" : "Rename"}
        </Button>
      </DialogFooter>
    </form>
  );
}
