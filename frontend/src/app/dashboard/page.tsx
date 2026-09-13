"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppProvider, useApp, NavTab } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";
import { StoryTray } from "@/components/feed/StoryTray";
import { SuggestedSquadsCard } from "@/components/feed/SuggestedSquadsCard";
import { ProofCard } from "@/components/feed/ProofCard";
import { CaughtUpDivider } from "@/components/feed/CaughtUpDivider";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { ProofReplyModal } from "@/components/feed/ProofReplyModal";
import { CameraModal } from "@/components/capture/CameraModal";
import { ProfileView } from "@/components/profile/ProfileView";
import { ArenasView } from "@/components/arenas/ArenasView";
import { VaultView } from "@/components/vault/VaultView";
import { TribeChatDrawer } from "@/components/chat/TribeChatDrawer";
import { CheckCircle2, Flame, Camera } from "lucide-react";

function DashboardContent() {
  const {
    activeTab,
    setActiveTab,
    feedPosts,
    isLoadingFeed,
    openCamera,
    hasMoreFeed,
    loadMoreFeedPosts,
  } = useApp();
  const searchParams = useSearchParams();
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const tabParam = searchParams.get("tab") as NavTab;
    if (tabParam && ["feed", "explore", "vault", "profile", "squads"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams, setActiveTab]);

  // Infinite scroll observer
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
        <div className="w-full">
          {/* 1. Top Ephemeral Story Tray (Clean Instagram Style) */}
          <StoryTray />

          {/* 2. Vertical Feed of Verified Habit Proof Drops or Empty Feed Canvas */}
          {isLoadingFeed && feedPosts.length === 0 ? (
            <FeedSkeleton />
          ) : feedPosts.length === 0 ? (
            <div className="py-20 px-6 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.15)] animate-pulse">
                <Camera className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <h3 className="text-base font-black text-white tracking-tight">Your Squad Feed is Quiet</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Drop your first daily proof or explore active squads to build habits together.
                </p>
              </div>
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={openCamera}
                  className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  Drop Daily Proof
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("explore")}
                  className="px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold transition cursor-pointer"
                >
                  Discover Squads
                </button>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const firstPublicIndex = feedPosts.findIndex((p) => !p.isJoined);
                return (
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-900/80">
                    {feedPosts.map((post, index) => (
                      <React.Fragment key={post.id}>
                        {index === firstPublicIndex && firstPublicIndex > 0 && (
                          <CaughtUpDivider />
                        )}
                        <ProofCard post={post} />
                        {/* Interleave Suggested Squads after the 2nd post */}
                        {index === 1 && <SuggestedSquadsCard />}
                      </React.Fragment>
                    ))}
                    {firstPublicIndex === -1 && !hasMoreFeed && feedPosts.length > 0 && (
                      <CaughtUpDivider />
                    )}
                  </div>
                );
              })()}

              {/* Infinite Scroll Sentinel & Subtle Bottom Spinner */}
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
            </>
          )}
        </div>
      )}

      {activeTab === "explore" && <ArenasView viewMode="search" />}
      {activeTab === "squads" && <ArenasView viewMode="enrolled" />}
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Loading Tribely...</div>}>
      <AppProvider>
        <AppShell>
          <DashboardContent />
        </AppShell>
      </AppProvider>
    </Suspense>
  );
}
