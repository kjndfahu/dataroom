"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRefreshLocation } from "@/components/browser/use-refresh";
import { dataRooms, files as filesApi } from "@/lib/api/endpoints";
import { ApiError, errorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { FolderTreeNode } from "@/lib/api/types";

interface MoveFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataRoomId: string;
  /** Where the file lives now, so that location refreshes too. */
  currentFolderId: string | null;
  file: { id: string; name: string };
}

interface TreeEntry extends FolderTreeNode {
  depth: number;
}

export function MoveFileDialog({
  open,
  onOpenChange,
  dataRoomId,
  currentFolderId,
  file,
}: MoveFileDialogProps) {
  const [target, setTarget] = useState<string | null>(currentFolderId);
  const [conflict, setConflict] = useState<string | null>(null);
  const refresh = useRefreshLocation(dataRoomId);

  useEffect(() => {
    if (open) {
      setTarget(currentFolderId);
      setConflict(null);
    }
  }, [open, currentFolderId]);

  const tree = useQuery({
    queryKey: queryKeys.dataRoomTree(dataRoomId),
    queryFn: () => dataRooms.tree(dataRoomId),
    enabled: open,
  });

  const entries = useMemo(
    () => flatten(tree.data?.folders ?? []),
    [tree.data?.folders],
  );

  const move = useMutation({
    mutationFn: (input: { folderId: string | null; keepBoth?: boolean }) =>
      filesApi.move(
        file.id,
        input.folderId,
        input.keepBoth ? "keepBoth" : undefined,
      ),
    onSuccess: async (moved) => {
      await Promise.all([refresh(currentFolderId), refresh(moved.folderId)]);
      toast.success(`Moved “${moved.name}”`);
      onOpenChange(false);
    },
    onError: (cause) => {
      if (cause instanceof ApiError && cause.isConflict) {
        setConflict(cause.suggestedName ?? null);
        return;
      }
      toast.error(errorMessage(cause));
    },
  });

  const unchanged = target === currentFolderId;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (move.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Move “{file.name}”</DialogTitle>
          <DialogDescription>
            Choose the folder this file should live in.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="my-2 h-64 rounded-md border">
          {tree.isPending ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </div>
          ) : tree.isError ? (
            <p className="text-muted-foreground p-4 text-sm">
              The folder list could not be loaded.
            </p>
          ) : (
            <ul className="p-1.5">
              <DestinationRow
                label="Data room"
                depth={0}
                selected={target === null}
                current={currentFolderId === null}
                onSelect={() => {
                  setTarget(null);
                  setConflict(null);
                }}
              />
              {entries.map((entry) => (
                <DestinationRow
                  key={entry.id}
                  label={entry.name}
                  depth={entry.depth + 1}
                  selected={target === entry.id}
                  current={currentFolderId === entry.id}
                  onSelect={() => {
                    setTarget(entry.id);
                    setConflict(null);
                  }}
                />
              ))}
            </ul>
          )}
        </ScrollArea>

        {conflict && (
          <div className="bg-muted/60 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              A file with that name is already there. Keep both as
            </span>
            <span className="font-medium">“{conflict}”</span>
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              disabled={move.isPending}
              onClick={() => move.mutate({ folderId: target, keepBoth: true })}
            >
              Keep both
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={move.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={move.isPending || unchanged}
            onClick={() => move.mutate({ folderId: target })}
          >
            {move.isPending && <Loader2 className="size-4 animate-spin" />}
            {move.isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestinationRow({
  label,
  depth,
  selected,
  current,
  onSelect,
}: {
  label: string;
  depth: number;
  selected: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={cn(
          "hover:bg-accent flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
          selected && "bg-accent font-medium",
        )}
      >
        {depth > 0 ? (
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
        ) : null}
        <Folder className="size-4 shrink-0 opacity-70" />
        <span className="truncate">{label}</span>
        {current && (
          <span className="text-muted-foreground ml-auto text-xs">Current</span>
        )}
      </button>
    </li>
  );
}

/** Depth-first order with indentation depth, from the flat API payload. */
function flatten(nodes: FolderTreeNode[]): TreeEntry[] {
  const byParent = new Map<string | null, FolderTreeNode[]>();

  for (const node of nodes) {
    const siblings = byParent.get(node.parentFolderId) ?? [];
    siblings.push(node);
    byParent.set(node.parentFolderId, siblings);
  }

  const result: TreeEntry[] = [];

  const walk = (parentId: string | null, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      result.push({ ...node, depth });
      walk(node.id, depth + 1);
    }
  };

  walk(null, 0);
  return result;
}
