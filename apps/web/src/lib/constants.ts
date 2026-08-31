/**
 * Mirrors MAX_FILE_SIZE on the API so the UI can reject oversized files before
 * uploading. The API still enforces the real limit.
 */
export const MAX_FILE_SIZE = Number(
  process.env.NEXT_PUBLIC_MAX_FILE_SIZE ?? 52_428_800,
);

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
