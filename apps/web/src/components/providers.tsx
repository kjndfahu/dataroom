"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api/client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Permission and not-found answers are final; only retry flakiness.
              if (
                error instanceof ApiError &&
                error.status >= 400 &&
                error.status < 500
              ) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionExpiryWatcher />
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}

/**
 * A session can expire, or be signed out in another tab. Wherever that first
 * surfaces — any query or mutation — send the user to sign in once, instead of
 * leaving failing screens behind.
 */
function SessionExpiryWatcher() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/login") || pathname.startsWith("/public/")) return;

    const handle = (error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 401) return;

      queryClient.clear();
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    };

    const unsubscribeQueries = queryClient
      .getQueryCache()
      .subscribe((event) => {
        if (event.type === "updated" && event.query.state.status === "error") {
          handle(event.query.state.error);
        }
      });

    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe((event) => {
        if (event.type === "updated" && event.mutation?.state.status === "error") {
          handle(event.mutation.state.error);
        }
      });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient, router, pathname]);

  return null;
}
