"use client";

import React from "react";

const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-md skeleton-shimmer ${className}`} />
);

export const FeedSkeleton: React.FC = () => {
  return (
    <div className="w-full">
      {/* Story Tray Skeleton */}
      <div className="w-full border-b border-neutral-100 dark:border-neutral-900/60 py-3 px-3.5 overflow-hidden">
        <div className="flex items-start gap-4">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-[66px] h-[66px] rounded-full skeleton-shimmer" />
              <div className="w-10 h-2 rounded-md skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Feed Cards Skeleton */}
      {[1, 2].map((idx) => (
        <div
          key={idx}
          className="w-full bg-white dark:bg-[#0A0A0A] border-b border-neutral-100 dark:border-neutral-900/60"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-[42px] h-[42px] rounded-full skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="w-28 h-3 rounded-md skeleton-shimmer" />
                <div className="w-16 h-2 rounded-md skeleton-shimmer opacity-60" />
              </div>
            </div>
            <div className="w-6 h-6 rounded-full skeleton-shimmer" />
          </div>

          {/* Media 4:5 */}
          <div className="w-full aspect-[4/5] skeleton-shimmer" />

          {/* Action Bar Skeleton */}
          <div className="px-4 pt-2.5 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full skeleton-shimmer" />
              <div className="w-8 h-8 rounded-full skeleton-shimmer" />
              <div className="w-8 h-8 rounded-full skeleton-shimmer" />
              <div className="w-8 h-8 rounded-full skeleton-shimmer" />
            </div>
            <div className="w-8 h-8 rounded-full skeleton-shimmer" />
          </div>

          {/* Caption Skeleton */}
          <div className="px-4 py-2 space-y-1.5">
            <div className="w-16 h-3 rounded skeleton-shimmer" />
            <div className="w-3/4 h-2.5 rounded skeleton-shimmer opacity-70" />
            <div className="w-1/2 h-2.5 rounded skeleton-shimmer opacity-50" />
            <div className="w-20 h-2 rounded skeleton-shimmer opacity-40 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
};
