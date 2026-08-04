import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tribely",
    template: "%s · Tribely",
  },
  description:
    "Habit-tracking groups with daily proof, group chat, and real stakes when you miss a deadline.",
  applicationName: "Tribely",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tribely",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#FF5E00",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import SplashScreen from "@/components/SplashScreen";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tribely_theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased selection:bg-[#FF5E00]/20 selection:text-[#FF5E00]">
        <ThemeProvider>
          <ToastProvider>
            <SplashScreen />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
