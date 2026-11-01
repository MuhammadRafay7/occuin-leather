import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const apiHeaders = [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; sandbox" }];

const longCache = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  redirects: async () => [
    { source: "/shop", destination: "/shop/leather", permanent: true },
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.occuin.com" }],
      destination: "https://occuin.com/:path*",
      permanent: true,
    },
  ],
  headers: async () => [
    { source: "/:path*", headers: securityHeaders },
    { source: "/api/:path*", headers: apiHeaders },
    { source: "/hdri/:path*", headers: longCache },
    { source: "/textures/:path*", headers: longCache },
  ],
  serverExternalPackages: ["pg", "sharp", "@node-rs/argon2"],
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default config;
