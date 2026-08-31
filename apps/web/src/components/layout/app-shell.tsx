"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderClosed, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/lib/auth/use-session";
import { dataRooms } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

/** Header + sidebar frame shared by every authenticated page. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b px-4 backdrop-blur">
        <Link href="/dashboard" className="shrink-0">
          <Logo />
        </Link>
        <div className="ml-auto">{user && <UserMenu user={user} />}</div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const rooms = useQuery({
    queryKey: queryKeys.dataRooms,
    queryFn: dataRooms.list,
  });

  return (
    <aside className="bg-muted/20 w-full shrink-0 border-b md:w-60 md:border-r md:border-b-0">
      <ScrollArea className="md:h-[calc(100svh-3.5rem)]">
        <nav className="space-y-6 p-3">
          <Section icon={FolderClosed} title="Data rooms">
            {rooms.isPending ? (
              <SidebarSkeleton />
            ) : rooms.data?.owned.length ? (
              rooms.data.owned.map((room) => (
                <SidebarLink
                  key={room.id}
                  href={`/dataroom/${room.id}`}
                  active={pathname.startsWith(`/dataroom/${room.id}`)}
                >
                  {room.name}
                </SidebarLink>
              ))
            ) : (
              <EmptyHint>No data rooms yet</EmptyHint>
            )}
          </Section>

          <Section icon={Users} title="Shared with me">
            {rooms.isPending ? (
              <SidebarSkeleton />
            ) : rooms.data?.shared.length ? (
              rooms.data.shared.map((room) => (
                <SidebarLink
                  key={room.id}
                  href={`/dataroom/${room.id}`}
                  active={pathname.startsWith(`/dataroom/${room.id}`)}
                >
                  {room.name}
                </SidebarLink>
              ))
            ) : (
              <EmptyHint>Nothing shared yet</EmptyHint>
            )}
          </Section>
        </nav>
      </ScrollArea>
    </aside>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FolderClosed;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs font-medium tracking-wide uppercase">
        <Icon className="size-3.5" />
        {title}
      </p>
      {children}
    </div>
  );
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "hover:bg-accent hover:text-accent-foreground block truncate rounded-md px-2 py-1.5 text-sm transition-colors",
        active && "bg-accent text-accent-foreground font-medium",
      )}
    >
      {children}
    </Link>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground px-2 py-1.5 text-sm">{children}</p>;
}

function SidebarSkeleton() {
  return (
    <div className="space-y-1.5 px-2 py-1">
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-5 w-3/5" />
    </div>
  );
}
