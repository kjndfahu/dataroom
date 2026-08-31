"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/use-session";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Guards the authenticated area. The session cookie lives on the API's origin,
 * so this check happens in the browser — the backend still authorises every
 * request independently.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading || !user) return <SessionSkeleton />;

  return <>{children}</>;
}

function SessionSkeleton() {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex h-14 items-center gap-4 border-b px-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="ml-auto size-8 rounded-full" />
      </div>
      <div className="flex flex-1">
        <div className="hidden w-60 flex-col gap-2 border-r p-4 md:flex">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 space-y-3 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
