const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** The structured error body every API route returns. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = body.statusCode;
    this.code = body.code;
    this.details = body.details;
  }

  /** Access was revoked or never granted — the caller usually navigates away. */
  get isAccessProblem(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  /** Present on name conflicts: what the server would call the item instead. */
  get suggestedName(): string | undefined {
    const details = this.details as { suggestedName?: string } | undefined;
    return details?.suggestedName;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Every call carries the session cookie. The API is the only place that decides
 * what the user may see, so the client never guesses at permissions.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;

    throw new ApiError({
      statusCode: 0,
      code: "NETWORK_ERROR",
      message: "Cannot reach the server. Check your connection and try again.",
    });
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      isErrorBody(payload)
        ? payload
        : {
            statusCode: response.status,
            code: "ERROR",
            message: "Something went wrong. Please try again.",
          },
    );
  }

  return payload as T;
}

function isErrorBody(payload: unknown): payload is ApiErrorBody {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    "statusCode" in payload
  );
}

/** Message worth showing in a toast, whatever was thrown. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export { API_URL };
