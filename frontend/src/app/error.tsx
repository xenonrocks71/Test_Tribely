"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled runtime application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-6 text-center shadow-2xl space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white">Something went wrong</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          An unexpected application error occurred. Our engineering team has been notified.
        </p>

        <div className="pt-2 flex items-center justify-center space-x-3">
          <button
            onClick={() => reset()}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/feed"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition border border-slate-700"
          >
            <Home className="h-4 w-4" />
            <span>Feed</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
