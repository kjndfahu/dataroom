"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { files as filesApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { formatBytes } from "@/lib/format";
import type { FilePreview } from "@/lib/api/types";

interface PdfPreviewDialogProps {
  file: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  /** Public browsing passes its own loader, keyed by share token. */
  loadPreview?: (fileId: string) => Promise<FilePreview>;
}

/**
 * Renders the PDF from a short-lived signed URL. The document itself is fetched
 * by the browser straight from storage — the API only vouches for access.
 */
export function PdfPreviewDialog({
  file,
  onOpenChange,
  loadPreview,
}: PdfPreviewDialogProps) {
  const preview = useQuery({
    queryKey: queryKeys.filePreview(file?.id ?? "none"),
    queryFn: () =>
      loadPreview ? loadPreview(file!.id) : filesApi.preview(file!.id),
    enabled: Boolean(file),
    // Signed URLs expire; never serve one from a stale cache.
    staleTime: 0,
    gcTime: 0,
  });

  const gone =
    preview.error instanceof ApiError && preview.error.isAccessProblem;

  return (
    <Dialog open={Boolean(file)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85svh] max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">
              {file?.name ?? "Document"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {preview.data ? formatBytes(preview.data.size) : "PDF document"}
            </DialogDescription>
          </div>

          {preview.data && (
            <Button variant="outline" size="sm" className="mr-8 shrink-0" render={
              <a href={preview.data.url} target="_blank" rel="noreferrer" />
            }>
              <Download className="size-4" />
              Open
            </Button>
          )}
        </DialogHeader>

        <div className="bg-muted/40 min-h-0 flex-1">
          {preview.isPending && (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading document…
            </div>
          )}

          {preview.isError && (
            <div className="flex h-full items-center justify-center p-6">
              <ErrorState
                className="border-none"
                title={gone ? "This file is no longer available" : "Could not open the document"}
                description={
                  gone
                    ? "It was deleted or your access to it was removed."
                    : "The preview could not be loaded. Try again in a moment."
                }
                onRetry={gone ? undefined : () => void preview.refetch()}
              />
            </div>
          )}

          {preview.data && (
            <iframe
              key={preview.data.url}
              src={preview.data.url}
              title={preview.data.name}
              className="size-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
