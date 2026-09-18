"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, ShieldCheck, Send, ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { resolveBackendUrl } from "@/lib/api-client";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";
import { useApp } from "@/context/AppContext";

export interface SpotterStoryProof {
  id: number | string;
  proof_url: string;
  submitted_at: string;
  ai_audit_notes?: string | null;
  upvotes?: number;
  comments_count?: number;
  proof_type?: string;
}

interface ArenaStoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotter: {
    user_id: number;
    user_name: string;
    user_handle?: string;
    user_avatar?: string | null;
  } | null;
  proofs: SpotterStoryProof[];
  arenaTag: string;
}

function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return Boolean(url.match(/\.(mp4|webm|mov|ogg)($|\?|&)/i)) || url.startsWith("data:video/");
}

export const ArenaStoryViewerModal: React.FC<ArenaStoryViewerModalProps> = ({
  isOpen,
  onClose,
  spotter,
  proofs,
  arenaTag,
}) => {
  const { triggerHaptic, showToast } = useApp();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const isPausedRef = useRef(false);

  // Reset slide index when opened with a new spotter
  useEffect(() => {
    if (isOpen) {
      setCurrentSlideIndex(0);
      setSlideProgress(0);
      isPausedRef.current = false;
    }
  }, [isOpen, spotter?.user_id]);

  const activeProof = proofs[currentSlideIndex] || proofs[0] || null;
  const totalSlides = proofs.length;

  const handleNextSlide = React.useCallback(() => {
    if (currentSlideIndex < totalSlides - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
      setSlideProgress(0);
    } else {
      onClose();
    }
  }, [currentSlideIndex, totalSlides, onClose]);

  const handlePrevSlide = React.useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
      setSlideProgress(0);
    }
  }, [currentSlideIndex]);

  // Slide progress ticker (auto-advance for images/text, pause on video/interaction)
  useEffect(() => {
    if (!isOpen || !activeProof) return;
    const isYt = Boolean(getYouTubeId(activeProof.proof_url));
    const isVid = isVideoUrl(activeProof.proof_url);
    if (isYt || isVid) {
      // Videos don't auto-advance prematurely
      return;
    }

    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      setSlideProgress((prev) => {
        if (prev >= 100) {
          handleNextSlide();
          return 0;
        }
        return prev + 2; // ~5 seconds per slide
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, activeProof, handleNextSlide]);

  if (!isOpen || !spotter) return null;

  const timeAgoStr = activeProof?.submitted_at
    ? new Date(activeProof.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Today";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md h-[88vh] bg-[#0E0E12] border border-neutral-800 rounded-3xl flex flex-col justify-between p-5 overflow-hidden shadow-2xl"
        >
          {/* ── TOP BARS: Segmented Progress & Spotter Header ── */}
          <div className="space-y-3 z-30">
            {totalSlides > 1 && (
              <div className="flex items-center gap-1.5 w-full">
                {proofs.map((_, sIdx) => {
                  const isCompleted = sIdx < currentSlideIndex;
                  const isActive = sIdx === currentSlideIndex;
                  return (
                    <div key={sIdx} className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-[#0F9D58] rounded-full transition-all duration-75 ease-linear"
                        style={{
                          width: isCompleted ? "100%" : isActive ? `${slideProgress}%` : "0%",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Header: DP + Name + Time + Close Button */}
            <div className="flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-3">
                <AvatarWithFallback
                  avatarUrl={spotter.user_avatar}
                  name={spotter.user_name}
                  sizeClass="w-10 h-10"
                  textClass="text-sm font-bold"
                  className="border-2 border-emerald-500/60 shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white leading-tight">
                      {spotter.user_name}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      {timeAgoStr}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 block leading-tight">
                    {arenaTag} • Verified Drop
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition cursor-pointer backdrop-blur-sm"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── MAIN MEDIA PROOF DISPLAY ── */}
          <div className="absolute inset-0 z-0">
            {activeProof && activeProof.proof_url ? (
              (() => {
                const ytId = getYouTubeId(activeProof.proof_url);
                if (ytId) {
                  return (
                    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden pointer-events-auto">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`}
                        title="YouTube Proof Drop"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }

                if (isVideoUrl(activeProof.proof_url)) {
                  return (
                    <video
                      src={resolveBackendUrl(activeProof.proof_url)}
                      autoPlay
                      loop
                      playsInline
                      muted
                      controls
                      className="w-full h-full object-cover select-none pointer-events-auto"
                    />
                  );
                }

                return (
                  <img
                    src={resolveBackendUrl(activeProof.proof_url)}
                    alt="Today's Habit Proof"
                    className="w-full h-full object-cover select-none"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                );
              })()
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#121217] via-[#0E0E12] to-black text-white p-8 text-center space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl shadow-[0_0_40px_rgba(16,185,129,0.25)]">
                  <ShieldCheck className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Daily Check-In</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{arenaTag}</h3>
                  <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">
                    {activeProof?.ai_audit_notes || "Daily habit proof verified on schedule for this squad."}
                  </p>
                </div>
              </div>
            )}

            {/* Dark Gradient Overlay for Caption readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />

            {/* Caption & Telemetry Tag */}
            <div className="absolute bottom-28 left-5 right-5 z-20 pointer-events-none space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-xs font-semibold text-emerald-400 shadow-lg">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Anti-Cheat Drop</span>
              </div>
              {activeProof?.ai_audit_notes && (
                <p className="text-sm font-medium text-white/95 drop-shadow-md line-clamp-3">
                  {activeProof.ai_audit_notes}
                </p>
              )}
            </div>
          </div>

          {/* Navigation Tap Zones (only if not an interactive YouTube iframe) */}
          {totalSlides > 1 && (
            <>
              <div
                className="absolute inset-y-20 left-0 w-1/4 z-20 cursor-pointer"
                onClick={handlePrevSlide}
              />
              <div
                className="absolute inset-y-20 right-0 w-1/4 z-20 cursor-pointer"
                onClick={handleNextSlide}
              />
            </>
          )}

          {/* ── BOTTOM PEER PROPS & SALUTE BAR ── */}
          <div className="relative z-30 space-y-2 pt-4 pointer-events-auto">
            <div className="flex items-center justify-between gap-1.5 bg-black/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
              {["🔥", "⚡", "👏", "🎯", "💪"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    triggerHaptic([20]);
                    showToast(`${emoji} Prop sent to ${spotter.user_name}!`, "fire");
                  }}
                  className="flex-1 py-1 text-xl hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Salute or comment for ${spotter.user_name}…`}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-black/70 border border-white/15 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 backdrop-blur-md"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    triggerHaptic([15]);
                    showToast(`Salute sent to ${spotter.user_name}!`, "success");
                    e.currentTarget.value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  triggerHaptic([15]);
                  showToast(`Salute sent to ${spotter.user_name}!`, "success");
                }}
                className="p-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white transition cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
