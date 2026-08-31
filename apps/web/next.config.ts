import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle, which is what the Docker image runs.
  output: "standalone",
  // Trace from the workspace root so pnpm-hoisted dependencies are included.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
