"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  ThumbsDown,
  MessageSquare,
  Bookmark,
  MoreHorizontal,
  ExternalLink,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Clock,
  Zap,
  Share2,
  Copy,
  Flag,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { ProofPost, useApp } from "@/context/AppContext";
import { resolveBackendUrl } from "@/lib/api-client";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";
import { formatPostActualTime, parseSafeUtcDate } from "@/lib/utils";

interface ProofCardProps {
  post: ProofPost;
}

/**
 * VideoProofPlayer
 * 
 * First-class HTML5 30-second video player for verified habit proofs:
 * - Autoplays muted with sleek audio unmute toggle
 * - Enforces 30-second habit proof clip cap
 * - Interactive play/pause overlay & time display
 * - Progress indicator & verified badge
 */
const VideoProofPlayer: React.FC<{
  src: string;
  caption?: string;
  deadlineTime?: string;
  arenaName?: string;
}> = ({ src, caption, deadlineTime, arenaName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setProgress(0);
    setCurrentTime(0);

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 30);
      video.play().catch(() => {
        setIsPlaying(false);
      });
    };

    const handleTimeUpdate = () => {
      const curr = video.currentTime;
      const dur = Math.min(video.duration || 30, 30);
      setCurrentTime(curr);
      setProgress(dur > 0 ? (curr / dur) * 100 : 0);

      // Loop after 30 seconds to maintain short proof standard
      if (curr >= 30) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };

    const handleEnded = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };

    const handleError = () => {
      setHasError(true);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const formatSeconds = (secs: number) => {
    const s = Math.floor(secs % 60);
    const m = Math.floor(secs / 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0E0E12] text-neutral-400 p-6 text-center space-y-3 select-none">
        <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-amber-500">
          <Play className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-neutral-300">Habit video clip preview unavailable</p>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-orange-400 font-bold hover:underline"
        >
          <span>Open Media File</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black group select-none overflow-hidden">
      <video
        ref={videoRef}
        src={resolveBackendUrl(src)}
        playsInline
        muted={isMuted}
        loop
        autoPlay
        className="w-full h-full object-cover cursor-pointer"
        onClick={togglePlay}
      />

      {/* Top Overlay Badges */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>30s Habit Proof Clip</span>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="pointer-events-auto p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition cursor-pointer shadow-lg"
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-neutral-300" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Center Play Button Overlay when paused */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs z-10 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-orange-500/90 text-white flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.5)] transform hover:scale-110 active:scale-95 transition-all">
            <Play className="w-7 h-7 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Bottom Timeline & Duration Controls */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-8 pb-3 px-4 z-20 pointer-events-none">
        <div className="flex items-center justify-between text-[11px] text-neutral-300 font-mono mb-1.5 font-bold">
          <span>{formatSeconds(currentTime)} / {formatSeconds(Math.min(duration || 30, 30))}</span>
          <span className="text-[10px] text-emerald-400 font-sans font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Verified Clip</span>
          </span>
        </div>

        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * ProofCard
 * 
 * High-stakes habit verification card:
 * - Peer-reviewed proof verification
 * - Habit category & squad affiliation
 * - Staking penalty and cutoff status
 * - Interactive double-tap "Streak Salute" 🔥
 * - Peer review consensus dock (upvote flame / challenge audit)
 * - First-class support for 30s video clips, images, YouTube, and external links
 */
export const ProofCard: React.FC<ProofCardProps> = ({ post }) => {
  const {
    toggleLike,
    toggleDislike,
    openProofReply,
    openInstagramStoryExport,
    joinSquad,
    triggerHaptic,
    showToast,
  } = useApp();

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [doubleTapFlame, setDoubleTapFlame] = useState<{ id: number; x: number; y: number } | null>(null);
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const [hasImgLoadError, setHasImgLoadError] = useState(false);

  const lastTapRef = useRef<number>(0);

  // ── 1. Media Type & Link Parsing ──
  const parseYouTube = (url?: string) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      let videoId: string | null = null;
      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.slice(1).split("?")[0];
      } else if (parsed.hostname.includes("youtube.com")) {
        videoId =
          parsed.searchParams.get("v") ||
          parsed.pathname.split("/").filter(Boolean).pop() ||
          null;
      }
      if (videoId) {
        return {
          videoId,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          videoUrl: url,
        };
      }
    } catch {}
    return null;
  };

  const isVideoMedia = Boolean(
    post.proofType === "video" ||
      (post.mainImage &&
        (post.mainImage.startsWith("data:video/") ||
          post.mainImage.match(/\.(mp4|webm|mov|ogg)($|\?|&)/i)))
  );

  const ytMeta = parseYouTube(post.mainImage);
  const isYouTube = Boolean(ytMeta || post.proofType === "youtube");

  const isImageMedia = Boolean(
    !isVideoMedia &&
      !isYouTube &&
      (post.proofType === "image" ||
        (post.mainImage &&
          (post.mainImage.startsWith("data:image/") ||
            post.mainImage.startsWith("blob:") ||
            post.mainImage.includes("images.unsplash.com") ||
            post.mainImage.includes("cloudinary.com") ||
            post.mainImage.includes("amazonaws.com") ||
            post.mainImage.includes("imgur.com") ||
            post.mainImage.includes("cdn.") ||
            post.mainImage.match(/\.(jpeg|jpg|gif|png|webp|avif|bmp|svg)($|\?|&)/i))))
  );

  const isLinkProof = !isVideoMedia && !isImageMedia && !isYouTube && Boolean(post.mainImage?.startsWith("http"));

  const getLinkMeta = (url: string) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host.includes("leetcode.com")) {
        const slug = parsed.pathname.split("/").filter(Boolean).pop() || "problem";
        return {
          brand: "LeetCode",
          color: "#FFA116",
          badge: "Algorithm Solution ⚡",
          title: slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          domain: "leetcode.com",
          icon: "⚡",
        };
      }
      if (host.includes("github.com")) {
        return {
          brand: "GitHub",
          color: "#8957E5",
          badge: "PR / Commit Activity 🐙",
          title: parsed.pathname.split("/").filter(Boolean).slice(0, 3).join("/") || "Repository Activity",
          domain: "github.com",
          icon: "🐙",
        };
      }
      if (host.includes("strava.com")) {
        return {
          brand: "Strava",
          color: "#FC4C02",
          badge: "GPS Tracked Workout 🏃",
          title: "Strava Fitness Activity",
          domain: "strava.com",
          icon: "🏃",
        };
      }
      return {
        brand: host.replace("www.", ""),
        color: "#FF5E00",
        badge: "Verified External Proof ↗",
        title: host + (parsed.pathname !== "/" ? parsed.pathname : ""),
        domain: host,
        icon: "🔗",
      };
    } catch {
      return {
        brand: "Live Link",
        color: "#FF5E00",
        badge: "Web Proof ↗",
        title: url,
        domain: "web",
        icon: "🔗",
      };
    }
  };

  const linkMeta = isLinkProof ? getLinkMeta(post.mainImage) : null;

  // ── 2. Double Tap "Streak Salute" Physics ──
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      triggerHaptic([30, 60]);
      setDoubleTapFlame({ id: now, x, y });
      if (post.userVote !== "upvote") {
        toggleLike(post.id);
      }

      setTimeout(() => {
        setDoubleTapFlame(null);
      }, 900);
    }
    lastTapRef.current = now;
  };

  // ── 3. Date and Time Formatting ──
  const postTime = formatPostActualTime(post.submittedAt, post.verifiedTime);

  // ── 4. Clean Caption (never show internal AI audit notes; fallback to formatted date) ──
  const cleanCaption = useMemo(() => {
    const raw = (post.caption || "").trim();
    const isAi = !raw || /ai auto-audit|confidence|\bauto-audit\b|invalid image proof format/i.test(raw);
    if (isAi) {
      try {
        const d = parseSafeUtcDate(post.submittedAt);
        return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
      } catch {
        return new Date().toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
      }
    }
    return raw;
  }, [post.caption, post.submittedAt]);

  const likesCount = post.upvotes ?? post.reactions?.fire ?? 0;
  const dislikesCount = post.downvotes ?? 0;
  const isLiked = post.userVote === "upvote";
  const isDisliked = post.userVote === "downvote";

  const arenaInitials = (post.arenaName || post.arenaTag || "TR")
    .replace(/^#/, "")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="w-full bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl shadow-xs mb-5 overflow-hidden transition-all hover:border-[#DADCE0] dark:hover:border-[#3C4043]">
      {/* ── CARD HEADER: Instagram-Style Collab Header & Post Info ── */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#E8EAED] dark:border-[#303134] bg-[#F8F9FA]/60 dark:bg-[#202124]/40">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar with Status Ring */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full p-[2px] border border-[#DADCE0] dark:border-[#3C4043]">
              <AvatarWithFallback
                avatarUrl={post.userAvatar}
                name={post.userName}
                sizeClass="w-full h-full"
                textClass="text-xs font-bold"
              />
            </div>
            {post.isJoined && (
              <div
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0F9D58] text-white flex items-center justify-center text-[8px] font-bold border-2 border-white dark:border-[#1E1E1E]"
                title="Verified Squad Member"
              >
                ✓
              </div>
            )}
          </div>

          {/* User Details & Cohort Affiliation - Instagram Collab Style */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 leading-tight">
              <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white hover:underline cursor-pointer truncate">
                {post.userName || post.userHandle}
              </span>

              {(post.arenaName || post.arenaTag) && (
                <>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal select-none">
                    and
                  </span>
                  <a
                    href={`/arenas/${post.arenaId}`}
                    className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white hover:text-[#1A73E8] dark:hover:text-[#8AB4F8] hover:underline transition-colors truncate max-w-[180px] sm:max-w-[240px]"
                    title={`Habit Squad: ${post.arenaName || post.arenaTag}`}
                  >
                    {(post.arenaName || post.arenaTag || "").replace(/^#/, "")}
                  </a>
                </>
              )}

              {post.isJoined === false && (
                <button
                  type="button"
                  onClick={() => setIsJoinSheetOpen(true)}
                  className="px-2 py-0.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs ml-1"
                >
                  <UserPlus className="w-2.5 h-2.5" />
                  <span>Join</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span title={postTime.fullDateTooltip} className="cursor-default font-medium">
                {postTime.displayTime}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#0F9D58] dark:text-[#81C995] font-semibold">
                <Check className="w-3 h-3 stroke-[2.5]" />
                <span>Verified</span>
              </span>
              {post.deadlineTime && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>Cutoff {post.deadlineTime}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Right: Options Menu */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsOptionsSheetOpen(true)}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
            aria-label="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MAIN MEDIA CANVAS ── */}
      <div
        className="relative w-full aspect-[4/5] sm:aspect-[16/11] bg-neutral-900 overflow-hidden cursor-pointer"
        onClick={handleCanvasClick}
      >
        {/* Case 0: First-Class 30s Video Habit Proof */}
        {isVideoMedia ? (
          <VideoProofPlayer
            src={post.mainImage}
            caption={post.caption}
            deadlineTime={post.deadlineTime}
            arenaName={post.arenaName}
          />
        ) : isYouTube && ytMeta ? (
          <div className="relative w-full h-full bg-black flex flex-col justify-between group">
            <img
              src={ytMeta.thumbnailUrl}
              alt="YouTube Video Proof"
              className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/50 flex flex-col justify-between p-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold w-fit">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>YouTube Video Proof</span>
              </div>

              <a
                href={ytMeta.videoUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="my-auto mx-auto w-16 h-14 rounded-2xl bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] transform hover:scale-110 active:scale-95 transition-all"
              >
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </a>

              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-300 font-medium truncate max-w-xs">
                  {post.caption || "Verified workout clip"}
                </span>
                <a
                  href={ytMeta.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-neutral-950 text-xs font-bold hover:bg-neutral-100 transition shadow-lg"
                >
                  <span>Watch Proof</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ) : isLinkProof && linkMeta ? (
          /* Case 2: Verified Digital Link Proofs (GitHub, LeetCode, Strava) */
          <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-[#131317] via-[#0E0E12] to-black text-white relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% 30%, ${linkMeta.color}, transparent 70%)`,
              }}
            />

            <div className="flex items-center justify-between z-10">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"
                style={{
                  background: `${linkMeta.color}20`,
                  color: linkMeta.color,
                  border: `1px solid ${linkMeta.color}40`,
                }}
              >
                <span>{linkMeta.icon}</span>
                <span>{linkMeta.badge}</span>
              </span>
              <span className="text-[11px] text-neutral-400 font-mono bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/10">
                {linkMeta.domain}
              </span>
            </div>

            <div className="my-auto p-5 rounded-2xl bg-white/5 border border-white/10 shadow-2xl space-y-3 backdrop-blur-md z-10">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shrink-0 shadow-lg"
                  style={{ background: linkMeta.color, color: "#000" }}
                >
                  {linkMeta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white line-clamp-1">{linkMeta.title}</h4>
                  <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5">
                    {post.caption || "Verified digital habit check-in."}
                  </p>
                </div>
              </div>

              <a
                href={post.mainImage}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-neutral-950 font-bold text-xs hover:bg-neutral-100 transition shadow-md"
              >
                <span>Inspect Repository / Activity</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="z-10 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{post.telemetry || "Verified Habit Drop"}</span>
              </span>
            </div>
          </div>
        ) : (
          /* Case 3: Clean Photo Proof */
          <>
            {post.mainImage && post.mainImage !== "Done" ? (
              hasImgLoadError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#F8F9FA] dark:bg-[#1E1E1E] text-neutral-900 dark:text-white p-6 text-center space-y-3 select-none">
                  <div className="w-12 h-12 rounded-full bg-[#E8F0FE] dark:bg-[#8AB4F8]/15 border border-[#D2E3FC] dark:border-[#8AB4F8]/30 flex items-center justify-center text-[#1A73E8] dark:text-[#8AB4F8]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <span className="text-[11px] font-medium text-[#0F9D58] dark:text-[#81C995]">
                      Verified Habit Drop
                    </span>
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {post.arenaName || "Daily Habit Streak"}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                      {post.caption || "Verified habit proof recorded in squad ledger."}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-[#282A2D] border border-neutral-200 dark:border-[#3C4043] text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                    <Clock className="w-3 h-3 text-neutral-500" />
                    <span>{post.deadlineTime ? `Cutoff ${post.deadlineTime}` : "Daily Protocol"}</span>
                  </div>
                </div>
              ) : (
                <>
                  {!isImgLoaded && (
                    <div className="absolute inset-0 bg-neutral-900 animate-pulse" />
                  )}
                  <img
                    src={resolveBackendUrl(post.mainImage)}
                    alt={post.caption || "Habit Proof"}
                    className={`w-full h-full object-cover select-none transition-opacity duration-300 ${
                      isImgLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    loading="lazy"
                    onLoad={() => setIsImgLoaded(true)}
                    onError={() => {
                      setHasImgLoadError(true);
                    }}
                  />
                </>
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#F8F9FA] dark:bg-[#1E1E1E] text-neutral-900 dark:text-white p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#E8F0FE] dark:bg-[#8AB4F8]/15 border border-[#D2E3FC] dark:border-[#8AB4F8]/30 flex items-center justify-center text-[#1A73E8] dark:text-[#8AB4F8]">
                  <Flame className="w-8 h-8 fill-current" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <span className="text-[11px] font-medium text-[#0F9D58] dark:text-[#81C995]">
                    Verified Habit Drop
                  </span>
                  <h4 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {post.arenaName || "Daily Habit Completed"}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {cleanCaption}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-[#282A2D] border border-neutral-200 dark:border-[#3C4043] text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{post.deadlineTime ? `Cutoff ${post.deadlineTime}` : "Daily Protocol"}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DOUBLE-TAP STREAK SALUTE ANIMATION ── */}
        <AnimatePresence>
          {doubleTapFlame && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1.1], opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                position: "absolute",
                left: doubleTapFlame.x - 45,
                top: doubleTapFlame.y - 45,
              }}
              className="pointer-events-none z-30 flex items-center justify-center drop-shadow-[0_4px_16px_rgba(26,115,232,0.4)]"
            >
              <Flame className="w-24 h-24 text-[#1A73E8] fill-[#1A73E8]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── ACTION & PEER CONSENSUS BAR ── */}
      <div className="px-4 sm:px-5 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Flame Salute Upvote */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              triggerHaptic([20]);
              toggleLike(post.id);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer ${
              isLiked
                ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8] dark:bg-[#8AB4F8]/20 dark:border-[#8AB4F8] dark:text-[#8AB4F8] shadow-xs"
                : "bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
            aria-label="Salute streak"
            title="Salute Streak"
          >
            <Flame
              className={`w-3.5 h-3.5 ${isLiked ? "fill-[#1A73E8] dark:fill-[#8AB4F8]" : ""}`}
            />
            <span className="hidden xs:inline">Salute</span>
            <span>{likesCount}</span>
          </motion.button>

          {/* Audit / Downvote Challenge */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              triggerHaptic([15]);
              toggleDislike(post.id);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer ${
              isDisliked
                ? "bg-[#FCE8E6] border-[#D93025] text-[#C5221F] dark:bg-[#D93025]/20 dark:border-[#F28B82] dark:text-[#F28B82] shadow-xs"
                : "bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
            aria-label="Peer audit"
            title="Peer Audit Challenge"
          >
            <ThumbsDown
              className={`w-3.5 h-3.5 ${isDisliked ? "fill-[#D93025] dark:fill-[#F28B82]" : ""}`}
            />
            <span className="hidden xs:inline">Audit</span>
            {dislikesCount > 0 && <span>{dislikesCount}</span>}
          </motion.button>

          {/* Comments & Reflections */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => openProofReply(post)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 text-xs font-medium transition cursor-pointer"
            aria-label="Comments"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{post.commentsCount || 0}</span>
          </motion.button>

          {/* Share */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={openInstagramStoryExport}
            className="p-2 rounded-full bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition cursor-pointer"
            aria-label="Share"
            title="Share Proof Card"
          >
            <Share2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* Bookmark */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            triggerHaptic([15]);
            setIsBookmarked(!isBookmarked);
            showToast(isBookmarked ? "Removed from saved" : "Saved to your bookmarks", "info");
          }}
          className={`p-2 rounded-full border transition cursor-pointer ${
            isBookmarked
              ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8] dark:bg-[#8AB4F8]/20 dark:border-[#8AB4F8] dark:text-[#8AB4F8]"
              : "bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] text-neutral-400 hover:border-neutral-400"
          }`}
          aria-label="Bookmark"
        >
          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-[#1A73E8] dark:fill-[#8AB4F8]" : ""}`} />
        </motion.button>
      </div>

      {/* ── CAPTION & COMMENTS PREVIEW ── */}
      <div className="px-4 sm:px-5 pb-3 pt-1 space-y-1.5">
        <div className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
          <span className="font-bold mr-2 text-neutral-900 dark:text-white">
            {post.userHandle || post.userName}
          </span>
          <span>{cleanCaption}</span>
        </div>

        {post.commentsCount > 0 && (
          <button
            type="button"
            onClick={() => openProofReply(post)}
            className="text-xs font-semibold text-neutral-400 hover:text-orange-500 transition cursor-pointer block"
          >
            View all {post.commentsCount} comments
          </button>
        )}
      </div>

      {/* ── JOIN SQUAD DIALOG SHEET ── */}
      <AnimatePresence>
        {isJoinSheetOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsJoinSheetOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-white dark:bg-[#0E0E12] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 text-neutral-900 dark:text-white space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {post.arenaName || post.arenaTag}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {post.isPrivate ? "Private Cohort • Host Approval Required" : "Public Daily Accountability Arena"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsJoinSheetOpen(false)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Daily Protocol</span>
                  <span className="font-bold text-emerald-500">1 Verified Drop / 24h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Daily Cutoff</span>
                  <span className="font-bold text-orange-500">{post.deadlineTime || "11:59 PM"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Miss Penalty Fine</span>
                  <span className="font-bold text-amber-500">⚡ {post.penaltyAmount || 50} Kudos</span>
                </div>
              </div>

              {post.isPrivate && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 leading-relaxed flex gap-2">
                  <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>50 Kudos stake will be held in escrow upon admission. Consistent check-ins preserve your capital.</span>
                </div>
              )}

              <button
                type="button"
                disabled={isJoining}
                onClick={async () => {
                  setIsJoining(true);
                  await joinSquad(Number(post.arenaId));
                  setIsJoining(false);
                  setIsJoinSheetOpen(false);
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 transition cursor-pointer disabled:opacity-50"
              >
                {isJoining ? "Enrolling into Arena..." : post.isPrivate ? "Request Entry & Deposit 50 Kudos" : "Join Squad ⚔️"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── OPTIONS BOTTOM SHEET ── */}
      <AnimatePresence>
        {isOptionsSheetOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsOptionsSheetOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-white dark:bg-[#0E0E12] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 text-neutral-900 dark:text-white space-y-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  showToast("Proof link copied!", "success");
                  setIsOptionsSheetOpen(false);
                }}
                className="w-full p-3 rounded-xl flex items-center gap-3 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                <Copy className="w-4 h-4 text-orange-500" />
                <span>Copy Verification Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOptionsSheetOpen(false);
                  openInstagramStoryExport();
                }}
                className="w-full p-3 rounded-xl flex items-center gap-3 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-amber-500" />
                <span>Export Proof Badge</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast("Flagged for peer consensus review.", "info");
                  setIsOptionsSheetOpen(false);
                }}
                className="w-full p-3 rounded-xl flex items-center gap-3 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>Flag False Proof</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOptionsSheetOpen(false)}
                className="w-full mt-2 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </article>
  );
};
