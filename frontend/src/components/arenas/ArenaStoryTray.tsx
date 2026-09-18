"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Send } from "lucide-react";
import { useApp } from "@/context/AppContext";

// Arena story local types
interface ArenaProofSlide {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  imageUrl: string;
  selfieUrl?: string | null;
  telemetry: string;
  caption: string;
  timeAgo: string;
}

interface ArenaStoryGroup {
  arenaId: string;
  arenaName: string;
  shortcutName: string;
  tag: string;
  icon: string;
  unreadCount: number;
  hasUnread: boolean;
  slides: ArenaProofSlide[];
  rawArenaId?: number;
}

export const ArenaStoryTray: React.FC = () => {
  const { arenas, feedPosts, storyUsers, triggerHaptic, showToast, sendTribeMessage, openDm } = useApp();

  const [activeStoryGroup, setActiveStoryGroup] = useState<ArenaStoryGroup | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const SLIDE_DURATION_MS = 5000;
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Build real arena story groups from context data
  const arenaStoryGroups: ArenaStoryGroup[] = arenas.map((arena) => {
    // Find today's feed posts for this arena
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const arenaPostsToday = feedPosts.filter(
      (p) => p.arenaId === arena.id && new Date(p.verifiedTime).getTime() > 0
    );

    const slides: ArenaProofSlide[] = arenaPostsToday.map((post) => ({
      id: post.id,
      authorName: post.userName,
      authorHandle: post.userHandle,
      authorAvatar: post.userAvatar,
      imageUrl: post.mainImage,
      selfieUrl: post.selfiePiP,
      telemetry: post.telemetry || "Daily habit verified",
      caption: post.caption,
      timeAgo: post.timeAgo,
    }));

    // Also include peer story users for this arena that have proofs
    storyUsers.forEach((su) => {
      if (su.arenaId === arena.rawId && su.latestProof && su.status === "verified" && su.id !== "self") {
        if (!slides.find((s) => s.authorHandle === su.username)) {
          slides.push({
            id: `story_${su.id}`,
            authorName: su.name,
            authorHandle: su.username,
            authorAvatar: su.avatar,
            imageUrl: su.latestProof.imageUrl,
            selfieUrl: su.latestProof.selfieUrl,
            telemetry: su.latestProof.telemetry,
            caption: su.latestProof.caption,
            timeAgo: su.latestProof.timeAgo,
          });
        }
      }
    });

    return {
      arenaId: arena.id,
      arenaName: arena.name,
      shortcutName: arena.name.split(" ").slice(0, 2).join(" "),
      tag: arena.tag,
      icon: arena.emoji,
      unreadCount: slides.length,
      hasUnread: slides.length > 0,
      slides,
      rawArenaId: arena.rawId,
    };
  });

  // Auto-advancing story timer
  useEffect(() => {
    if (!activeStoryGroup || isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    const increment = (stepMs / SLIDE_DURATION_MS) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoryGroup, currentSlideIndex, isPaused]);

  useEffect(() => {
    if (progress >= 100 && activeStoryGroup && !isPaused) {
      handleNextSlide();
      setProgress(0);
    }
  }, [progress, activeStoryGroup, isPaused]);

  const handleOpenGroup = (group: ArenaStoryGroup) => {
    if (!group.slides.length) {
      showToast("No proofs submitted in this arena yet today.", "info");
      return;
    }
    triggerHaptic([15]);
    setActiveStoryGroup(group);
    setCurrentSlideIndex(0);
    setProgress(0);
    setIsPaused(false);
  };

  const handleCloseStory = () => {
    setActiveStoryGroup(null);
    setProgress(0);
    setIsPaused(false);
  };

  const handleNextSlide = () => {
    if (!activeStoryGroup) return;
    if (currentSlideIndex < activeStoryGroup.slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
      setProgress(0);
      triggerHaptic([10]);
    } else {
      handleCloseStory();
    }
  };

  const handlePrevSlide = () => {
    if (!activeStoryGroup) return;
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
      setProgress(0);
      triggerHaptic([10]);
    }
  };

  const handleQuickReact = (emoji: string) => {
    triggerHaptic([20, 30]);
    if (activeStoryGroup) {
      const slide = activeStoryGroup.slides[currentSlideIndex];
      sendTribeMessage(`Reacted ${emoji} to @${slide.authorHandle}'s story drop!`);
      showToast(`${emoji} Props sent to @${slide.authorHandle}!`, "fire");
    }
  };

  const activeSlide: ArenaProofSlide | null =
    activeStoryGroup && activeStoryGroup.slides[currentSlideIndex]
      ? activeStoryGroup.slides[currentSlideIndex]
      : null;

  if (!arenas.length) return null;

  return (
    <>
      <div className="px-4 mb-4">
        <div className="w-full bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs select-none transition-colors">
          {/* Section Header */}
          <div className="mb-3 px-0.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-neutral-900 dark:text-white tracking-tight">
                Tribe Proofs
              </h2>
              {arenaStoryGroups.some((g) => g.hasUnread) && (
                <span className="px-2 py-0.5 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[10px] font-medium text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/25">
                  New
                </span>
              )}
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">Active Today</span>
          </div>

          {/* Horizontal Story Rings Carousel */}
          <div className="flex items-center gap-4 overflow-x-auto py-1 no-scrollbar">
            {arenaStoryGroups.map((group) => (
              <div
                key={group.arenaId}
                className="flex flex-col items-center shrink-0 w-[72px] text-center cursor-pointer group"
                onClick={() => handleOpenGroup(group)}
              >
                {/* Arena Icon Circle Avatar */}
                <div className="relative">
                  <div
                    className={`w-14 h-14 rounded-full p-0.5 flex items-center justify-center transition-all duration-200 border-2 ${
                      group.hasUnread
                        ? "border-[#1A73E8] dark:border-[#8AB4F8]"
                        : "border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-[#F1F3F4] dark:bg-[#202124] flex items-center justify-center text-xl overflow-hidden group-hover:scale-105 transition-transform duration-200">
                      <span>{group.icon}</span>
                    </div>
                  </div>

                  {/* Unread Counter Pill Badge */}
                  {group.unreadCount > 0 && (
                    <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#1A73E8] border-2 border-white dark:border-[#121212] text-[9px] font-medium text-white shadow-xs">
                      {group.unreadCount}
                    </div>
                  )}
                </div>

                {/* Arena Shortcut Label */}
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white truncate max-w-[70px] mt-1.5 leading-tight">
                  {group.shortcutName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FULL-SCREEN STORY MODAL ── */}
      <AnimatePresence>
        {activeStoryGroup && activeSlide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-neutral-950 flex flex-col justify-between shadow-2xl border border-neutral-900"
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              {/* Top Segmented Progress Bars */}
              <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
                {activeStoryGroup.slides.map((slide, idx) => {
                  let fillPercent = 0;
                  if (idx < currentSlideIndex) fillPercent = 100;
                  else if (idx === currentSlideIndex) fillPercent = progress;

                  return (
                    <div key={slide.id} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-75"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Top Header */}
              <div className="absolute top-7 left-4 right-4 z-30 flex items-center justify-between text-white drop-shadow-md">
                <div className="flex items-center gap-2.5">
                  <img
                    src={activeSlide.authorAvatar}
                    alt={activeSlide.authorName}
                    className="w-9 h-9 rounded-full object-cover border border-white/40 shadow"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black tracking-tight">{activeSlide.authorName}</span>
                      <span className="text-[10px] text-white/70 font-semibold">
                        @{activeSlide.authorHandle}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                      <span>{activeStoryGroup.tag}</span>
                      <span className="text-white/50">•</span>
                      <span className="text-white/70 font-medium">{activeSlide.timeAgo}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseStory}
                  className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Photo Media Canvas */}
              <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                {activeSlide.imageUrl ? (
                  <img
                    src={activeSlide.imageUrl}
                    alt={activeSlide.caption}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center text-6xl">
                    {activeStoryGroup.icon}
                  </div>
                )}

                {/* Tap zones */}
                <div className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrevSlide(); }} />
                <div className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNextSlide(); }} />

                {/* Telemetry Badge */}
                <div className="absolute bottom-24 left-4 right-4 z-20 pointer-events-none">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-cyan-300 shadow-xl mb-2">
                    <Zap className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400" />
                    <span>{activeSlide.telemetry}</span>
                  </div>
                  <p className="text-xs text-white drop-shadow font-medium leading-relaxed max-w-[90%]">
                    {activeSlide.caption}
                  </p>
                </div>
              </div>

              {/* Bottom Quick-Reaction Bar */}
              <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  {["🔥", "⚡", "👏", "💪"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleQuickReact(emoji)}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur flex items-center justify-center text-lg active:scale-90 transition cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleCloseStory();
                    openDm(
                      activeStoryGroup.arenaId,
                      activeStoryGroup.arenaName,
                      activeStoryGroup.tag,
                      activeStoryGroup.rawArenaId
                    );
                  }}
                  className="px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>DM Props</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
