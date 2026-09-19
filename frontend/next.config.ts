import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "https://tribely-backend.onrender.com" : "http://localhost:8000");
    return [
      {
        source: "/static/uploads/:path*",
        destination: `${backendUrl}/static/uploads/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' * data: blob:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' * data: blob:",
              "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' * data: blob:",
              "style-src 'self' 'unsafe-inline' *",
              "style-src-elem 'self' 'unsafe-inline' *",
              "img-src 'self' * data: blob: http: https:",
              "font-src 'self' * data:",
              "connect-src 'self' * ws: wss: http: https:",
              "media-src 'self' * data: blob: http: https:",
              "frame-src 'self' *",
              "worker-src 'self' blob:",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
