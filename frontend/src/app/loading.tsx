"use client";

import React from "react";
import Image from "next/image";

/**
 * Route-level loading state for Tribely Next.js App Router.
 * Displays the Tribely BrandLogo with Meta-style centered emblem and sleek footer.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#000000] select-none transition-colors">
      {/* ── CENTER LOGO WITH AURA ── */}
      <div className="relative flex flex-col items-center justify-center">
        <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#A855F7]/15 via-[#0099FF]/15 to-[#10B981]/15 blur-2xl dark:opacity-70 opacity-30 animate-pulse pointer-events-none" />
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 shrink-0">
          <Image
            src="/icons/BrandLogo.png"
            alt="Tribely"
            fill
            priority
            sizes="(max-width: 640px) 160px, 192px"
            className="object-contain drop-shadow-sm"
          />
        </div>
      </div>

      {/* ── META STYLE FOOTER ── */}
      <div className="absolute bottom-10 sm:bottom-12 flex flex-col items-center justify-center gap-1">
        <div className="w-14 h-[2px] rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-2.5">
          <div className="w-full h-full bg-gradient-to-r from-[#A855F7] via-[#0099FF] to-[#10B981] animate-pulse" />
        </div>
        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-neutral-400 dark:text-neutral-500">
          from
        </span>
        <span className="text-xs sm:text-[13px] font-extrabold tracking-[0.3em] uppercase bg-gradient-to-r from-[#A855F7] via-[#0099FF] to-[#10B981] bg-clip-text text-transparent">
          Tribely
        </span>
      </div>
    </div>
  );
}

