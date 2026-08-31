"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api/client";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // The query client is built once, so the handler reads the location from a
  // ref rather than closing over the first render's pathname.
  const location = useRef(pathname);
  location.current = pathname;

  const [queryClient] = useState(() => {
    /**
     * A session can expire, or be signed out in another tab. Wherever that
     * surfaces, send the user to sign in once instead of leaving failing
     * screens behind.
     */
    const onUnauthorized = (error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 401) return;

      const current = location.current;
      if (current.startsWith("/login") || current.startsWith("/public/")) return;

      client.clear();
      router.replace(`/login?next=${encodeURIComponent(current)}`);
    };

    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError: onUnauthorized }),
      mutationCache: new MutationCache({ onError: onUnauthorized }),
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
    });

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
