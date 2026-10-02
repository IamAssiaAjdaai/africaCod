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
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://analytics.tiktok.com https://www.googletagmanager.com https://www.googleadservices.com" +
        (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://www.facebook.com https://*.google.com https://*.doubleclick.net https://www.googleadservices.com",
      "connect-src 'self' https://www.facebook.com https://*.tiktok.com https://*.google.com https://*.google-analytics.com https://*.doubleclick.net https://www.googleadservices.com",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "frame-src https://*.doubleclick.net https://www.googleadservices.com",
      "form-action 'self' https://accounts.google.com",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.APP_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};
export default nextConfig;
