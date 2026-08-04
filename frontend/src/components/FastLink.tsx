"use client";

import React from "react";
import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import dataCache from "@/app/utils/dataCache";

interface FastLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  prefetchApi?: string | string[];
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  target?: string;
  rel?: string;
}

/**
 * Ultra-fast navigation link component.
 * Automatically pre-warms Next.js page JS bundles and API endpoint data on hover/touch.
 */
export default function FastLink({
  href,
  children,
  prefetchApi,
  onMouseEnter,
  onTouchStart,
  ...props
}: FastLinkProps) {
  const router = useRouter();

  const handlePreload = () => {
    // 1. Prefetch Next.js route JS bundle
    if (typeof href === "string" && href.startsWith("/")) {
      router.prefetch(href);
    }

    // 2. Prefetch API endpoints into dataCache memory
    if (prefetchApi) {
      const apis = Array.isArray(prefetchApi) ? prefetchApi : [prefetchApi];
      const hasToken = typeof window !== "undefined" && Boolean(localStorage.getItem("tribely_token") || localStorage.getItem("token"));
      apis.forEach((apiPath) => {
        if (apiPath) {
          const isPublic = apiPath.includes("/public") || apiPath.includes("/discovery");
          if (isPublic || hasToken) {
            dataCache.prefetch(apiPath);
          }
        }
      });
    }
  };

  return (
    <Link
      href={href}
      onMouseEnter={(e) => {
        handlePreload();
        if (onMouseEnter) onMouseEnter(e);
      }}
      onTouchStart={(e) => {
        handlePreload();
        if (onTouchStart) onTouchStart(e);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
