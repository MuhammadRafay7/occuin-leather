import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["pg", "sharp", "@node-rs/argon2"],
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default config;
