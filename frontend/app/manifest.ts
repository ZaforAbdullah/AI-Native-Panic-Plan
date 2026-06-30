// app/manifest.ts

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PanicPlan — AI Study Companion",
    short_name: "PanicPlan",
    description:
      "AI-generated study schedules that adapt when life gets in the way.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0d0f1a",
    theme_color: "#5b8eff",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}