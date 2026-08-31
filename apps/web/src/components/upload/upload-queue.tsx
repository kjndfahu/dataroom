"use client";

import { Check, Loader2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import type { UploadItem } from "@/components/upload/use-upload-queue";

interface UploadQueueProps {
  items: UploadItem[];
  onRetry: (id: string) => void;
  onKeepBoth: (id: string) => void;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearFinished: () => void;
}

/** Floating panel that reports every upload separately. */
export function UploadQueue({
  items,
  onRetry,
  onKeepBoth,
  onCancel,
  onDismiss,
  onClearFinished,
}: UploadQueueProps) {
  if (items.length === 0) return null;

  const active = items.filter(
    (item) => item.status === "uploading" || item.status === "finalizing",
  ).length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-card fixed right-4 bottom-4 z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border shadow-lg"
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <p className="text-sm font-medium">
          {active > 0 ? `Uploading ${active}…` : "Uploads"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onClearFinished}
        >
          Clear
        </Button>
      </div>

      <ul className="max-h-72 divide-y overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="space-y-2 px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                <p className="text-muted-foreground text-xs">
                  {statusLabel(item)}
                </p>
              </div>

              {item.status === "done" ? (
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : item.status === "uploading" || item.status === "finalizing" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={`Cancel upload of ${item.fileName}`}
                  onClick={() => onCancel(item.id)}
                >
                  <X className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={`Dismiss ${item.fileName}`}
                  onClick={() => onDismiss(item.id)}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {(item.status === "uploading" || item.status === "finalizing") && (
              <Progress
                value={item.status === "finalizing" ? 100 : item.progress}
                className="h-1.5"
              />
            )}

            {item.status === "conflict" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => onKeepBoth(item.id)}>
                  Keep both
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(item.id)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {item.status === "error" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetry(item.id)}
              >
                <RotateCw className="size-3.5" />
                Retry
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case "queued":
      return "Waiting…";
    case "uploading":
      return `${item.progress}% of ${formatBytes(item.size)}`;
    case "finalizing":
      return "Finishing…";
    case "conflict":
      return item.suggestedName
        ? `Already exists — keep both as “${item.suggestedName}”?`
        : "A file with that name already exists.";
    case "done":
      return `Uploaded · ${formatBytes(item.size)}`;
    case "cancelled":
      return "Cancelled";
    case "error":
      return item.error ?? "Upload failed.";
  }
}

export function UploadProgressIcon() {
  return <Loader2 className="size-4 animate-spin" />;
}
