"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Globe, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { publicLinks, shares } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { APP_URL } from "@/lib/constants";
import type { ResourceType } from "@/lib/api/types";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
}

const RESOURCE_LABEL: Record<ResourceType, string> = {
  DATA_ROOM: "data room",
  FOLDER: "folder",
  FILE: "file",
};

/**
 * Two ways to share, both revocable: a link anyone can open, and access for a
 * specific account. Everything shown here is read-only access.
 */
export function ShareDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: queryKeys.shares(resourceType, resourceId),
    queryFn: () => shares.list(resourceType, resourceId),
    enabled: open,
  });

  const links = useQuery({
    queryKey: queryKeys.publicLinks(resourceType, resourceId),
    queryFn: () => publicLinks.list(resourceType, resourceId),
    enabled: open,
  });

  const link = links.data?.[0];
  const linkUrl = link ? `${APP_URL}/public/${link.token}` : null;

  const invalidatePeople = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.shares(resourceType, resourceId),
    });

  const invalidateLinks = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.publicLinks(resourceType, resourceId),
    });

  const invite = useMutation({
    mutationFn: (value: string) =>
      shares.create({ resourceType, resourceId, email: value }),
    onSuccess: async (share) => {
      await invalidatePeople();
      setEmail("");
      toast.success(`Shared with ${share.recipient.email}`);
    },
    onError: (cause) => setShareError(errorMessage(cause)),
  });

  const revokePerson = useMutation({
    mutationFn: (shareId: string) => shares.revoke(shareId),
    onSuccess: async () => {
      await invalidatePeople();
      toast.success("Access revoked");
    },
    onError: (cause) => toast.error(errorMessage(cause)),
  });

  const createLink = useMutation({
    mutationFn: () => publicLinks.create({ resourceType, resourceId }),
    onSuccess: async () => {
      await invalidateLinks();
      toast.success("Public link created");
    },
    onError: (cause) => toast.error(errorMessage(cause)),
  });

  const disableLink = useMutation({
    mutationFn: (id: string) => publicLinks.revoke(id),
    onSuccess: async () => {
      await invalidateLinks();
      toast.success("Public link disabled");
    },
    onError: (cause) => toast.error(errorMessage(cause)),
  });

  async function copyLink() {
    if (!linkUrl) return;

    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">Share “{resourceName}”</DialogTitle>
          <DialogDescription>
            Anyone you share this {RESOURCE_LABEL[resourceType]} with gets
            read-only access, including everything inside it.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 py-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="size-4" />
            Share with a person
          </h3>

          <form
            className="flex items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setShareError(null);
              const value = email.trim();
              if (!value) {
                setShareError("Enter an email address.");
                return;
              }
              invite.mutate(value);
            }}
          >
            <Field id="share-email" label="" error={shareError ?? undefined} className="flex-1 space-y-1">
              <Input
                id="share-email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                disabled={invite.isPending}
                aria-invalid={Boolean(shareError)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={invite.isPending || !email.trim()}>
              {invite.isPending && <Loader2 className="size-4 animate-spin" />}
              Share
            </Button>
          </form>

          {people.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : people.data && people.data.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {people.data.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {share.recipient.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {share.recipient.email}
                    </p>
                  </div>
                  <Badge variant="secondary">Viewer</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Revoke access for ${share.recipient.email}`}
                    disabled={revokePerson.isPending}
                    onClick={() => revokePerson.mutate(share.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Not shared with anyone yet.
            </p>
          )}
        </section>

        <Separator />

        <section className="space-y-3 py-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Globe className="size-4" />
            Public link
          </h3>

          {links.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : linkUrl && link ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input readOnly value={linkUrl} onFocus={(e) => e.target.select()} />
                <Button variant="outline" onClick={copyLink}>
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  Anyone with this link can view — no account needed.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disableLink.isPending}
                  onClick={() => disableLink.mutate(link.id)}
                >
                  {disableLink.isPending && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Disable link
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                No public link yet.
              </p>
              <Button
                variant="outline"
                disabled={createLink.isPending}
                onClick={() => createLink.mutate()}
              >
                {createLink.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Create link
              </Button>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
