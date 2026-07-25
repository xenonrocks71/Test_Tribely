import Link from "next/link";
import TribelyLogo from "@/components/TribelyLogo";
import React from "react";

interface InfoPageShellProps {
  title: string;
  subtitle?: string;
  icon?: string;
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
        className="sticky top-0 z-30 px-5 sm:px-8 h-14 flex items-center justify-between glass"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: "var(--accent)" }}
          >
            T
          </div>
          <span
            className="font-extrabold text-base tracking-tight hidden sm:block"
            style={{ color: "var(--fg)" }}
          >
            TRIBELY
          </span>
        </Link>

        <Link
          href="/login"
          className="px-5 py-2 rounded-full text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
          style={{
            background: "var(--accent)",
            boxShadow: "0 4px 16px var(--accent-glow2)",
          }}
        >
          Sign in
        </Link>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-2xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        {/* page heading */}
        <div className="mb-10">
          {icon && (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5"
              style={{ background: "var(--accent-light)" }}
            >
              {icon}
            </div>
          )}
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--fg)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* content card */}
        <div
          className="rounded-3xl p-7 sm:p-9 space-y-5 text-sm leading-relaxed"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--fg-muted)",
          }}
        >
          {children}
        </div>

        {/* back link */}
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70"
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
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70"
            style={{ color: "var(--fg-muted)" }}
          >
            Dashboard →
          </Link>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer
        className="border-t py-8 text-xs text-center"
        style={{ borderColor: "var(--border)", color: "var(--fg-subtle)" }}
      >
        © {new Date().getFullYear()} Tribely Technologies. All rights reserved.
      </footer>
    </div>
  );
}
