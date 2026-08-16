"use client";

import React from "react";
import Link from "next/link";
import { HelpCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-6 text-center shadow-2xl space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <HelpCircle className="h-8 w-8" />
        </div>

        <h1 className="text-4xl font-black text-amber-400 font-mono">404</h1>
        <h2 className="text-lg font-bold text-white">Page Not Found</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The requested page or arena route does not exist or has been moved.
        </p>

        <div className="pt-2 flex justify-center">
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
