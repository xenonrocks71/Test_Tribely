"use client";

import React from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";
import { StoryTray } from "@/components/feed/StoryTray";
import { SuggestedSquadsCard } from "@/components/feed/SuggestedSquadsCard";
import { ProofCard } from "@/components/feed/ProofCard";
import { CaughtUpDivider } from "@/components/feed/CaughtUpDivider";
import { ProofReplyModal } from "@/components/feed/ProofReplyModal";
import { CameraModal } from "@/components/capture/CameraModal";
import { ProfileView } from "@/components/profile/ProfileView";
import { ArenasView } from "@/components/arenas/ArenasView";
import { VaultView } from "@/components/vault/VaultView";
import { TribeChatDrawer } from "@/components/chat/TribeChatDrawer";
import { EmptyState } from "@/components/common/EmptyState";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Users,
  RotateCw,
} from "lucide-react";

/* ── Beautiful empty state for feed ── */
function FeedEmpty() {
  const { openCamera, setActiveTab } = useApp();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full flex flex-col items-center px-6 py-16 text-center"
    >
      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center mb-4 text-[#1A73E8] dark:text-[#8AB4F8]">
        <Flame className="w-6 h-6 fill-current" />
      </div>

      <h3 className="text-base font-semibold text-neutral-900 dark:text-white tracking-tight mb-1.5 leading-tight">
        Your feed is waiting
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[280px] leading-relaxed mb-6">
        Join a squad and drop your first verified habit proof to see your team's activity here.
      </p>

      <div className="w-full max-w-[260px] space-y-2.5">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={openCamera}
          className="w-full py-2.5 px-4 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#A8C7FA] text-white dark:text-[#121212] font-medium text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Drop Today&apos;s Proof</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab("explore")}
          className="w-full py-2.5 px-4 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Explore Squads</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ── Pull-to-refresh indicator ── */
function PullIndicator({ pullDistance, isPullRefreshing }: { pullDistance: number; isPullRefreshing: boolean }) {
  const opacity = isPullRefreshing ? 1 : Math.min(1, pullDistance / 40);
  const height = isPullRefreshing ? 52 : pullDistance > 0 ? pullDistance : 0;

  return (
    <div
      className="overflow-hidden transition-all duration-200 flex flex-col items-center justify-center"
      style={{ height, opacity }}
    >
      {isPullRefreshing ? (
        <div className="flex items-center gap-2 text-emerald-500 py-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Refreshing…</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2">
          <RotateCw
            className="w-4 h-4 text-neutral-400"
            style={{ transform: `rotate(${pullDistance * 4.5}deg)` }}
          />
          <span className="text-[12px] text-neutral-400">
            {pullDistance >= 50 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Main Feed Content ── */
export function FeedContent() {
  const {
    activeTab,
    setActiveTab,
    feedPosts,
    openCamera,
    hasMoreFeed,
    loadMoreFeedPosts,
    refreshFeed,
    refreshArenas,
    triggerHaptic,
    showToast,
  } = useApp();
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const visiblePosts = feedPosts;

  // Pull to refresh state
  const [pullDistance, setPullDistance] = React.useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = React.useState(false);
  const touchStartY = React.useRef<number | null>(null);
  const isPullingRef = React.useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (typeof window !== "undefined" && window.scrollY <= 5 && !isPullRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || touchStartY.current === null || isPullRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0 && typeof window !== "undefined" && window.scrollY <= 5) {
      const distance = Math.min(80, diff * 0.42);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || isPullRefreshing) {
      touchStartY.current = null;
      isPullingRef.current = false;
      return;
    }
    isPullingRef.current = false;
    touchStartY.current = null;

    if (pullDistance >= 50) {
      setIsPullRefreshing(true);
      triggerHaptic([20, 30]);
      try {
        await Promise.all([refreshFeed(), refreshArenas()]);
        showToast("Feed refreshed!", "success");
      } catch {}
      setTimeout(() => {
        setIsPullRefreshing(false);
        setPullDistance(0);
      }, 400);
    } else {
      setPullDistance(0);
    }
  };

  React.useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreFeed) {
          loadMoreFeedPosts();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreFeed, loadMoreFeedPosts]);

  return (
    <>
      {activeTab === "feed" && (
        <div
          className="w-full px-3 sm:px-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pull Indicator */}
          <PullIndicator pullDistance={pullDistance} isPullRefreshing={isPullRefreshing} />

          {/* Daily Squad Check-in Pulse Tray */}
          <StoryTray />

          {/* Feed Posts */}
          {visiblePosts.length === 0 ? (
            <FeedEmpty />
          ) : (
            (() => {
              const firstPublicIndex = visiblePosts.findIndex((p) => !p.isJoined);
              return (
                <div>
                  {visiblePosts.map((post, index) => (
                    <React.Fragment key={post.id}>
                      {index === firstPublicIndex && firstPublicIndex > 0 && (
                        <CaughtUpDivider />
                      )}
                      <ProofCard post={post} />
                      {index === 1 && <SuggestedSquadsCard />}
                    </React.Fragment>
                  ))}
                  {firstPublicIndex === -1 && !hasMoreFeed && visiblePosts.length > 0 && (
                    <CaughtUpDivider />
                  )}
                </div>
              );
            })()
          )}

          {/* Infinite Scroll Sentinel */}
          {visiblePosts.length > 0 && (
            <div ref={sentinelRef} className="py-8 flex items-center justify-center">
              {hasMoreFeed ? (
                <div className="w-5 h-5 border-[1.5px] border-neutral-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-2 text-[12px] text-neutral-400 dark:text-neutral-600">
                  <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                  <span>You&apos;re up to date</span>
                  <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "explore" && <ArenasView viewMode="search" />}
      {activeTab === "squads" && <ArenasView viewMode="enrolled" />}
      {activeTab === "vault" && <VaultView />}
      {activeTab === "profile" && <ProfileView />}

      {/* Modals */}
      <CameraModal />
      <TribeChatDrawer />
      <ProofReplyModal />
    </>
  );
}

export default function FeedPage() {
  return (
    <AppProvider>
      <AppShell>
        <FeedContent />
      </AppShell>
    </AppProvider>
  );
}
