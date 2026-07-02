import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tribely",
    short_name: "Tribely",
    description:
      "Habit-tracking groups with daily proof, group chat, and real stakes.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3F4F6",
    theme_color: "#5B4DFF",
    orientation: "portrait-primary",
    categories: ["social", "productivity"],
    icons: [
      {
        src: "/icons/tribely-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
