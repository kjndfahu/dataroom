import { cn } from "@/lib/utils";

/** Wordmark used in the auth screens and the app header. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <span
        aria-hidden
        className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-bold"
      >
        D
      </span>
      <span className="tracking-tight">Data Room</span>
    </span>
  );
}
