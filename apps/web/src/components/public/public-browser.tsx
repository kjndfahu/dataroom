"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FolderOpen, Loader2, Lock } from "lucide-react";
import { Breadcrumbs } from "@/components/browser/breadcrumbs";
import { ItemTable, ItemTableSkeleton } from "@/components/browser/item-table";
import { PdfPreviewDialog } from "@/components/files/pdf-preview-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { publicShare } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query-keys";
import { formatBytes } from "@/lib/format";
import type {
  Breadcrumb,
  FileListItem,
  FolderContents,
  FolderListItem,
} from "@/lib/api/types";

/**
 * Anonymous view of a shared resource. Read-only by construction: no action
 * menus are rendered, and the public API would refuse them anyway.
 */
export function PublicBrowser({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folder");
  const [previewFile, setPreviewFile] = useState<FileListItem | null>(null);

  const view = useQuery({
    queryKey: queryKeys.publicView(token, folderId),
    queryFn: () => publicShare.view(token, folderId ?? undefined),
    retry: false,
  });

  const contents = useInfiniteQuery({
    queryKey: queryKeys.publicItems(token, folderId),
    enabled: view.isSuccess && view.data.resourceType !== "FILE",
    initialPageParam: {} as { folderCursor?: string; fileCursor?: string },
    queryFn: ({ pageParam }) =>
      publicShare.items(token, { folderId: folderId ?? undefined, ...pageParam }),
    getNextPageParam: (lastPage: FolderContents) => {
      const next: { folderCursor?: string; fileCursor?: string } = {};
      if (lastPage.folders.nextCursor)
        next.folderCursor = lastPage.folders.nextCursor;
      if (lastPage.files.nextCursor) next.fileCursor = lastPage.files.nextCursor;
      return next.folderCursor ?? next.fileCursor ? next : undefined;
    },
    retry: false,
  });

  if (view.isError) {
    return (
      <PublicShell>
        <ErrorState
          className="mt-10"
          title="This link is invalid or no longer available"
          description="It may have been disabled by its owner, or it may have expired."
        />
      </PublicShell>
    );
  }

  if (view.isPending) {
    return (
      <PublicShell>
        <div className="space-y-4">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-8 w-72" />
          <ItemTableSkeleton />
        </div>
      </PublicShell>
    );
  }

  const pages = contents.data?.pages ?? [];
  const folders = dedupe(pages.flatMap((page) => page.folders.items));
  const files = dedupe(pages.flatMap((page) => page.files.items));
  const isSingleFile = view.data.resourceType === "FILE";

  const hrefFor = (entry: Breadcrumb) =>
    entry.id ? `/public/${token}?folder=${entry.id}` : `/public/${token}`;

  return (
    <PublicShell>
      <div className="space-y-6">
        <header className="space-y-3">
          <Breadcrumbs trail={view.data.breadcrumbs} hrefFor={hrefFor} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {view.data.name}
            </h1>
            <Badge variant="secondary" className="gap-1.5">
              <Lock className="size-3" />
              View only
            </Badge>
          </div>
        </header>

        {isSingleFile ? (
          <SharedFile
            token={token}
            file={{ id: view.data.fileId!, name: view.data.name }}
          />
        ) : contents.isPending ? (
          <ItemTableSkeleton />
        ) : contents.isError ? (
          <ErrorState
            title="Could not load these items"
            description="The list failed to load. Try again in a moment."
            onRetry={() => void contents.refetch()}
          />
        ) : folders.length === 0 && files.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="size-8" />}
            title="This folder is empty"
            description="Nothing has been shared here yet."
          />
        ) : (
          <div className="space-y-4">
            <ItemTable
              dataRoomId={view.data.dataRoomId}
              folders={folders}
              files={files}
              onOpenFile={setPreviewFile}
              folderHref={(folder: FolderListItem) =>
                `/public/${token}?folder=${folder.id}`
              }
            />

            {contents.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  disabled={contents.isFetchingNextPage}
                  onClick={() => void contents.fetchNextPage()}
                >
                  {contents.isFetchingNextPage && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <PdfPreviewDialog
        file={previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
        loadPreview={(fileId) => publicShare.preview(token, fileId)}
      />
    </PublicShell>
  );
}

/** A link that points at one document opens it straight away. */
function SharedFile({
  token,
  file,
}: {
  token: string;
  file: { id: string; name: string };
}) {
  const preview = useQuery({
    queryKey: queryKeys.filePreview(file.id),
    queryFn: () => publicShare.preview(token, file.id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  if (preview.isError) {
    return (
      <ErrorState
        title="This document is no longer available"
        description="It was deleted, or the link was disabled."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-muted/40 h-[70svh] overflow-hidden rounded-lg border">
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
      {preview.data && (
        <p className="text-muted-foreground text-sm">
          {formatBytes(preview.data.size)}
        </p>
      )}
    </div>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center border-b px-4">
        <Logo />
        <span className="text-muted-foreground ml-3 text-sm">Shared link</span>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</main>
    </div>
  );
}

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(item.id, item);
  return [...seen.values()];
}
