"use client";

import { useCallback, useRef, useState } from "react";
import { files as filesApi } from "@/lib/api/endpoints";
import { ApiError, errorMessage } from "@/lib/api/client";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { formatBytes } from "@/lib/format";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "finalizing"
  | "conflict"
  | "done"
  | "error"
  | "cancelled";

export interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  status: UploadStatus;
  /** 0–100, only meaningful while uploading. */
  progress: number;
  error?: string;
  /** Offered by the API when the name is already taken. */
  suggestedName?: string;
  storageKey?: string;
}

interface QueueOptions {
  dataRoomId: string;
  folderId: string | null;
  onUploaded: () => void;
}

/**
 * Runs uploads straight to storage with presigned URLs.
 *
 * Each file is independent: one failure never blocks the others, a clash pauses
 * only that file for the user to resolve, and cancelling removes the object that
 * was already stored so nothing is orphaned.
 */
export function useUploadQueue({
  dataRoomId,
  folderId,
  onUploaded,
}: QueueOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const sources = useRef(new Map<string, File>());

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const run = useCallback(
    async (id: string, file: File, onConflict?: "keepBoth") => {
      patch(id, { status: "uploading", progress: 0, error: undefined });

      try {
        const authorization = await filesApi.createUploadUrl({
          dataRoomId,
          folderId,
          fileName: file.name,
          size: file.size,
          mimeType: file.type || "application/pdf",
        });

        patch(id, { storageKey: authorization.storageKey });

        await putWithProgress(authorization.uploadUrl, file, id, requests, (percent) =>
          patch(id, { progress: percent }),
        );

        patch(id, { status: "finalizing", progress: 100 });

        await filesApi.confirmUpload({
          dataRoomId,
          folderId,
          storageKey: authorization.storageKey,
          fileName: file.name,
          onConflict,
        });

        patch(id, { status: "done" });
        onUploaded();
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          patch(id, { status: "cancelled" });
          return;
        }

        if (cause instanceof ApiError && cause.isConflict && cause.suggestedName) {
          patch(id, {
            status: "conflict",
            suggestedName: cause.suggestedName,
            error: cause.message,
          });
          return;
        }

        patch(id, { status: "error", error: errorMessage(cause) });
      } finally {
        requests.current.delete(id);
      }
    },
    [dataRoomId, folderId, onUploaded, patch],
  );

  const enqueue = useCallback(
    (incoming: File[]) => {
      const accepted: Array<{ item: UploadItem; file: File }> = [];

      for (const file of incoming) {
        const id = crypto.randomUUID();
        const rejection = validate(file);

        const item: UploadItem = {
          id,
          fileName: file.name,
          size: file.size,
          status: rejection ? "error" : "queued",
          progress: 0,
          error: rejection,
        };

        sources.current.set(id, file);
        accepted.push({ item, file });
      }

      setItems((current) => [...current, ...accepted.map((entry) => entry.item)]);

      for (const entry of accepted) {
        if (entry.item.status !== "error") void run(entry.item.id, entry.file);
      }
    },
    [run],
  );

  const retry = useCallback(
    (id: string) => {
      const file = sources.current.get(id);
      if (file) void run(id, file);
    },
    [run],
  );

  /** Applies the server's suggested name by re-confirming the same object. */
  const keepBoth = useCallback(
    (id: string) => {
      const file = sources.current.get(id);
      const item = items.find((entry) => entry.id === id);
      if (!file || !item?.storageKey) return;

      patch(id, { status: "finalizing", error: undefined });

      filesApi
        .confirmUpload({
          dataRoomId,
          folderId,
          storageKey: item.storageKey,
          fileName: file.name,
          onConflict: "keepBoth",
        })
        .then(() => {
          patch(id, { status: "done" });
          onUploaded();
        })
        .catch((cause: unknown) =>
          patch(id, { status: "error", error: errorMessage(cause) }),
        );
    },
    [dataRoomId, folderId, items, onUploaded, patch],
  );

  const cancel = useCallback(
    (id: string) => {
      requests.current.get(id)?.abort();

      const item = items.find((entry) => entry.id === id);
      if (item?.storageKey && item.status !== "done") {
        // The bytes may already be in the bucket; drop them.
        void filesApi.discardUpload(item.storageKey).catch(() => undefined);
      }

      patch(id, { status: "cancelled" });
    },
    [items, patch],
  );

  const dismiss = useCallback((id: string) => {
    requests.current.delete(id);
    sources.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) =>
      current.filter(
        (item) => item.status !== "done" && item.status !== "cancelled",
      ),
    );
  }, []);

  return {
    items,
    enqueue,
    retry,
    keepBoth,
    cancel,
    dismiss,
    clearFinished,
    isUploading: items.some(
      (item) => item.status === "uploading" || item.status === "finalizing",
    ),
  };
}

function validate(file: File): string | undefined {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) return "Only PDF files can be uploaded.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_SIZE) {
    return `Larger than the ${formatBytes(MAX_FILE_SIZE)} limit.`;
  }

  return undefined;
}

/** fetch cannot report upload progress, so the PUT goes through XHR. */
function putWithProgress(
  url: string,
  file: File,
  id: string,
  requests: React.RefObject<Map<string, XMLHttpRequest>>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    requests.current.set(id, request);

    request.open("PUT", url, true);
    request.setRequestHeader("Content-Type", "application/pdf");

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(
        new ApiError({
          statusCode: request.status,
          code: "UPLOAD_FAILED",
          message: "The upload was rejected by storage. Try again.",
        }),
      );
    });

    request.addEventListener("error", () =>
      reject(
        new ApiError({
          statusCode: 0,
          code: "NETWORK_ERROR",
          message: "The connection dropped during upload.",
        }),
      ),
    );

    request.addEventListener("abort", () =>
      reject(new DOMException("Upload cancelled", "AbortError")),
    );

    request.send(file);
  });
}
