"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import type { SessionUser } from "@/lib/api/types";

/**
 * The session cookie belongs to the API's origin, so the browser — not the
 * Next.js server — is what asks who is signed in.
 */
export function useSession() {
  const query = useQuery<SessionUser | null>({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        return await auth.me();
      } catch (error) {
        // Signed out is a normal answer, not an error state.
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60_000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });
}
