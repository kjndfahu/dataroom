"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { files as filesApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { formatBytes } from "@/lib/format";

/**
 * Standalone page for a file shared on its own: the recipient has access to
 * this document and nothing else, so there is no folder to browse.
 */
export function FileViewer({ fileId }: { fileId: string }) {
  const file = useQuery({
    queryKey: queryKeys.file(fileId),
    queryFn: () => filesApi.get(fileId),
  });

  const preview = useQuery({
    queryKey: queryKeys.filePreview(fileId),
    queryFn: () => filesApi.preview(fileId),
    staleTime: 0,
    gcTime: 0,
  });

  const error = file.error ?? preview.error;

  if (error) {
    const denied = error instanceof ApiError && error.isAccessProblem;
    return (
      <div className="p-6">
        <ErrorState
          title={denied ? "This file is no longer available" : "Could not open this file"}
          description={
            denied
              ? "It was deleted, or your access to it was removed."
              : "The server did not respond. Try again in a moment."
          }
          onRetry={
            denied
              ? undefined
              : () => {
                  void file.refetch();
                  void preview.refetch();
                }
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100svh-3.5rem)] w-full max-w-6xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {file.data ? (
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {file.data.name}
            </h1>
          ) : (
            <Skeleton className="h-7 w-64" />
          )}
          <p className="text-muted-foreground mt-1 text-sm">
            {file.data ? `PDF · ${formatBytes(file.data.size)}` : "PDF document"}
          </p>
        </div>

        {preview.data && (
          <Button
            variant="outline"
            render={<a href={preview.data.url} target="_blank" rel="noreferrer" />}
          >
            <Download className="size-4" />
            Open in new tab
          </Button>
        )}
      </header>

      <div className="bg-muted/40 min-h-0 flex-1 overflow-hidden rounded-lg border">
        {preview.data ? (
          <iframe
            key={preview.data.url}
            src={preview.data.url}
            title={preview.data.name}
            className="size-full border-0"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading document…
          </div>
        )}
      </div>
    </div>
  );
}
