import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tribely — Social Habit Accountability",
    short_name: "Tribely",
    description:
      "Habit-tracking micro-arenas with daily proof verification, group chat, and digital stakes.",
    id: "/",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#1A73E8",
    orientation: "portrait-primary",
    categories: ["social", "productivity", "health"],
    icons: [
      {
        src: "/icons/BrandNewLook.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/BrandNewLook.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
