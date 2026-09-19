"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Zap, X, Send, Flame, Check, ShieldCheck, Clock, Sparkles } from "lucide-react";
import { useApp, StoryUser, StorySlide } from "@/context/AppContext";
import { resolveBackendUrl } from "@/lib/api-client";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

/**
 * StoryTray -> Cohort Check-in Pulse Tray
 * 
 * Linear/Raycast-grade accountability pulse tray displaying 24h cohort cycle check-ins:
 * - Green glowing ring: Verified check-in today
 * - Amber pulsing ring: Deadline approaching (< 3 hours) with 1-tap peer nudge
 * - Orange dashed ring: Self drop pending
 * - Top Collective Multiplier ticker: 1.5x cohort streak bonus status
 */
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
  const unviewedStories = useMemo(() => {
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
    name: "Your Drop",
    username: user.username || "you",
    avatar: user.avatar,
    arenaTag: "#DailyHabit",
    status: user.hasSubmittedToday ? "verified" : "self",
  } as StoryUser];

  // Playable story users (users with valid proof slides)
  const playableUsers = useMemo(() => {
    return storiesToRender.filter((u) => {
      if (u.id === "self" && !user.hasSubmittedToday) return false;
      return (u.proofs && u.proofs.length > 0) || Boolean(u.latestProof);
    });
  }, [storiesToRender, user.hasSubmittedToday]);

  // Sync current user index and slide index when modal opens
  useEffect(() => {
    if (activeStoryModal) {
      const idx = playableUsers.findIndex((u) => u.id === activeStoryModal.id);
      setCurrentUserIndex(idx >= 0 ? idx : 0);
      setCurrentSlideIndex(0);
      setSlideProgress(0);
    }
  }, [activeStoryModal, playableUsers]);

  const activeUser = playableUsers[currentUserIndex] || activeStoryModal;

  const currentSlides: StorySlide[] = useMemo(() => {
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

  // ── Navigation Handlers ──
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

  // Auto-advancing timer
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
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStoryModal, currentUserIndex, currentSlideIndex, activeSlide]);

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
      {/* ── COHORT CHECK-IN PULSE TRAY (Google Material 3 Card) ── */}
      <div className="w-full bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs mb-4 sm:mb-5 select-none transition-colors">
        {/* Header: Clean Google Title & Status */}
        <div className="flex items-center justify-between mb-3.5 px-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-neutral-900 dark:text-white tracking-tight">
              Daily Check-ins
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[10px] font-medium text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/25">
              1.5x Multiplier
            </span>
          </div>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
            {user.hasSubmittedToday ? "✓ Checked in" : "Pending today"}
          </span>
        </div>

        {/* Pulse Avatars Row */}
        <div className="flex items-start gap-4 overflow-x-auto no-scrollbar pb-1">
          {storiesToRender.map((story) => {
            const isSelf = story.id === "self";
            const isVerified = story.status === "verified";
            const isUrgent = story.status === "urgent";
            const isMissed = story.status === "missed";
            const isViewed = viewedStoryUserIds.has(story.id);

            return (
              <motion.div
                key={story.id}
                whileTap={{ scale: 0.96 }}
                className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
                onClick={() => {
                  if (isSelf && !user.hasSubmittedToday) {
                    openCamera();
                  } else {
                    openStory(story);
                  }
                }}
              >
                {/* Avatar Pulse Ring (Google Account Style) */}
                <div className="relative">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center p-0.5 transition-all duration-200 ${
                      isSelf && !user.hasSubmittedToday
                        ? "border-2 border-dashed border-[#1A73E8] dark:border-[#8AB4F8] bg-[#1A73E8]/5 dark:bg-[#8AB4F8]/10 hover:border-[#1557B0]"
                        : isVerified
                        ? "border-2 border-[#0F9D58] dark:border-[#81C995]"
                        : isUrgent
                        ? "border-2 border-[#FBBC04]"
                        : isMissed
                        ? "border border-neutral-300 dark:border-neutral-700"
                        : isViewed
                        ? "border border-neutral-200 dark:border-neutral-800"
                        : "border-2 border-[#1A73E8] dark:border-[#8AB4F8]"
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-white dark:bg-[#1E1E1E] flex items-center justify-center overflow-hidden">
                      <AvatarWithFallback
                        avatarUrl={isSelf ? (user.avatar || story.avatar) : story.avatar}
                        name={isSelf ? user.name : story.name}
                        sizeClass="w-full h-full"
                        textClass="text-xs font-bold"
                        className={`transition-transform duration-200 group-hover:scale-105 ${isMissed ? "grayscale opacity-40" : ""} ${isViewed ? "opacity-70" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Self Add Plus Badge */}
                  {isSelf && !user.hasSubmittedToday && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#1A73E8] dark:bg-[#8AB4F8] text-white dark:text-[#121212] flex items-center justify-center border-2 border-white dark:border-[#1E1E1E] shadow-xs">
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  )}

                  {/* Verified Check Badge */}
                  {isVerified && !isSelf && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0F9D58] text-white flex items-center justify-center border-2 border-white dark:border-[#1E1E1E] shadow-xs">
                      <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                    </div>
                  )}

                  {/* Urgent Countdown Nudge Button */}
                  {isUrgent && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        nudgePeer(story);
                      }}
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#FEF7E0] dark:bg-[#F9AB00]/15 text-amber-700 dark:text-amber-300 text-[9px] font-medium flex items-center gap-0.5 border border-[#FEEFC3] dark:border-[#F9AB00]/30 shadow-xs whitespace-nowrap cursor-pointer"
                      title="Nudge peer"
                    >
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      <span>{story.countdownText || "Nudge"}</span>
                    </motion.button>
                  )}
                </div>

                {/* User Label */}
                <span
                  className={`text-[11px] font-semibold max-w-[68px] truncate text-center leading-tight ${
                    isViewed
                      ? "text-neutral-400 dark:text-neutral-500"
                      : "text-neutral-700 dark:text-neutral-200"
                  }`}
                >
                  {isSelf ? "Your Proof" : story.username}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── HIGH-STAKES PROOF INSPECTION MODAL ── */}
      <AnimatePresence>
        {activeStoryModal && activeUser && activeSlide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center select-none p-4"
          >
            {/* Story Container */}
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_e, { offset, velocity }) => {
                if (offset.x < -50 || velocity.x < -300) {
                  handleJumpToNextUser();
                } else if (offset.x > 50 || velocity.x > 300) {
                  handleJumpToPrevUser();
                }
              }}
              onPointerDown={() => {
                isPausedRef.current = true;
              }}
              onPointerUp={() => {
                isPausedRef.current = false;
              }}
              className="relative w-full max-w-md h-[88vh] bg-[#0E0E12] border border-neutral-800 rounded-3xl flex flex-col justify-between p-5 overflow-hidden shadow-2xl"
            >
              {/* Progress Bars & Header */}
              <div className="space-y-3 z-30 pointer-events-none">
                {/* Segmented Progress Bars */}
                <div className="flex items-center gap-1.5 w-full">
                  {currentSlides.map((_, sIdx) => {
                    const isCompleted = sIdx < currentSlideIndex;
                    const isActive = sIdx === currentSlideIndex;
                    return (
                      <div
                        key={sIdx}
                        className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-75 ease-linear"
                          style={{
                            width: isCompleted ? "100%" : isActive ? `${slideProgress}%` : "0%",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* User Header */}
                <div className="flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-3">
                    <AvatarWithFallback
                      avatarUrl={activeUser.id === "self" ? user.avatar : activeUser.avatar}
                      name={activeUser.id === "self" ? user.name : activeUser.name}
                      sizeClass="w-10 h-10"
                      textClass="text-sm font-bold"
                      className="border border-white/20 shadow-md rounded-xl"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white leading-tight">
                          {activeUser.name}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {activeSlide.timeAgo || "Today"}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-orange-400 block leading-tight">
                        {activeSlide.arenaTag || activeUser.arenaTag}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeStory();
                    }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition cursor-pointer backdrop-blur-sm"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Media or Proof Reflection */}
              <div className="absolute inset-0 z-0">
                {(() => {
                  const mediaUrl = activeSlide.imageUrl;
                  if (!mediaUrl || mediaUrl === "Done") {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#121217] via-[#0E0E12] to-black text-white p-8 text-center space-y-4">
                        <div className="w-20 h-20 rounded-3xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center text-3xl shadow-[0_0_40px_rgba(255,94,0,0.25)]">
                          <Flame className="w-10 h-10 fill-orange-400" />
                        </div>
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verified Daily Check-In</span>
                          </div>
                          <h3 className="text-xl font-bold text-white">
                            {activeSlide.arenaTag || activeUser.arenaTag}
                          </h3>
                          <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">
                            {activeSlide.caption || "Completed daily habit streak on schedule."}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const ytMatch = mediaUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                  if (ytMatch && ytMatch[1]) {
                    return (
                      <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden pointer-events-auto">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&playsinline=1`}
                          title="YouTube Habit Proof"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    );
                  }

                  if (
                    mediaUrl.match(/\.(mp4|webm|mov|ogg)($|\?|&)/i) ||
                    mediaUrl.startsWith("data:video/")
                  ) {
                    return (
                      <video
                        src={resolveBackendUrl(mediaUrl)}
                        autoPlay
                        loop
                        playsInline
                        muted
                        controls
                        className="w-full h-full object-cover select-none"
                      />
                    );
                  }

                  return (
                    <img
                      src={resolveBackendUrl(mediaUrl)}
                      alt="Habit Proof"
                      className="w-full h-full object-cover select-none"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  );
                })()}

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />

                {/* Caption & Anti-Cheat Badge */}
                <div className="absolute bottom-28 left-5 right-5 z-20 pointer-events-none space-y-2.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-xs font-semibold text-emerald-400 shadow-lg">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{activeSlide.telemetry || "Verified Anti-Cheat Telemetry"}</span>
                  </div>
                  <p className="text-sm font-semibold text-white/95 drop-shadow-md">
                    {activeSlide.caption || "Checked in for today's streak challenge!"}
                  </p>
                </div>
              </div>

              {/* Tap Navigation Zones */}
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

              {/* Floating Emojis */}
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

              {/* Bottom Peer Review & Reaction Dock */}
              <div className="relative z-30 space-y-2 pt-4">
                <div className="flex items-center justify-between gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
                  {["🔥", "⚡", "👏", "🎯", "💪"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleStoryEmojiReact(emoji)}
                      className="flex-1 py-1 text-xl hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Nudge or salute @${activeUser.username}…`}
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-black/60 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-orange-500 backdrop-blur-md"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        showToast(`Salute sent to @${activeUser.username}`, "success");
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      showToast(`Salute sent to @${activeUser.username}`, "success");
                    }}
                    className="p-2.5 rounded-2xl bg-orange-500 text-white hover:bg-orange-600 transition cursor-pointer shadow-md shadow-orange-500/20"
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
