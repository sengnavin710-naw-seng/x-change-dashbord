import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

loadEnvConfig(monorepoRoot, process.env.NODE_ENV !== "production", console, true);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/db", "@repo/ui"],
};

export default nextConfig;
