"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ThumbsDown,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ExternalLink,
  Play,
  Check,
  X,
  Sparkles,
  Lock,
  Globe,
  Share2,
  Copy,
  Flag,
  Zap,
} from "lucide-react";
import { ProofPost, useApp } from "@/context/AppContext";

interface ProofCardProps {
  post: ProofPost;
}

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
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ id: number; x: number; y: number } | null>(null);

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
        videoId = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop() || null;
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

  const isImageMedia = Boolean(
    post.proofType === "image" ||
    (post.mainImage && (
      post.mainImage.startsWith("data:image/") ||
      post.mainImage.startsWith("blob:") ||
      post.mainImage.includes("images.unsplash.com") ||
      post.mainImage.includes("cloudinary.com") ||
      post.mainImage.includes("amazonaws.com") ||
      post.mainImage.includes("imgur.com") ||
      post.mainImage.includes("cdn.") ||
      post.mainImage.match(/\.(jpeg|jpg|gif|png|webp|avif|bmp|svg)($|\?|&)/i)
    ))
  );

  const ytMeta = parseYouTube(post.mainImage);
  const isYouTube = Boolean(ytMeta || post.proofType === "youtube");
  const isLinkProof = !isImageMedia && !isYouTube && Boolean(post.mainImage?.startsWith("http"));

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
        };
      }
      if (host.includes("github.com")) {
        return {
          brand: "GitHub",
          color: "#8957E5",
          badge: "Pull Request / Commit 🐙",
          title: parsed.pathname.split("/").filter(Boolean).slice(0, 3).join("/") || "Repository Activity",
          domain: "github.com",
        };
      }
      if (host.includes("strava.com")) {
        return {
          brand: "Strava",
          color: "#FC4C02",
          badge: "GPS Workout 🏃",
          title: "Strava Fitness Activity",
          domain: "strava.com",
        };
      }
      return {
        brand: host.replace("www.", ""),
        color: "#10B981",
        badge: "Verified External Proof ↗",
        title: host + (parsed.pathname !== "/" ? parsed.pathname : ""),
        domain: host,
      };
    } catch {
      return {
        brand: "Live Link",
        color: "#10B981",
        badge: "Web Proof ↗",
        title: url,
        domain: "web",
      };
    }
  };

  const linkMeta = isLinkProof ? getLinkMeta(post.mainImage) : null;

  // ── 2. Double Tap Heart Physics ──
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      triggerHaptic([30, 60]);
      setDoubleTapHeart({ id: now, x, y });
      if (post.userVote !== "upvote") {
        toggleLike(post.id);
      }

      setTimeout(() => {
        setDoubleTapHeart(null);
      }, 900);
    }
    lastTapRef.current = now;
  };

  // ── 3. Date and Time Formatting (Display below username) ──
  const formatPostDateTime = (dateStr?: string, submittedAt?: string) => {
    try {
      const d = new Date(submittedAt || dateStr || Date.now());
      if (isNaN(d.getTime())) return "Today";
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      if (isToday) {
        return `Today at ${timeStr}`;
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${timeStr}`;
      }
      const formattedMonthDay = d.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${formattedMonthDay} at ${timeStr}`;
    } catch {
      return "Today";
    }
  };

  const likesCount = (post.upvotes ?? post.reactions?.fire ?? 0);
  const isLiked = post.userVote === "upvote";
  const isDisliked = post.userVote === "downvote";

  return (
    <article className="w-full bg-white dark:bg-[#0A0A0A] border-b border-neutral-200 dark:border-neutral-900 pb-2 transition-colors select-none">
      {/* ── CARD HEADER: Instagram Collaboration Style (User and Arena) ── */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          {/* Dual Overlapping Collaboration Avatars */}
          {post.arenaName || post.arenaTag ? (
            <div className="relative w-10 h-10 shrink-0">
              {/* Primary User Avatar */}
              <div className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] absolute top-0 left-0 z-10">
                <img
                  src={post.userAvatar}
                  alt={post.userName}
                  className="w-full h-full object-cover rounded-full border border-white dark:border-[#0A0A0A]"
                />
              </div>
              {/* Secondary Arena Collaborator Avatar */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.isJoined === false) setIsJoinSheetOpen(true);
                }}
                className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] absolute bottom-0 right-0 z-20 shadow-md cursor-pointer"
                title={post.arenaName || post.arenaTag}
              >
                <div className="w-full h-full rounded-full bg-gradient-to-br from-neutral-800 to-neutral-950 border border-white dark:border-[#0A0A0A] flex items-center justify-center text-[9px] font-black text-white">
                  {(post.arenaName || post.arenaTag || "TR").replace(/^#/, "").slice(0, 2).toUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shrink-0">
              <img
                src={post.userAvatar}
                alt={post.userName}
                className="w-full h-full object-cover rounded-full border-2 border-white dark:border-[#0A0A0A]"
              />
            </div>
          )}

          {/* Collaboration Names on top, Date & Time below */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 leading-tight">
              <span className="text-xs font-black text-neutral-900 dark:text-white hover:underline cursor-pointer">
                {post.userName || post.userHandle}
              </span>
              {(post.arenaName || post.arenaTag) && (
                <>
                  <span className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400">
                    and
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.isJoined === false) {
                        setIsJoinSheetOpen(true);
                      }
                    }}
                    className="text-xs font-black text-neutral-900 dark:text-white hover:underline cursor-pointer"
                  >
                    {(post.arenaName || post.arenaTag || "").replace(/^#/, "")}
                  </span>
                </>
              )}
              {post.isJoined === false && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsJoinSheetOpen(true);
                  }}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer ml-1"
                >
                  • Join
                </button>
              )}
            </div>

            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium leading-normal mt-0.5">
              {formatPostDateTime(post.verifiedTime, post.submittedAt)}
            </p>
          </div>
        </div>

        {/* Right 3-dots options menu */}
        <button
          type="button"
          onClick={() => setIsOptionsSheetOpen(true)}
          className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
          aria-label="More options"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* ── MAIN MEDIA CANVAS (Square or 4:5 Edge-to-Edge) ── */}
      <div
        className="relative w-full aspect-[4/5] bg-neutral-100 dark:bg-neutral-900 overflow-hidden cursor-pointer"
        onClick={handleCanvasClick}
      >
        {/* Case 1: YouTube Video Proof */}
        {isYouTube && ytMeta ? (
          <div className="relative w-full h-full bg-black flex flex-col justify-between group">
            <img
              src={ytMeta.thumbnailUrl}
              alt="YouTube Video Proof"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 flex flex-col justify-between p-4">
              {/* Top YouTube Ribbon */}
              <div className="flex items-center justify-between z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 border border-white/20 text-white text-[10px] font-black uppercase">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span>YouTube Video Proof</span>
                </div>
              </div>

              {/* Centered Classic YouTube Play Button */}
              <a
                href={ytMeta.videoUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="my-auto mx-auto w-16 h-12 rounded-2xl bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.7)] transform hover:scale-110 active:scale-95 transition-all"
              >
                <Play className="w-6 h-6 text-white fill-white ml-1" />
              </a>

              {/* Bottom Video Link Chip */}
              <div className="z-10 flex items-center justify-between">
                <a
                  href={ytMeta.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-neutral-950 text-xs font-black hover:bg-neutral-200 transition shadow-lg"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ) : isLinkProof && linkMeta ? (
          /* Case 2: Other Verified Digital Link Cards (LeetCode, GitHub, Strava) */
          <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-neutral-900 via-[#141417] to-neutral-950 text-white relative">
            {/* Top Domain Ribbon */}
            <div className="flex items-center justify-between z-10">
              <span
                className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                style={{
                  background: `${linkMeta.color}25`,
                  color: linkMeta.color,
                  border: `1px solid ${linkMeta.color}50`,
                }}
              >
                <span>{linkMeta.badge}</span>
              </span>

              <span className="text-[10px] text-neutral-400 font-mono bg-black/60 px-2 py-0.5 rounded border border-white/10">
                {linkMeta.domain}
              </span>
            </div>

            {/* Central Attractive Card Post */}
            <div className="my-auto p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-2xl space-y-3 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                  style={{ background: linkMeta.color, color: "#000" }}
                >
                  ⚡
                </div>
                <div>
                  <h4 className="text-sm font-black text-white line-clamp-1">{linkMeta.title}</h4>
                  <p className="text-[11px] text-neutral-400 line-clamp-2">
                    {post.caption || "Verified digital habit check-in."}
                  </p>
                </div>
              </div>

              {/* Clickable Verification Link Button */}
              <a
                href={post.mainImage}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-neutral-950 font-black text-xs hover:bg-neutral-200 transition shadow-md active:scale-95"
              >
                <span>Open Verification Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Bottom Telemetry */}
            <div className="z-10 flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 bg-black/60 px-2.5 py-1 rounded-lg border border-white/10">
                {post.telemetry || "Verified External Proof"}
              </span>
            </div>
          </div>
        ) : (
          /* Case 3: Pure Clean Instagram Photo (Edge-to-Edge 4:5 image) */
          <>
            {post.mainImage && post.mainImage !== "Done" ? (
              <img
                src={post.mainImage}
                alt={post.caption || "Daily Proof Post"}
                className="w-full h-full object-cover select-none"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80";
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-black text-white p-8 text-center space-y-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15),transparent_70%)]" />
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                  ✓
                </div>
                <div className="space-y-1 z-10 max-w-xs">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Verified Habit Drop
                  </span>
                  <h4 className="text-base font-black text-white tracking-tight">
                    {post.arenaName || "Daily Habit Locked In"}
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {post.caption || "Completed daily habit streak before cutoff!"}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-neutral-300 z-10">
                  <span className="text-amber-400">⚡</span>
                  <span>Streak Protected • {post.deadlineTime ? `Cutoff ${post.deadlineTime}` : "Daily Protocol"}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DOUBLE-TAP INSTAGRAM HEART ANIMATION ── */}
        <AnimatePresence>
          {doubleTapHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                position: "absolute",
                left: doubleTapHeart.x - 45,
                top: doubleTapHeart.y - 45,
              }}
              className="pointer-events-none z-30 flex items-center justify-center"
            >
              <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.9)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── ACTION BAR (Heart / Like, Dislike, Comment, Share, Bookmark) ── */}
      <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Like / Heart */}
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => toggleLike(post.id)}
            className="text-neutral-900 dark:text-white hover:opacity-75 transition cursor-pointer"
            aria-label="Like"
          >
            <Heart
              className={`w-6 h-6 transition-all ${
                isLiked
                  ? "text-red-500 fill-red-500 scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                  : "stroke-[1.75]"
              }`}
            />
          </motion.button>

          {/* Dislike / Thumbs Down */}
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => toggleDislike(post.id)}
            className="text-neutral-900 dark:text-white hover:opacity-75 transition cursor-pointer"
            aria-label="Dislike"
            title="Peer Audit / Downvote"
          >
            <ThumbsDown
              className={`w-6 h-6 transition-all ${
                isDisliked
                  ? "text-amber-500 fill-amber-500 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  : "stroke-[1.75]"
              }`}
            />
          </motion.button>

          {/* Comment Bubble */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => openProofReply(post)}
            className="text-neutral-900 dark:text-white hover:opacity-75 transition cursor-pointer"
            aria-label="Comment"
          >
            <MessageCircle className="w-6 h-6 stroke-[1.75]" />
          </motion.button>

          {/* Share / Paper Plane */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={openInstagramStoryExport}
            className="text-neutral-900 dark:text-white hover:opacity-75 transition cursor-pointer"
            aria-label="Share"
            title="Export 9:16 Story"
          >
            <Send className="w-6 h-6 stroke-[1.75] -rotate-12 -mt-0.5" />
          </motion.button>
        </div>

        {/* Bookmark */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => {
            triggerHaptic([15]);
            setIsBookmarked(!isBookmarked);
            showToast(isBookmarked ? "Removed from saved" : "Saved to your bookmarks", "info");
          }}
          className="text-neutral-900 dark:text-white hover:opacity-75 transition cursor-pointer"
          aria-label="Bookmark"
        >
          <Bookmark
            className={`w-6 h-6 transition-all ${
              isBookmarked ? "fill-neutral-900 dark:fill-white" : "stroke-[1.75]"
            }`}
          />
        </motion.button>
      </div>

      {/* ── LIKES ROW (Matching Instagram) ── */}
      <div className="px-3.5 pt-1">
        <span className="text-xs font-bold text-neutral-900 dark:text-white">
          {likesCount === 0 ? "Be the first to like this" : `${likesCount.toLocaleString()} likes`}
        </span>
      </div>

      {/* ── CAPTION ROW (Bold username + caption text) ── */}
      <div className="px-3.5 pt-1 text-xs text-neutral-900 dark:text-white leading-relaxed">
        <span className="font-bold mr-1.5">
          {post.userHandle || post.userName}
        </span>
        <span className="font-normal text-neutral-800 dark:text-neutral-200">
          {post.caption || "Checked in for the day!"}
        </span>
      </div>

      {/* ── COMMENTS PREVIEW ROW ── */}
      <div className="px-3.5 pt-1">
        <button
          type="button"
          onClick={() => openProofReply(post)}
          className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
        >
          {post.commentsCount > 0
            ? `View all ${post.commentsCount} comments`
            : "Add a comment..."}
        </button>
      </div>

      {/* ── TIME AGO IN SUBTLE UPPERCASE ── */}
      <div className="px-3.5 pt-1 pb-1">
        <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
          {post.timeAgo || "JUST NOW"}
        </span>
      </div>

      {/* ── JOIN SQUAD SHEET MODAL ── */}
      <AnimatePresence>
        {isJoinSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs p-0">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl p-5 text-neutral-900 dark:text-white space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-900">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">{post.arenaName || post.arenaTag}</h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {post.isPrivate ? "Private Cohort • Approval Required" : "Public Accountability Cohort"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsJoinSheetOpen(false)}
                  className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Squad Details Card */}
              <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-500 dark:text-neutral-400">Daily Commitment</span>
                  <span className="text-emerald-500 font-black">1 Verified Proof / Day</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-500 dark:text-neutral-400">Cutoff Deadline</span>
                  <span className="text-cyan-500 font-black">{post.deadlineTime || "11:59 PM"}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-500 dark:text-neutral-400">Daily Miss Penalty</span>
                  <span className="text-rose-500 font-black">⚡ {post.penaltyAmount || 50} Kudos</span>
                </div>
                {post.isPrivate && (
                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs font-bold">
                    <span className="text-neutral-500 dark:text-neutral-400">Commitment Stake</span>
                    <span className="text-amber-500 font-black">⚡ 50 Kudos</span>
                  </div>
                )}
              </div>

              {post.isPrivate && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed">
                  🛡️ <strong>Cohort Rule:</strong> 50 Kudos will be placed in the squad pool upon admin approval. Check in daily before cutoff to preserve your active streak.
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isJoining}
                  onClick={async () => {
                    setIsJoining(true);
                    await joinSquad(Number(post.arenaId));
                    setIsJoining(false);
                    setIsJoinSheetOpen(false);
                  }}
                  className="w-full py-3 rounded-2xl bg-emerald-500 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isJoining ? (
                    <span>Processing Request...</span>
                  ) : post.isPrivate ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Request Entry & Deposit 50 Kudos</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Lock In & Join Squad (1-Tap Entry)</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── OPTIONS BOTTOM SHEET (•••) ── */}
      <AnimatePresence>
        {isOptionsSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs select-none">
            <div
              className="absolute inset-0"
              onClick={() => setIsOptionsSheetOpen(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-[28px] px-4 pt-3 pb-8 text-neutral-900 dark:text-white shadow-2xl z-10 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-800 mx-auto mb-2" />

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsSheetOpen(false);
                    openInstagramStoryExport();
                  }}
                  className="w-full py-3 px-4 rounded-xl flex items-center gap-3 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
                >
                  <Share2 className="w-4 h-4 text-[#E1306C]" />
                  <span>Share to Instagram Story...</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    showToast("Proof link copied to clipboard!", "success");
                    setIsOptionsSheetOpen(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl flex items-center gap-3 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
                >
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span>Copy Proof Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    showToast("Flagged for community review.", "info");
                    setIsOptionsSheetOpen(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl flex items-center gap-3 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition"
                >
                  <Flag className="w-4 h-4 text-rose-500" />
                  <span>Report Inauthentic Proof</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOptionsSheetOpen(false)}
                className="w-full py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition"
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
