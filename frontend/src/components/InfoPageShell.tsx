import Link from "next/link";
import FastLink from "@/components/FastLink";
import React from "react";
import { Flame } from "lucide-react";
import Image from "next/image";

interface InfoPageShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export default function InfoPageShell({
  title,
  subtitle,
  icon,
  children,
}: InfoPageShellProps) {
  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{ background: "var(--bg)", color: "var(--fg)" }}
    >
      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-30 px-5 sm:px-8 h-16 flex items-center justify-between glass-header"
      >
        <FastLink href="/" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md transition transform group-hover:scale-105 overflow-hidden border border-[var(--border)] relative"
            style={{ background: "#FFFFFF" }}
          >
            <Image src="/icons/BrandNewLook.png" alt="Tribely" fill priority sizes="40px" style={{ objectFit: "contain" }} />
          </div>
          <div>
            <span
              className="font-black text-lg tracking-tight block leading-none"
              style={{ color: "var(--fg)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
            >
              Tribely
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
              Protocol Docs
            </span>
          </div>
        </FastLink>

        <FastLink
          href="/login"
          className="btn-accent px-5 py-2 rounded-xl text-xs font-extrabold shadow-md transition active:scale-95"
        >
          Sign in
        </FastLink>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        {/* Page Heading */}
        <div>
          {icon && (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              {icon}
            </div>
          )}
          <h1
            className="text-3xl sm:text-4xl font-black tracking-tight"
            style={{ color: "var(--fg)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm sm:text-base font-medium" style={{ color: "var(--fg-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Content Card */}
        <div
          className="glass-card rounded-3xl p-7 sm:p-9 space-y-6 text-sm leading-relaxed"
          style={{
            color: "var(--fg-muted)",
          }}
        >
          {children}
        </div>

        {/* Back Link */}
        <div className="pt-2 flex items-center gap-5 text-xs sm:text-sm">
          <FastLink
            href="/"
            className="inline-flex items-center gap-1.5 font-bold transition hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </FastLink>
          <FastLink
            href="/feed"
            prefetchApi="/api/arenas/"
            className="inline-flex items-center gap-1.5 font-bold transition hover:opacity-80"
            style={{ color: "var(--fg-muted)" }}
          >
            Feed →
          </FastLink>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer
        className="border-t py-8 text-xs text-center font-medium"
        style={{ borderColor: "var(--border)", color: "var(--fg-subtle)" }}
      >
        © {new Date().getFullYear()} Tribely Technologies. All rights reserved.
      </footer>
    </div>
  );
}
