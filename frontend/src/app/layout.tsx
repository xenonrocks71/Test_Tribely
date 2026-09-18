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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tribely.mayurkpatil.in"),
  title: {
    default: "Tribely",
    template: "%s · Tribely",
  },
  description:
    "Habit-tracking groups with daily proof, group chat, and real stakes when you miss a deadline.",
  applicationName: "Tribely",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/BrandNewLook.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/BrandNewLook.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/BrandNewLook.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Tribely — Social Habit Accountability",
    description: "Habit-tracking micro-arenas with daily proof verification, group chat, and digital stakes.",
    images: [{ url: "/icons/BrandLogo.png", width: 1024, height: 1024, alt: "Tribely Logo" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tribely — Social Habit Accountability",
    description: "Habit-tracking micro-arenas with daily proof verification, group chat, and digital stakes.",
    images: ["/icons/BrandLogo.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tribely",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1A73E8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { NotificationProvider } from "./context/NotificationContext";
import SplashScreen from "@/components/SplashScreen";

import { ServiceWorkerRegister } from "@/components/common/ServiceWorkerRegister";
import { AuthWatcher } from "@/components/common/AuthWatcher";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Tribely" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var cookieMatch = document.cookie.match(/(?:^|;\\s*)tribely_theme=([^;]*)/);
                  var saved = localStorage.getItem('tribely_theme') || (cookieMatch ? decodeURIComponent(cookieMatch[1]) : null);
                  var isDark = true;
                  if (saved === 'light') {
                    isDark = false;
                  } else if (saved === 'dark') {
                    isDark = true;
                  } else if (saved === 'system') {
                    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  }
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased selection:bg-[#1A73E8]/20 selection:text-[#1A73E8]">
        <ThemeProvider>
          <ToastProvider>
            <NotificationProvider>
              <AuthWatcher />
              <SplashScreen />
              <ServiceWorkerRegister />
              {children}
            </NotificationProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


