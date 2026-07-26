import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

loadEnvConfig(monorepoRoot, process.env.NODE_ENV !== "production", console, true);

const trustedDevelopmentHosts = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => new URL(origin).hostname);

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(new Set(["127.0.0.1", ...(trustedDevelopmentHosts ?? [])])),
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/db", "@repo/ui"],
};

export default nextConfig;
