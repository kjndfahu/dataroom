"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/use-session";
import { Logo } from "@/components/layout/logo";

/** Entry point: straight to the workspace, or to sign in. */
export default function HomePage() {
  const { user, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [isLoading, user, router]);

  return (
    <main className="flex min-h-svh items-center justify-center">
      <Logo className="text-muted-foreground animate-pulse" />
    </main>
  );
}
