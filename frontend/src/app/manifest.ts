import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tribely — Social Habit Accountability",
    short_name: "Tribely",
    description:
      "Habit-tracking micro-arenas with daily proof verification, group chat, and digital stakes.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090D16",
    theme_color: "#FF5E00",
    orientation: "portrait-primary",
    categories: ["social", "productivity", "health"],
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
