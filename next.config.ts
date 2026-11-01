import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  redirects: async () => [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.occuin.com" }],
      destination: "https://occuin.com/:path*",
      permanent: true,
    },
  ],
  headers: async () =>
    ["/hdri/:path*", "/textures/:path*"].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    })),
  serverExternalPackages: ["pg", "sharp", "@node-rs/argon2"],
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default config;
