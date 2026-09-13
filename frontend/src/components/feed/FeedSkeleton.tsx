"use client";

import React from "react";

export const FeedSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {[1, 2].map((idx) => (
        <div
          key={idx}
          className="w-full bg-white dark:bg-[#0A0A0A] border-b border-neutral-200 dark:border-neutral-900 pb-5 pt-3"
        >
          {/* Header Skeleton */}
          <div className="flex items-center justify-between px-4 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="space-y-1.5">
                <div className="w-24 h-3 rounded-md bg-neutral-200 dark:bg-neutral-800" />
                <div className="w-16 h-2 rounded-md bg-neutral-200 dark:bg-neutral-800/60" />
              </div>
            </div>
            <div className="w-20 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </div>

          {/* Media 4:5 Viewport Skeleton */}
          <div className="w-full aspect-[4/5] bg-neutral-200 dark:bg-neutral-900 relative">
            {/* Fake PiP */}
            <div className="absolute top-3.5 left-3.5 w-22 h-28 rounded-2xl bg-neutral-300 dark:bg-neutral-800 border-2 border-white/20" />
            {/* Fake Pill */}
            <div className="absolute bottom-3.5 left-3.5 w-36 h-7 rounded-xl bg-neutral-300 dark:bg-neutral-800/80" />
          </div>

          {/* Reaction Bar Skeleton */}
          <div className="px-4 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="w-12 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="w-12 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>

          {/* Caption Skeleton */}
          <div className="px-4 mt-3 space-y-1.5">
            <div className="w-3/4 h-3 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="w-1/2 h-2.5 rounded bg-neutral-200 dark:bg-neutral-800/60" />
          </div>
        </div>
      ))}
    </div>
  );
};
