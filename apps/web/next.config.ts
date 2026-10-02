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
  poweredByHeader: false,
};
export default nextConfig;
