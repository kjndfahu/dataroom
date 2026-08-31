"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderClosed, Users } from "lucide-react";
import { CreateDataRoomDialog } from "@/components/datarooms/create-data-room-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dataRooms } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query-keys";
import { formatDate } from "@/lib/format";
import type { DataRoomSummary } from "@/lib/api/types";

export default function DashboardPage() {
  const router = useRouter();
  const rooms = useQuery({
    queryKey: queryKeys.dataRooms,
    queryFn: dataRooms.list,
  });

  const owned = rooms.data?.owned ?? [];
  const shared = rooms.data?.shared ?? [];
  // With a single room there is nothing to choose between — go straight in.
  const onlyRoom = owned.length === 1 && shared.length === 0 ? owned[0] : null;

  useEffect(() => {
    if (onlyRoom) router.replace(`/dataroom/${onlyRoom.id}`);
  }, [onlyRoom, router]);

  if (rooms.isPending || onlyRoom) return <DashboardSkeleton />;

  if (rooms.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Could not load your data rooms"
          description="The server did not respond. Try again in a moment."
          onRetry={() => void rooms.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data rooms</h1>
          <p className="text-muted-foreground text-sm">
            Secure spaces for your documents.
          </p>
        </div>
        <CreateDataRoomDialog />
      </div>

      <section className="space-y-3">
        <SectionHeading icon={FolderClosed}>Your data rooms</SectionHeading>
        {owned.length === 0 ? (
          <EmptyState
            title="No data rooms yet"
            description="Create one to start uploading and organising documents."
            action={<CreateDataRoomDialog />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      {shared.length > 0 && (
        <section className="space-y-3">
          <SectionHeading icon={Users}>Shared with me</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof FolderClosed;
  children: React.ReactNode;
}) {
  return (
    <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
      <Icon className="size-3.5" />
      {children}
    </h2>
  );
}

function RoomCard({ room }: { room: DataRoomSummary }) {
  return (
    <Link
      href={`/dataroom/${room.id}`}
      className="hover:border-foreground/20 group bg-card rounded-lg border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate font-medium">{room.name}</h3>
        {!room.isOwner && (
          <Badge variant="secondary" className="shrink-0">
            {room.role === "VIEWER" ? "View only" : room.role.toLowerCase()}
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Updated {formatDate(room.updatedAt)}
      </p>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
