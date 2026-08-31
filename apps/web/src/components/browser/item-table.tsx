"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FileText, Folder } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDate } from "@/lib/format";
import type { FileListItem, FolderListItem } from "@/lib/api/types";

interface ItemTableProps {
  dataRoomId: string;
  folders: FolderListItem[];
  files: FileListItem[];
  /** Rendered in the trailing column; empty for read-only viewers. */
  renderFolderActions?: (folder: FolderListItem) => ReactNode;
  renderFileActions?: (file: FileListItem) => ReactNode;
  onOpenFile: (file: FileListItem) => void;
  /** Link builder so the public browser can point at its own routes. */
  folderHref?: (folder: FolderListItem) => string;
}

export function ItemTable({
  dataRoomId,
  folders,
  files,
  renderFolderActions,
  renderFileActions,
  onOpenFile,
  folderHref,
}: ItemTableProps) {
  const hasActions = Boolean(renderFolderActions ?? renderFileActions);
  const linkFor = (folder: FolderListItem) =>
    folderHref?.(folder) ?? `/dataroom/${dataRoomId}/folder/${folder.id}`;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[16rem]">Name</TableHead>
            <TableHead className="w-28">Type</TableHead>
            <TableHead className="w-28">Size</TableHead>
            <TableHead className="w-36">Modified</TableHead>
            {hasActions && <TableHead className="w-12" aria-label="Actions" />}
          </TableRow>
        </TableHeader>

        <TableBody>
          {folders.map((folder) => (
            <TableRow key={folder.id} className="group">
              <TableCell>
                <Link
                  href={linkFor(folder)}
                  className="flex items-center gap-2.5 font-medium hover:underline"
                >
                  <Folder className="size-4 shrink-0 fill-current opacity-70" />
                  <span className="truncate">{folder.name}</span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">Folder</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(folder.updatedAt)}
              </TableCell>
              {hasActions && (
                <TableCell className="text-right">
                  {renderFolderActions?.(folder)}
                </TableCell>
              )}
            </TableRow>
          ))}

          {files.map((file) => (
            <TableRow key={file.id} className="group">
              <TableCell>
                <button
                  type="button"
                  onClick={() => onOpenFile(file)}
                  className="flex w-full items-center gap-2.5 text-left font-medium hover:underline"
                >
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">PDF</TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(file.updatedAt)}
              </TableCell>
              {hasActions && (
                <TableCell className="text-right">
                  {renderFileActions?.(file)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ItemTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
