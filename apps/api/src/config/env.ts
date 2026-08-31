import { z } from 'zod';

/**
 * Every environment variable the API needs, validated once at boot.
 * Failing fast here beats discovering a missing S3 key on the first upload.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  AUTH_TOKEN_TTL: z.string().default('7d'),

  S3_ENDPOINT: z.string().url(),
  /**
   * Host the browser should use for presigned URLs, when it differs from the
   * one the API talks to (a container network reaches MinIO at http://minio:9000
   * while the browser reaches it at http://localhost:9000).
   */
  S3_PUBLIC_ENDPOINT: z.preprocess(
    // An empty value in a .env file means "same as S3_ENDPOINT".
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_URL_TTL: z.coerce.number().int().positive().default(900),

  MAX_FILE_SIZE: z.coerce.number().int().positive().default(52_428_800),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}
