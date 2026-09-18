"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Meta-style smooth timing: 1.1s display, 350ms graceful fade-out exit
    const fadeTimer = setTimeout(() => setFadeOut(true), 1100);
    const hideTimer = setTimeout(() => setVisible(false), 1500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!mounted || !visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-[#000000] select-none transition-all duration-400 ease-out ${
        fadeOut ? "opacity-0 scale-[1.03] pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        transitionProperty: "opacity, transform",
        transitionDuration: "380ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* ── CENTER HERO: BrandLogo with Meta-Style Scale Entrance & Luminescent Aura ── */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Subtle Ambient Aura */}
        <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#A855F7]/15 via-[#0099FF]/15 to-[#10B981]/15 blur-2xl dark:opacity-70 opacity-30 animate-pulse pointer-events-none" />

        {/* Full Brand Logo (Emblem + Wordmark) */}
        <div
          className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0"
          style={{
            animation: "metaPop 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <Image
            src="/icons/BrandLogo.png"
            alt="Tribely"
            fill
            priority
            sizes="(max-width: 640px) 192px, 224px"
            className="object-contain drop-shadow-sm select-none"
          />
        </div>
      </div>

      {/* ── BOTTOM META SIGNATURE FOOTER ── */}
      <div className="absolute bottom-10 sm:bottom-12 flex flex-col items-center justify-center gap-1">
        {/* Sleek Hairline Indeterminate Bar */}
        <div className="w-14 h-[2px] rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-2.5">
          <div
            className="w-full h-full bg-gradient-to-r from-[#A855F7] via-[#0099FF] to-[#10B981]"
            style={{
              animation: "metaShimmer 1.4s ease-in-out infinite",
            }}
          />
        </div>

        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-neutral-400 dark:text-neutral-500">
          from
        </span>
        <span className="text-xs sm:text-[13px] font-extrabold tracking-[0.3em] uppercase bg-gradient-to-r from-[#A855F7] via-[#0099FF] to-[#10B981] bg-clip-text text-transparent">
          Tribely
        </span>
      </div>

      <style jsx global>{`
        @keyframes metaPop {
          0% {
            opacity: 0;
            transform: scale(0.88);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes metaShimmer {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(20%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}


