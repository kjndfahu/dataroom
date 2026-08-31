"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadDropzoneProps {
  /** Disabled for viewers — the API would reject the upload anyway. */
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}

/**
 * Wraps the browser area so PDFs can be dropped anywhere on it. Drag state is
 * tracked with a counter because dragenter/dragleave also fire for children.
 */
export function UploadDropzone({
  disabled,
  onFiles,
  children,
}: UploadDropzoneProps) {
  const [isDragging, setDragging] = useState(false);
  const depth = useRef(0);

  if (disabled) return <>{children}</>;

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);

    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) onFiles(dropped);
  }

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div className="border-primary/60 bg-background/85 pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center rounded-lg border-2 border-dashed backdrop-blur-[1px]">
          <Upload className="text-primary mb-2 size-6" />
          <p className="font-medium">Drop PDFs to upload</p>
          <p className="text-muted-foreground text-sm">
            They land in the folder you are viewing.
          </p>
        </div>
      )}
    </div>
  );
}

/** File-picker counterpart to the dropzone, used in the header. */
export function UploadButton({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? []);
          if (chosen.length > 0) onFiles(chosen);
          // Allow picking the same file again after a failed attempt.
          event.target.value = "";
        }}
      />
      <Button disabled={disabled} onClick={() => input.current?.click()}>
        <Upload className="size-4" />
        Upload
      </Button>
    </>
  );
}
