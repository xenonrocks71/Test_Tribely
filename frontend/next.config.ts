import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
              "img-src 'self' * data: blob:",
              "font-src 'self' * data:",
              "connect-src 'self' * ws: wss: http: https:",
              "media-src 'self' * data: blob:",
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
