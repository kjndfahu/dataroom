"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Breadcrumb } from "@/lib/api/types";

interface BreadcrumbsProps {
  /** Root-first; the entry with id null is the data room itself. */
  trail: Breadcrumb[];
  /** Builds the link for one crumb; return null to render it as plain text. */
  hrefFor: (entry: Breadcrumb) => string | null;
}

export function Breadcrumbs({ trail, hrefFor }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {trail.map((entry, index) => {
          const isLast = index === trail.length - 1;
          const href = hrefFor(entry);

          return (
            <li key={entry.id ?? "root"} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight aria-hidden className="size-3.5 shrink-0" />
              )}
              {isLast || !href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={
                    isLast
                      ? "text-foreground max-w-[16rem] truncate font-medium"
                      : "max-w-[12rem] truncate"
                  }
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
