import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: [
    "@africacod/auth",
    "@africacod/db",
    "@africacod/domain",
    "@africacod/ui",
    "@africacod/shared",
    "@africacod/validation",
  ],
  outputFileTracingExcludes: { "/*": ["./.data/**/*"] },
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};
export default nextConfig;
