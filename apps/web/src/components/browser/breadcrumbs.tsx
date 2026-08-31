"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Breadcrumb } from "@/lib/api/types";

interface BreadcrumbsProps {
  dataRoomId: string;
  /** Root-first; the entry with id null is the data room itself. */
  trail: Breadcrumb[];
}

export function Breadcrumbs({ dataRoomId, trail }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {trail.map((entry, index) => {
          const isLast = index === trail.length - 1;
          const href = entry.id
            ? `/dataroom/${dataRoomId}/folder/${entry.id}`
            : `/dataroom/${dataRoomId}`;

          return (
            <li key={entry.id ?? "root"} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight aria-hidden className="size-3.5 shrink-0" />
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  className="text-foreground max-w-[16rem] truncate font-medium"
                >
                  {entry.name}
                </span>
              ) : (
                <Link
                  href={href}
                  className="hover:text-foreground max-w-[12rem] truncate transition-colors"
                >
                  {entry.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
