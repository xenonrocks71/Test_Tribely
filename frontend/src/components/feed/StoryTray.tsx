"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Zap, X, Send, ChevronRight, ChevronLeft } from "lucide-react";
import { useApp, StoryUser, StorySlide } from "@/context/AppContext";

export const StoryTray: React.FC = () => {
  const {
    storyUsers,
    openStory,
    openCamera,
    user,
    nudgePeer,
    activeStoryModal,
    closeStory,
    triggerHaptic,
    showToast,
    viewedStoryUserIds,
    markStoryAsViewed,
  } = useApp();

  // Active playing states
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const isPausedRef = useRef(false);

  // Filter clean unviewed stories (always keep self so user can drop/view their own proof)
  const unviewedStories = React.useMemo(() => {
    return storyUsers.filter((s) => {
      const u = (s.username || "").toLowerCase();
      const n = (s.name || "").toLowerCase();
      const isClean =
        !u.includes("phase") &&
        !u.includes("smoke") &&
        !u.includes("test") &&
        !u.startsWith("member_") &&
        !u.startsWith("sub_") &&
        !u.startsWith("creator_") &&
        !n.includes("phase") &&
        !n.includes("smoke") &&
        !n.includes("test");
      if (!isClean) return false;
      if (s.id === "self") return true;
      return !viewedStoryUserIds.has(s.id);
    });
  }, [storyUsers, viewedStoryUserIds]);

  const storiesToRender = unviewedStories.length > 0 ? unviewedStories : [{
    id: "self",
    name: "Your Story",
    username: user.username || "you",
    avatar: user.avatar,
    arenaTag: "#DailyHabit",
    status: user.hasSubmittedToday ? "verified" : "self",
  } as StoryUser];

  // Playable story users (users with valid proof slides)
  const playableUsers = React.useMemo(() => {
    return storiesToRender.filter((u) => {
      if (u.id === "self" && !user.hasSubmittedToday) return false;
      return (u.proofs && u.proofs.length > 0) || Boolean(u.latestProof);
    });
  }, [storiesToRender, user.hasSubmittedToday]);

  // When a story modal is opened, sync current user index and slide index
  useEffect(() => {
    if (activeStoryModal) {
      const idx = playableUsers.findIndex((u) => u.id === activeStoryModal.id);
      setCurrentUserIndex(idx >= 0 ? idx : 0);
      setCurrentSlideIndex(0);
      setSlideProgress(0);
    }
  }, [activeStoryModal, playableUsers]);

  const activeUser = playableUsers[currentUserIndex] || activeStoryModal;

  const currentSlides: StorySlide[] = React.useMemo(() => {
    if (!activeUser) return [];
    if (activeUser.proofs && activeUser.proofs.length > 0) {
      return activeUser.proofs;
    }
    if (activeUser.latestProof) {
      return [activeUser.latestProof];
    }
    return [];
  }, [activeUser]);

  const activeSlide = currentSlides[currentSlideIndex] || currentSlides[0];

  // ── Navigation Functions (Instagram Standards) ──
  const handleJumpToNextUser = useCallback(() => {
    triggerHaptic([20]);
    if (activeUser && activeUser.id !== "self") {
      markStoryAsViewed(activeUser.id);
    }
    const nextIdx = currentUserIndex + 1;
    if (nextIdx < playableUsers.length) {
      setCurrentUserIndex(nextIdx);
      setCurrentSlideIndex(0);
      setSlideProgress(0);
    } else {
      closeStory();
    }
  }, [activeUser, currentUserIndex, playableUsers.length, markStoryAsViewed, closeStory, triggerHaptic]);

  const handleJumpToPrevUser = useCallback(() => {
    triggerHaptic([20]);
    const prevIdx = currentUserIndex - 1;
    if (prevIdx >= 0) {
      setCurrentUserIndex(prevIdx);
      setCurrentSlideIndex(0);
      setSlideProgress(0);
    }
  }, [currentUserIndex, triggerHaptic]);

  const handleNextSlide = useCallback(() => {
    if (currentSlideIndex < currentSlides.length - 1) {
      triggerHaptic([15]);
      setCurrentSlideIndex((prev) => prev + 1);
      setSlideProgress(0);
    } else {
      handleJumpToNextUser();
    }
  }, [currentSlideIndex, currentSlides.length, handleJumpToNextUser, triggerHaptic]);

  const handlePrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      triggerHaptic([15]);
      setCurrentSlideIndex((prev) => prev - 1);
      setSlideProgress(0);
    } else {
      handleJumpToPrevUser();
    }
  }, [currentSlideIndex, handleJumpToPrevUser, triggerHaptic]);

  // ── Auto-Advancing 5-Second Timer ──
  useEffect(() => {
    if (!activeStoryModal || !activeSlide) {
      setSlideProgress(0);
      return;
    }

    setSlideProgress(0);
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      setSlideProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2; // ~5 seconds (50 ticks * 100ms)
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStoryModal, currentUserIndex, currentSlideIndex, activeSlide]);

  // Advance when slide timer finishes
  useEffect(() => {
    if (slideProgress >= 100 && activeStoryModal) {
      handleNextSlide();
    }
  }, [slideProgress, activeStoryModal, handleNextSlide]);

  const handleStoryEmojiReact = (emoji: string) => {
    triggerHaptic([30, 40]);
    const id = Date.now() + Math.random();
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 1000);
    showToast(`Sent ${emoji} to @${activeUser?.username}!`, "fire");
  };

  return (
    <>
      {/* ── HORIZONTAL STORY TRAY CAROUSEL (Light & Dark Theme Seamless) ── */}
      <div className="w-full bg-white dark:bg-[#0A0A0A] border-b border-neutral-200 dark:border-neutral-900/80 py-3.5 px-3 overflow-x-auto no-scrollbar select-none transition-colors">
        <div className="flex items-start gap-3.5 min-w-max">
          {storiesToRender.map((story) => {
            const isSelf = story.id === "self";
            const isVerified = story.status === "verified";
            const isUrgent = story.status === "urgent";
            const isMissed = story.status === "missed";

            return (
              <div
                key={story.id}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
                onClick={() => {
                  if (isSelf && !user.hasSubmittedToday) {
                    openCamera();
                  } else {
                    openStory(story);
                  }
                }}
              >
                {/* Avatar Ring Container */}
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full p-[2.5px] transition-all duration-300 flex items-center justify-center ${
                      isSelf && !user.hasSubmittedToday
                        ? "border-2 border-dashed border-emerald-500/70 hover:border-emerald-400 p-0"
                        : isVerified
                        ? "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-[0_0_12px_rgba(220,39,67,0.35)] scale-102"
                        : isUrgent
                        ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-500 animate-pulse shadow-[0_0_14px_rgba(244,63,94,0.4)]"
                        : "bg-neutral-300 dark:bg-neutral-800"
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-white dark:bg-[#0A0A0A] p-[2px] overflow-hidden">
                      <img
                        src={story.avatar}
                        alt={story.name}
                        className={`w-full h-full object-cover rounded-full transition-transform duration-300 group-hover:scale-105 ${
                          isMissed ? "grayscale opacity-50" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Floating Action Badges */}
                  {isSelf && !user.hasSubmittedToday && (
                    <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center border-2 border-white dark:border-[#0A0A0A] shadow-md">
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  {isUrgent && (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        nudgePeer(story);
                      }}
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black tracking-tight flex items-center gap-0.5 border border-white dark:border-[#0A0A0A] shadow-md whitespace-nowrap hover:bg-rose-400 transition-colors cursor-pointer"
                      title="1-Tap Nudge peer"
                    >
                      <Zap className="w-2.5 h-2.5 fill-white" />
                      <span>{story.countdownText || "Nudge"}</span>
                    </motion.button>
                  )}

                  {isVerified && !isSelf && (
                    <div className="absolute -bottom-0.5 right-0 w-4 h-4 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center border-2 border-white dark:border-[#0A0A0A] text-[8px] font-black shadow-sm">
                      ✓
                    </div>
                  )}
                </div>

                {/* Username / Tag Label */}
                <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 max-w-[64px] truncate text-center leading-tight">
                  {isSelf ? "Your Proof" : story.username}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FULL-SCREEN INSTAGRAM EPHEMERAL STORY PLAYER WITH COMPLETE GESTURES ── */}
      <AnimatePresence>
        {activeStoryModal && activeUser && activeSlide && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
          >
            {/* Story Container (Instagram 9:16 Aspect) with Horizontal Swipe Gesture */}
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, { offset, velocity }) => {
                const swipeThreshold = 50;
                if (offset.x < -swipeThreshold || velocity.x < -300) {
                  // Swiped right to left: skip all stories from current user and direct jump to next user's stories!
                  handleJumpToNextUser();
                } else if (offset.x > swipeThreshold || velocity.x > 300) {
                  // Swiped left to right: jump to previous user's stories
                  handleJumpToPrevUser();
                }
              }}
              onPointerDown={() => {
                isPausedRef.current = true;
              }}
              onPointerUp={() => {
                isPausedRef.current = false;
              }}
              className="relative w-full max-w-md h-full bg-neutral-950 flex flex-col justify-between p-4 overflow-hidden"
            >
              {/* ── TOP HEADER & TIMED SEGMENTED PROGRESS BARS ── */}
              <div className="space-y-3 z-30 pointer-events-none">
                {/* Segmented Progress Bars (1 per slide for current user) */}
                <div className="flex items-center gap-1.5 w-full">
                  {currentSlides.map((_, sIdx) => {
                    const isCompleted = sIdx < currentSlideIndex;
                    const isActive = sIdx === currentSlideIndex;
                    return (
                      <div
                        key={sIdx}
                        className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-white rounded-full transition-all duration-75"
                          style={{
                            width: isCompleted ? "100%" : isActive ? `${slideProgress}%` : "0%",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* User Header Info & Close Button */}
                <div className="flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={activeUser.avatar}
                      alt={activeUser.name}
                      className="w-9 h-9 rounded-full object-cover border border-white/30 shadow-md"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">{activeUser.name}</span>
                        <span className="text-[10px] text-neutral-300 font-medium">
                          • {activeSlide.timeAgo || "Today"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 block">
                        {activeSlide.arenaTag || activeUser.arenaTag}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeStory();
                    }}
                    className="p-1.5 rounded-full bg-black/50 text-neutral-200 hover:text-white border border-white/15 cursor-pointer backdrop-blur-md"
                    aria-label="Close Story"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* ── MAIN MEDIA CANVAS (Pure Clean Proof) ── */}
              <div className="absolute inset-0 z-0">
                {activeSlide.imageUrl && activeSlide.imageUrl !== "Done" ? (
                  <img
                    src={activeSlide.imageUrl}
                    alt="Habit Proof"
                    className="w-full h-full object-cover select-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-black text-white p-8 text-center space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      ✓
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                        Verified Proof Drop
                      </span>
                      <h3 className="text-lg font-black text-white">
                        {activeSlide.arenaTag || activeUser.arenaTag}
                      </h3>
                      <p className="text-xs text-neutral-400 max-w-xs">
                        {activeSlide.caption || "Completed daily habit streak on schedule."}
                      </p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/50 pointer-events-none" />

                {/* Telemetry & Caption Badge */}
                <div className="absolute bottom-28 left-4 right-4 z-20 pointer-events-none">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-xs font-black text-white shadow-lg mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{activeSlide.telemetry || "✅ Verified Proof"}</span>
                  </div>
                  <p className="text-sm font-semibold text-white/95 drop-shadow-md">
                    {activeSlide.caption || "Checked in for the day!"}
                  </p>
                </div>
              </div>

              {/* ── INSTAGRAM TAP ZONES (Left 1/3: Prev Slide / Prev User; Right 2/3: Next Slide / Next User) ── */}
              <div
                className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevSlide();
                }}
              />
              <div
                className="absolute inset-y-0 right-0 w-2/3 z-20 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextSlide();
                }}
              />

              {/* ── BURSTING FLOATING EMOJI ANIMATIONS ── */}
              <div className="absolute inset-0 pointer-events-none z-30">
                {floatingEmojis.map((item) => (
                  <motion.span
                    key={item.id}
                    initial={{ opacity: 1, y: 0, scale: 0.8 }}
                    animate={{ opacity: 0, y: -180, scale: 1.8 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    className="absolute bottom-24 right-8 text-4xl"
                  >
                    {item.emoji}
                  </motion.span>
                ))}
              </div>

              {/* ── BOTTOM QUICK-REACTION BAR & DM REPLY ── */}
              <div className="relative z-30 space-y-2 pt-4">
                {/* Fast Emoji Reaction Pills */}
                <div className="flex items-center justify-between gap-1.5 bg-black/50 backdrop-blur-md p-1.5 rounded-full border border-white/15">
                  {["🔥", "⚡", "👏", "🎯", "❤️"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleStoryEmojiReact(emoji)}
                      className="flex-1 py-1 text-lg hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Quick Reply Field */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Reply to ${activeUser.username}…`}
                    className="flex-1 px-4 py-2.5 rounded-full bg-neutral-900/90 border border-white/20 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        showToast(`Reply sent to ${activeUser.username}`, "success");
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      showToast(`Reaction sent to ${activeUser.username}`, "success");
                    }}
                    className="p-2.5 rounded-full bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
