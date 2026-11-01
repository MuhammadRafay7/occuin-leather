import type { MetadataRoute } from "next";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api", "/bag", "/checkout", "/orders", "/search", "/wishlist"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
