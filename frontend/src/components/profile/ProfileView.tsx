"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid,
  Calendar,
  Flame,
  Zap,
  Shield,
  Share2,
  Award,
  Sparkles,
  ChevronRight,
  Heart,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Settings,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { InstagramStoryCard } from "@/components/InstagramStoryCard";
import { ThemeSettingsModal } from "./ThemeSettingsModal";

export const ProfileView: React.FC = () => {
  const {
    user,
    heatmapTiles,
    feedPosts,
    claimStreakLifeline,
    isInstagramStoryExportOpen,
    openInstagramStoryExport,
    closeInstagramStoryExport,
    triggerHaptic,
    showToast,
  } = useApp();

  // Build proof mosaic from user's real feed posts
  const mosaicItems = useMemo(() => {
    return feedPosts
      .filter((p) => p.userId === user.id && p.mainImage)
      .slice(0, 12)
      .map((p, idx) => ({
        id: p.id,
        imageUrl: p.mainImage,
        arenaTag: p.arenaTag,
        dayNumber: idx + 1,
        likes: p.reactions.fire + p.reactions.electric + p.reactions.respect,
      }));
  }, [feedPosts, user.id]);

  type MosaicItem = typeof mosaicItems[0];

  const [activeTab, setActiveTab] = useState<"mosaic" | "heatmap">("mosaic");
  const [selectedTile, setSelectedTile] = useState<(typeof heatmapTiles)[0] | null>(null);
  const [selectedMosaicItem, setSelectedMosaicItem] = useState<MosaicItem | null>(null);
  const [isStreakFreezeOpen, setIsStreakFreezeOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Statistics
  const verifiedCount = heatmapTiles.filter((t) => t.status === "verified").length;
  const shieldedCount = heatmapTiles.filter((t) => t.status === "shielded").length;
  const missedCount = heatmapTiles.filter((t) => t.status === "absent").length;
  const completionRate = Math.round((verifiedCount / (heatmapTiles.length || 1)) * 100);

  return (
    <div className="w-full pb-24 text-neutral-900 dark:text-white transition-colors duration-200">
      {/* 0. Top Bar with Settings */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-900">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black tracking-tight text-neutral-900 dark:text-white">
            @{user.username}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic([15]);
            setIsThemeModalOpen(true);
          }}
          className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
          title="Switch Appearance / Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* 1. Profile Header */}
      <div className="px-4 pt-4 pb-4 border-b border-neutral-200 dark:border-neutral-900">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar with Radiant Border */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full rounded-full object-cover bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-950"
              />
            </div>
            {/* Online / Active Pip */}
            <span className="absolute bottom-0 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950" />
          </div>

          {/* Quick Metrics (Instagram Style) */}
          <div className="flex-1 flex items-center justify-around text-center pt-2">
            <div>
              <div className="text-lg font-black text-white">{verifiedCount}</div>
              <div className="text-[11px] font-medium text-neutral-400">Proofs</div>
            </div>
            <div>
              <div className="text-lg font-black text-emerald-400 flex items-center justify-center gap-0.5">
                <Flame className="w-4 h-4 fill-emerald-400 inline" />
                {user.currentStreak}d
              </div>
              <div className="text-[11px] font-medium text-neutral-400">Streak</div>
            </div>
            <div>
              <div className="text-lg font-black text-amber-400">{user.kudosBalance}</div>
              <div className="text-[11px] font-medium text-neutral-400">Kudos</div>
            </div>
          </div>
        </div>

        {/* User Bio & Badges */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">{user.name}</h2>
            <span className="text-xs text-neutral-400">@{user.username}</span>
          </div>

          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            {user.bio || "Consistent habit runner & engineer • Staking reputation daily 🏃‍♂️⚡"}
          </p>

          {/* Tier & Multiplier Pill Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              <Award className="w-3.5 h-3.5" />
              {user.tierBadge}
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
              <Zap className="w-3.5 h-3.5" />
              {user.multiplier} Sprint Multiplier
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-medium">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              {user.streakShields} Shields
            </span>
          </div>
        </div>

        {/* Action Buttons: Viral Artifact Generator */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={openInstagramStoryExport}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-xs font-black tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share to Instagram Story
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic([15]);
              setIsStreakFreezeOpen(true);
            }}
            className="py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/40 text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer shadow-sm"
            title="Streak Freeze Shield"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>₹49 Shield</span>
          </button>
        </div>
      </div>

      {/* 2. Segmented Tab Switcher (Instagram Grid vs Strava Matrix) */}
      <div className="flex border-b border-neutral-900 sticky top-[57px] bg-neutral-950/95 backdrop-blur z-20">
        <button
          type="button"
          onClick={() => {
            triggerHaptic([10]);
            setActiveTab("mosaic");
          }}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === "mosaic"
              ? "border-emerald-500 text-white"
              : "border-transparent text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Proof Mosaic</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic([10]);
            setActiveTab("heatmap");
          }}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === "heatmap"
              ? "border-emerald-500 text-white"
              : "border-transparent text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Consistency Matrix</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      <div className="p-3">
        {activeTab === "mosaic" ? (
          /* TAB A: Instagram 3x3 Proof Mosaic */
          <div>
            <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
              {mosaicItems.length > 0 ? mosaicItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => setSelectedMosaicItem(item)}
                  className="relative aspect-square bg-neutral-900 overflow-hidden cursor-pointer group"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.arenaTag}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl bg-neutral-800">
                      🎯
                    </div>
                  )}

                  {/* Corner Verified Pip */}
                  <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />

                  {/* Likes Overlay on Hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-xs font-bold text-white">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-white" />
                      {item.likes}
                    </span>
                  </div>

                  {/* Tiny telemetry label at bottom */}
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/60 backdrop-blur text-[8px] font-bold text-neutral-300 truncate max-w-[80%]">
                    {item.arenaTag}
                  </div>
                </motion.div>
              )) : (
                // Empty state — no proofs dropped yet
                Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="relative aspect-square bg-neutral-900 rounded overflow-hidden flex items-center justify-center">
                    <span className="text-neutral-700 text-2xl">📷</span>
                  </div>
                ))
              )}
            </div>

            <p className="text-[11px] text-center text-neutral-500 mt-4">
              {mosaicItems.length > 0
                ? "All proofs are cryptographically timestamped and community verified."
                : "Drop your first proof to start building your proof mosaic!"}
            </p>
          </div>
        ) : (
          /* TAB B: Strava Heatmap (30-Day Matrix) */
          <div className="space-y-4">
            {/* Heatmap Card */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">30-Day Activity Matrix</h3>
                    <p className="text-[10px] text-neutral-400">{completionRate}% consistency rate</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-emerald-400">
                    {verifiedCount} / {heatmapTiles.length}
                  </span>
                  <p className="text-[10px] text-neutral-500">Days Active</p>
                </div>
              </div>

              {/* Matrix Grid (5 rows of 6 or 6 rows of 5) */}
              <div className="grid grid-cols-6 gap-1.5 p-2 bg-neutral-950/80 rounded-xl border border-neutral-800/60">
                {heatmapTiles.map((tile, idx) => {
                  let bgClass = "bg-neutral-800/60 border-neutral-800";
                  let shadowClass = "";

                  if (tile.status === "verified") {
                    bgClass = "bg-emerald-500 border-emerald-400 text-neutral-950";
                    shadowClass = "shadow-[0_0_8px_rgba(16,185,129,0.35)]";
                  } else if (tile.status === "shielded") {
                    bgClass = "bg-amber-500 border-amber-400 text-neutral-950";
                    shadowClass = "shadow-[0_0_8px_rgba(245,158,11,0.35)]";
                  } else if (tile.status === "absent") {
                    bgClass = "bg-rose-500/80 border-rose-500 text-white";
                  }

                  const isToday = idx === heatmapTiles.length - 1;

                  return (
                    <motion.button
                      key={tile.date}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        triggerHaptic([10]);
                        setSelectedTile(tile);
                      }}
                      className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer transition ${bgClass} ${shadowClass} ${
                        isToday ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-neutral-950" : ""
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isToday && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between mt-3 px-1 text-[10px] text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-[0_0_4px_#10B981]" />
                  <span>Verified ({verifiedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span>Shielded ({shieldedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span>Missed ({missedCount})</span>
                </div>
              </div>

              {/* Day 1 Glowing Callout for brand new profiles */}
              {verifiedCount === 0 && (
                <div className="mt-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs text-cyan-200 font-medium">Ready to begin? Start Day 1 today!</span>
                  </div>
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">Day 1 Glow</span>
                </div>
              )}
            </div>

            {/* Selected Tile Inspector Modal / Drawer */}
            <AnimatePresence>
              {selectedTile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-white space-y-2 relative"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTile(null)}
                    className="absolute top-3 right-3 text-xs text-neutral-400 hover:text-white p-1"
                  >
                    ✕
                  </button>

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        selectedTile.status === "verified"
                          ? "bg-emerald-500"
                          : selectedTile.status === "shielded"
                          ? "bg-amber-500"
                          : selectedTile.status === "absent"
                          ? "bg-rose-500"
                          : "bg-neutral-700"
                      }`}
                    />
                    <h4 className="text-xs font-black uppercase tracking-wide">
                      Day {selectedTile.dayOfMonth} Details
                    </h4>
                  </div>

                  <p className="text-xs font-bold text-white">{selectedTile.proofTitle}</p>
                  {selectedTile.telemetrySnippet && (
                    <p className="text-[11px] text-neutral-400">{selectedTile.telemetrySnippet}</p>
                  )}

                  {selectedTile.status === "absent" && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          claimStreakLifeline();
                          setSelectedTile(null);
                        }}
                        className="w-full py-1.5 rounded-lg bg-amber-500 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Apply Streak Shield to this day
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Habit Resilience Info Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800/80 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-neutral-200">Zero-Shame Resilience System</div>
                <div className="text-[11px] text-neutral-400 leading-relaxed">
                  Missing a day halts your 1.5x Sprint multiplier and alerts your tribe, but your account is NEVER
                  locked out. Use an Emergency Lifeline to rescue lost streaks.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Single Mosaic Image Zoom Lightbox */}
      <AnimatePresence>
        {selectedMosaicItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-4"
          >
            <div className="relative w-full max-w-sm bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl">
              <button
                type="button"
                onClick={() => setSelectedMosaicItem(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>

              <div className="aspect-[4/5] relative bg-black flex items-center justify-center">
                {selectedMosaicItem.imageUrl ? (
                  <img
                    src={selectedMosaicItem.imageUrl}
                    alt={selectedMosaicItem.arenaTag}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl">🎯</span>
                )}
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400">{selectedMosaicItem.arenaTag}</span>
                  <span className="text-[11px] text-neutral-400">Day {selectedMosaicItem.dayNumber}</span>
                </div>
                <p className="text-xs text-white leading-relaxed">
                  Verified proof dropped in {selectedMosaicItem.arenaTag}. Streak maintained!
                </p>
                <div className="flex items-center gap-4 pt-1 text-xs text-neutral-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    {selectedMosaicItem.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Verified Proof
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 1-TAP STREAK FREEZE / SHIELD BOTTOM SHEET ── */}
      <AnimatePresence>
        {isStreakFreezeOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-neutral-950 border-t border-neutral-800 rounded-t-3xl p-5 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight text-white">Streak Freeze Shield</h3>
                    <p className="text-[11px] text-neutral-400">Zero-loss protection for 24 hours</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStreakFreezeOpen(false)}
                  className="p-1.5 rounded-full bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-cyan-300">Active Streak Protection</span>
                  <span className="text-white">🔥 {user.currentStreak} Days Intact</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Heading off-grid, traveling, or taking a rest day? Protect your streak with a Freeze Shield (₹49) to maintain your 1.5x Sprint multiplier and keep your squad pot intact.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic([20, 30]);
                    claimStreakLifeline();
                    setIsStreakFreezeOpen(false);
                    showToast("🛡️ Streak Freeze Shield active! Your streak is fully protected.", "success");
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  <Shield className="w-4 h-4 fill-neutral-950" />
                  <span>Activate Freeze Shield (₹49 / 1-Tap Claim)</span>
                </button>

                <p className="text-[10px] text-center text-neutral-500">
                  {user.streakShields} shield(s) available in your profile vault. Zero streak loss guaranteed.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Instagram Story Modal Mount */}
      <InstagramStoryCard
        isOpen={isInstagramStoryExportOpen}
        onClose={closeInstagramStoryExport}
        userName={user.name}
        userAvatar={user.avatar}
        currentStreak={user.currentStreak}
        longestStreak={user.longestStreak}
        arenaName="#5AM-Running-Club"
        tierBadge={user.tierBadge}
      />

      {/* 6. Instagram Appearance Settings Sheet */}
      <ThemeSettingsModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </div>
  );
};
