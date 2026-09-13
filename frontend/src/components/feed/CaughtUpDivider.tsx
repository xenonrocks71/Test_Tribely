"use client";

import React from "react";
import { Check, Sparkles } from "lucide-react";

export const CaughtUpDivider: React.FC = () => {
  return (
    <div className="w-full py-10 px-4 bg-gradient-to-b from-white via-neutral-50 to-white dark:from-[#0A0A0A] dark:via-neutral-950 dark:to-[#0A0A0A] border-y border-neutral-200 dark:border-neutral-900 flex flex-col items-center text-center space-y-3 select-none">
      {/* Instagram Classic Gradient Ring Checkmark */}
      <div className="relative w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
        <div className="w-full h-full rounded-full bg-white dark:bg-neutral-950 flex items-center justify-center">
          <Check className="w-7 h-7 text-emerald-500 stroke-[3]" />
        </div>
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-black text-neutral-900 dark:text-white tracking-tight">
          You're All Caught Up
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          You've seen all latest verified proof drops from your enrolled accountability squads.
        </p>
      </div>

      {/* Transition to Suggested Public Posts */}
      <div className="w-full pt-4 max-w-md">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
          </div>
          <div className="relative px-3 bg-neutral-50 dark:bg-neutral-950 text-[11px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Suggested Posts from Public Squads</span>
          </div>
        </div>
      </div>
    </div>
  );
};
