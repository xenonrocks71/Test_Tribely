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
import { CheckCircle2, Sparkles, Flame, RotateCw } from "lucide-react";

function FeedContent() {
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
        showToast("🔄 Squad feed refreshed!", "success");
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
          className="w-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pull to Refresh Indicator */}
          <div
            className="overflow-hidden transition-all duration-200 flex flex-col items-center justify-center text-xs font-bold text-neutral-500 dark:text-neutral-400"
            style={{
              height: isPullRefreshing ? 52 : pullDistance > 0 ? pullDistance : 0,
              opacity: isPullRefreshing ? 1 : Math.min(1, pullDistance / 40),
            }}
          >
            {isPullRefreshing ? (
              <div className="flex items-center gap-2 text-emerald-500 py-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] font-black tracking-tight">Refreshing squad drops...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <RotateCw
                  className="w-4 h-4 transition-transform text-emerald-500"
                  style={{ transform: `rotate(${pullDistance * 4.5}deg)` }}
                />
                <span className="text-[11px] font-bold">
                  {pullDistance >= 50 ? "Release to refresh..." : "Pull down to refresh..."}
                </span>
              </div>
            )}
          </div>

          {/* 1. Top Ephemeral Story Tray */}
          <StoryTray />

          {/* 2. Vertical Feed of Verified Habit Proof Drops */}
          {feedPosts.length === 0 ? (
            <EmptyState
              title="Your Feed is Ready for Action"
              description="Join an arena or be the first in your tribe to drop today's verified habit proof!"
              actionLabel="Drop Today's Proof 🔥"
              onAction={() => openCamera()}
              secondaryLabel="Explore Arenas 🚀"
              onSecondaryAction={() => setActiveTab("explore")}
            />
          ) : (
            (() => {
              const firstPublicIndex = feedPosts.findIndex((p) => !p.isJoined);
              return (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-900/80">
                  {feedPosts.map((post, index) => (
                    <React.Fragment key={post.id}>
                      {index === firstPublicIndex && firstPublicIndex > 0 && (
                        <CaughtUpDivider />
                      )}
                      <ProofCard post={post} />
                      {index === 1 && <SuggestedSquadsCard />}
                    </React.Fragment>
                  ))}
                  {firstPublicIndex === -1 && !hasMoreFeed && feedPosts.length > 0 && (
                    <CaughtUpDivider />
                  )}
                </div>
              );
            })()
          )}

          {/* Infinite Scroll Sentinel & Subtle Status */}
          {feedPosts.length > 0 && (
            <div ref={sentinelRef} className="py-6 text-center flex items-center justify-center">
              {hasMoreFeed ? (
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 py-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                  <span>You're completely up to date</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "explore" && <ArenasView />}
      {activeTab === "vault" && <VaultView />}
      {activeTab === "profile" && <ProfileView />}

      {/* Camera-First Drop Modal (Bottom Shutter) */}
      <CameraModal />

      {/* Slide-Over Real-Time Tribe DM & Audio Drop Drawer */}
      <TribeChatDrawer />

      {/* Contextual Proof Discussion & Reply Bottom Sheet */}
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
