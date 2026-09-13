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
import { CheckCircle2, Sparkles, Flame } from "lucide-react";

function FeedContent() {
  const { activeTab, setActiveTab, feedPosts, openCamera, hasMoreFeed, loadMoreFeedPosts } = useApp();
  const sentinelRef = React.useRef<HTMLDivElement>(null);

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
