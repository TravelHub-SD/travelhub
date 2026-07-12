import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"], // الـ API ليست للفهرسة
      },
    ],
    sitemap: "https://travelhub-sd.com/sitemap.xml",
  }
}
