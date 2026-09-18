"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid,
  Calendar,
  Flame,
  Zap,
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
  X,
  Edit3,
  Plus,
  ChevronDown,
  BadgeCheck,
  Trophy,
  Camera,
  Lock,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { InstagramStoryCard } from "@/components/InstagramStoryCard";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { resolveBackendUrl } from "@/lib/api-client";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

export const ProfileView: React.FC = () => {
  const {
    user,
    arenas,
    heatmapTiles,
    feedPosts,
    isInstagramStoryExportOpen,
    openInstagramStoryExport,
    closeInstagramStoryExport,
    triggerHaptic,
    showToast,
    setActiveTab: setNavTab,
  } = useApp();

  // Build proof mosaic from user's real feed posts
  const mosaicItems = useMemo(() => {
    return feedPosts
      .filter((p) => p.userId === user.id && p.mainImage)
      .slice(0, 18)
      .map((p, idx) => ({
        id: p.id,
        imageUrl: p.mainImage,
        arenaTag: p.arenaTag,
        arenaName: p.arenaName || p.arenaTag,
        dayNumber: idx + 1,
        likes: (p.reactions?.fire || 0) + (p.reactions?.electric || 0) + (p.reactions?.respect || 0) || (p.upvotes || 0),
        commentsCount: p.commentsCount || 0,
        caption: p.caption || "Daily proof dropped & verified!",
        submittedAt: p.submittedAt || new Date().toISOString(),
      }));
  }, [feedPosts, user.id]);

  type MosaicItem = typeof mosaicItems[0];

  const [activeTab, setActiveTab] = useState<"mosaic" | "heatmap" | "badges">("mosaic");
  const [selectedTile, setSelectedTile] = useState<(typeof heatmapTiles)[0] | null>(null);
  const [selectedMosaicItem, setSelectedMosaicItem] = useState<MosaicItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialView, setSettingsInitialView] = useState<"main" | "edit-profile" | "change-password">("main");
  const [selectedSquad, setSelectedSquad] = useState<(typeof arenas)[0] | null>(null);

  // Statistics
  const verifiedCount = heatmapTiles.filter((t) => t.status === "verified").length;
  const missedCount = heatmapTiles.filter((t) => t.status === "absent").length;
  const completionRate = Math.round((verifiedCount / (heatmapTiles.length || 1)) * 100);

  const openSettings = (view: "main" | "edit-profile" | "change-password" = "main") => {
    triggerHaptic([15]);
    setSettingsInitialView(view);
    setIsSettingsOpen(true);
  };



  return (
    <div className="w-full pb-24 text-neutral-900 dark:text-white transition-colors duration-200 space-y-4">
      {/* ── 1. UNIFIED GOOGLE PROFILE CARD ── */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl shadow-xs overflow-hidden">
        {/* Systematic Profile Card Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#E8EAED] dark:border-[#303134] flex items-center justify-between bg-[#F8F9FA]/70 dark:bg-[#202124]/50">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white truncate">
              @{user.username}
            </span>
            <BadgeCheck className="w-4 h-4 text-[#1A73E8] fill-[#1A73E8]/20 shrink-0" />
            <span className="w-2 h-2 rounded-full bg-[#0F9D58] ml-0.5 shrink-0" title="Online & Active" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => openSettings("main")}
              className="p-1.5 rounded-full hover:bg-neutral-200/60 dark:hover:bg-[#2A2B2E] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white active:scale-95 transition cursor-pointer"
              title="Settings & Activity"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Profile Content Body */}
        <div className="px-4 pt-4 pb-4 border-b border-[#E8EAED] dark:border-[#303134]">
          <div className="flex items-center justify-between gap-5">
            {/* Clean Google Account Avatar */}
            <div
              onClick={() => openSettings("edit-profile")}
              className="relative shrink-0 cursor-pointer group"
              title="Change Profile Photo"
            >
              <div className="w-[84px] h-[84px] rounded-full p-[2.5px] border-2 border-[#1A73E8] dark:border-[#8AB4F8] shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                <AvatarWithFallback
                  avatarUrl={user.avatar}
                  name={user.name}
                  sizeClass="w-full h-full"
                  textClass="text-2xl font-bold"
                />
              </div>

              {/* Quick Edit Photo Camera Pip */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openSettings("edit-profile");
                }}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white border-2 border-white dark:border-[#1E1E1E] shadow-sm active:scale-95 transition cursor-pointer group-hover:scale-110"
                title="Change Profile Photo"
              >
                <Camera className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>

          {/* Stats Row */}
          <div className="flex-1 flex items-center justify-around text-center">
            <div className="cursor-pointer" onClick={() => setActiveTab("mosaic")}>
              <div className="text-base font-semibold text-neutral-900 dark:text-white tracking-tight">
                {user.proofsCount !== undefined && user.proofsCount > 0 ? user.proofsCount : (verifiedCount || mosaicItems.length)}
              </div>
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Proofs</div>
            </div>

            <div className="cursor-pointer" onClick={() => setActiveTab("heatmap")}>
              <div className="text-base font-semibold text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center gap-0.5 tracking-tight">
                <Flame className="w-4 h-4 fill-[#1A73E8] dark:fill-[#8AB4F8] inline" />
                {user.currentStreak}d
              </div>
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Current</div>
            </div>

            <div className="cursor-pointer" onClick={() => setActiveTab("badges")}>
              <div className="text-base font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-0.5 tracking-tight">
                <Trophy className="w-3.5 h-3.5 text-amber-500 inline" />
                {user.longestStreak}d
              </div>
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Best</div>
            </div>

            <div className="cursor-pointer" onClick={() => setNavTab("vault")}>
              <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5 tracking-tight">
                <Zap className="w-3.5 h-3.5 fill-emerald-500 inline" />
                {user.kudosBalance}
              </div>
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Kudos</div>
            </div>
          </div>
        </div>

        {/* User Bio & Badges */}
        <div className="mt-3.5">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
              {user.name}
            </h2>
            <BadgeCheck className="w-3.5 h-3.5 text-[#1A73E8] fill-[#1A73E8]/20" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">@{user.username}</span>
          </div>

          <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1 leading-relaxed">
            {user.bio || "Building daily habits with Tribely • Staking reputation daily"}
          </p>

          {/* Contact & Account credentials */}
          {(user.email || user.phone) && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
              {user.email && (
                <span className="flex items-center gap-1 bg-[#F8F9FA] dark:bg-[#202124] px-2 py-0.5 rounded-md border border-[#E8EAED] dark:border-[#303134]">
                  <Lock className="w-3 h-3 text-neutral-400" />
                  <span>{user.email}</span>
                </span>
              )}
              {user.phone && (
                <span className="flex items-center gap-1 bg-[#F8F9FA] dark:bg-[#202124] px-2 py-0.5 rounded-md border border-[#E8EAED] dark:border-[#303134]">
                  <span>📞 {user.phone}</span>
                </span>
              )}
            </div>
          )}

          {/* Habit Badges Row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-medium">
              <Award className="w-3 h-3" />
              {user.tierBadge}
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
              <Zap className="w-3 h-3" />
              {user.multiplier} Multiplier
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8F0FE] dark:bg-[#8AB4F8]/15 border border-[#D2E3FC] dark:border-[#8AB4F8]/30 text-[#1A73E8] dark:text-[#8AB4F8] text-[10px] font-medium">
              <CheckCircle2 className="w-3 h-3" />
              {user.arenasCount || arenas.length} Squads
            </span>
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="mt-3.5 flex items-center gap-2">
          {/* Edit Profile */}
          <button
            type="button"
            onClick={() => openSettings("edit-profile")}
            className="flex-1 py-2 px-3 rounded-full bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium tracking-tight flex items-center justify-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.98] transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>

          {/* Share Profile to Story */}
          <button
            type="button"
            onClick={openInstagramStoryExport}
            className="flex-1 py-2 px-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium tracking-tight flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Profile</span>
          </button>
        </div>

        {/* ── ENROLLED HABIT SQUADS TRAY ── */}
        <div className="mt-4 pt-3.5 border-t border-[#E8EAED] dark:border-[#303134]">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <span className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">
              Active Habit Squads ({arenas.length})
            </span>
            <button
              type="button"
              onClick={() => setNavTab("explore")}
              className="text-[11px] font-medium text-[#1A73E8] hover:text-[#1557B0] dark:text-[#8AB4F8] flex items-center gap-0.5 cursor-pointer"
            >
              <span>Explore</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            {arenas.length > 0 ? (
              arenas.map((squad) => (
                <div
                  key={squad.id}
                  onClick={() => {
                    triggerHaptic([10]);
                    setSelectedSquad(squad);
                  }}
                  className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-2xl p-[2px] border border-[#DADCE0] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#202124] group-hover:scale-105 transition-all shadow-xs">
                    <div className="w-full h-full rounded-[14px] flex items-center justify-center text-xl">
                      {squad.emoji}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[64px]">
                    {squad.name}
                  </span>
                  <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                    {squad.penaltyAmount} ₭
                  </span>
                </div>
              ))
            ) : (
              <div
                onClick={() => setNavTab("explore")}
                className="flex items-center gap-2 py-2.5 px-3.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-dashed border-[#DADCE0] dark:border-[#3C4043] text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer hover:border-[#1A73E8] transition"
              >
                <Plus className="w-4 h-4 text-[#1A73E8]" />
                <span>Join your first habit squad to start staking</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* ── 2. ACTIVITY & PROOF TABS CARD ── */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl shadow-xs overflow-hidden">
        {/* Google Material Tabs (Non-sticky: scrolls up naturally as you scroll down) */}
        <div className="flex border-b border-[#E8EAED] dark:border-[#303134] bg-[#F8F9FA]/70 dark:bg-[#202124]/50 transition-colors">
          {/* Tab 1: Proof Mosaic */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic([10]);
            setActiveTab("mosaic");
          }}
          className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === "mosaic"
              ? "border-[#1A73E8] text-[#1A73E8] dark:border-[#8AB4F8] dark:text-[#8AB4F8]"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Proof Mosaic</span>
        </button>

        {/* Tab 2: Consistency Matrix */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic([10]);
            setActiveTab("heatmap");
          }}
          className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === "heatmap"
              ? "border-[#1A73E8] text-[#1A73E8] dark:border-[#8AB4F8] dark:text-[#8AB4F8]"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Consistency Matrix</span>
        </button>

        {/* Tab 3: Badges Vault */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic([10]);
            setActiveTab("badges");
          }}
          className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === "badges"
              ? "border-[#1A73E8] text-[#1A73E8] dark:border-[#8AB4F8] dark:text-[#8AB4F8]"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Badges Vault</span>
        </button>
      </div>

      {/* ── 3. TAB CONTENT ── */}
      <div className="p-3">
        {/* TAB 1: INSTAGRAM 3x3 PROOF MOSAIC */}
        {activeTab === "mosaic" && (
          <div>
            <div className="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 p-0.5">
              {mosaicItems.length > 0 ? (
                mosaicItems.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => {
                      triggerHaptic([10]);
                      setSelectedMosaicItem(item);
                    }}
                    className="relative aspect-square bg-neutral-200 dark:bg-neutral-800 overflow-hidden cursor-pointer group"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.arenaTag}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl bg-neutral-100 dark:bg-neutral-800">
                        🎯
                      </div>
                    )}

                    {/* Corner Verified Pip */}
                    <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />

                    {/* Likes & Comments Overlay on Hover/Tap */}
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-xs font-bold text-white">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 fill-white" />
                        {item.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        {item.commentsCount}
                      </span>
                    </div>

                    {/* Telemetry label at bottom */}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[8px] font-bold text-neutral-200 truncate max-w-[85%]">
                      {item.arenaTag}
                    </div>
                  </motion.div>
                ))
              ) : (
                /* Empty state: 9 placeholder tiles */
                Array.from({ length: 9 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square bg-neutral-200/60 dark:bg-neutral-800/60 rounded overflow-hidden flex items-center justify-center text-neutral-400 dark:text-neutral-600 text-xl"
                  >
                    📷
                  </div>
                ))
              )}
            </div>

            <p className="text-[11px] text-center text-neutral-500 dark:text-neutral-400 mt-4 font-medium">
              {mosaicItems.length > 0
                ? "All proofs are community verified and securely timestamped."
                : "Drop your first daily proof to start building your proof mosaic!"}
            </p>
          </div>
        )}

        {/* TAB 2: CONSISTENCY MATRIX (HEATMAP) */}
        {activeTab === "heatmap" && (
          <div className="space-y-4">
            <div className="p-4 rounded-3xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8]">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
                      30-Day Consistency Matrix
                    </h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {completionRate}% streak retention rate
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-emerald-500">
                    {verifiedCount} / {heatmapTiles.length}
                  </span>
                  <p className="text-[10px] text-neutral-500">Days Active</p>
                </div>
              </div>

              {/* Matrix Grid */}
              <div className="grid grid-cols-6 gap-1.5 p-2.5 bg-white dark:bg-neutral-950/80 rounded-2xl border border-neutral-200 dark:border-neutral-800/60 shadow-inner">
                {heatmapTiles.map((tile, idx) => {
                  let bgClass = "bg-neutral-100 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400";
                  let shadowClass = "";

                  if (tile.status === "verified") {
                    bgClass = "bg-emerald-500 border-emerald-400 text-neutral-950 font-black";
                    shadowClass = "shadow-[0_0_8px_rgba(16,185,129,0.35)]";
                  } else if (tile.status === "absent") {
                    bgClass = "bg-rose-500/80 border-rose-500 text-white font-bold";
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
                      className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center text-[10px] cursor-pointer transition ${bgClass} ${shadowClass} ${
                        isToday ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950" : ""
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
              <div className="flex items-center justify-between mt-3 px-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-[0_0_4px_#10B981]" />
                  <span>Verified ({verifiedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span>Missed ({missedCount})</span>
                </div>
              </div>
            </div>

            {/* Selected Tile Inspector Modal */}
            <AnimatePresence>
              {selectedTile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white space-y-2 relative shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTile(null)}
                    className="absolute top-3 right-3 text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        selectedTile.status === "verified"
                          ? "bg-emerald-500"
                          : selectedTile.status === "absent"
                          ? "bg-rose-500"
                          : "bg-neutral-400"
                      }`}
                    />
                    <h4 className="text-xs font-black uppercase tracking-wide">
                      Day {selectedTile.dayOfMonth} Details
                    </h4>
                  </div>

                  <p className="text-xs font-bold text-neutral-900 dark:text-white">{selectedTile.proofTitle}</p>
                  {selectedTile.telemetrySnippet && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{selectedTile.telemetrySnippet}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Zero-Shame Resilience Card */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800/80 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-neutral-800 dark:text-neutral-200">Zero-Shame Resilience System</div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Missing a daily cutoff resets your streak and sprint multiplier, but your account is never locked out. Jump back in tomorrow to rebuild your momentum!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BADGES & HABIT VAULT */}
        {activeTab === "badges" && (
          <div className="space-y-3.5">
            {/* Kudos Balance Card */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#E8F0FE] to-[#E6F4EA] dark:from-[#1A73E8]/15 dark:to-[#0F9D58]/15 border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Vault Balance
                </span>
                <div className="text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                  <Zap className="w-6 h-6 fill-amber-500 text-amber-500" />
                  <span>{user.kudosBalance}</span>
                  <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">Kudos</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {user.multiplier}x Multiplier Active
                </span>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Earn +25% on daily proof drops
                </p>
              </div>
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white">Day 0 Starter</div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Completed initial squad enrollment</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white">7-Day Sprint</div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Maintained unbroken proof consistency</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white">Consistency Pillar</div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Committed member driving cohort momentum</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white">Peer Validator</div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Voted on 10+ squad member submissions</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* ── 4. INSTAGRAM POST LIGHTBOX (Proof Viewer Modal) ── */}
      <AnimatePresence>
        {selectedMosaicItem && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-neutral-950 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl"
            >
              {/* Top Header of Lightbox */}
              <div className="p-3.5 flex items-center justify-between border-b border-neutral-800 bg-neutral-950">
                <div className="flex items-center gap-2.5">
                  <AvatarWithFallback
                    avatarUrl={user.avatar}
                    name={user.name}
                    sizeClass="w-8 h-8"
                    textClass="text-xs font-bold"
                    className="border border-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-1">
                      <span>{user.username}</span>
                      <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
                    </div>
                    <div className="text-[10px] text-neutral-400">{selectedMosaicItem.arenaName}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMosaicItem(null)}
                  className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {/* Post Image */}
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

                {/* Verified Pill Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-bold text-emerald-400 flex items-center gap-1 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Verified Proof</span>
                </div>
              </div>

              {/* Post Details & Reactions */}
              <div className="p-4 space-y-2.5 bg-neutral-950 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-orange-400">{selectedMosaicItem.arenaTag}</span>
                  <span className="text-[10px] text-neutral-400">Day {selectedMosaicItem.dayNumber}</span>
                </div>

                <p className="text-xs text-neutral-200 leading-relaxed">
                  {selectedMosaicItem.caption}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
                  <div className="flex items-center gap-3 text-neutral-300 font-semibold">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                      {selectedMosaicItem.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4 text-cyan-400" />
                      {selectedMosaicItem.commentsCount}
                    </span>
                  </div>

                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Verified Proof
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 5. HABIT SQUAD CONTRACT DETAIL MODAL ── */}
      <AnimatePresence>
        {selectedSquad && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center space-y-3"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 p-[2px] mx-auto shadow-md shadow-orange-500/20">
                <div className="w-full h-full rounded-[14px] bg-white dark:bg-neutral-950 flex items-center justify-center text-3xl">
                  {selectedSquad.emoji}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                  {selectedSquad.name}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {selectedSquad.description || "Active habit commitment cohort"}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Daily Cutoff:</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{selectedSquad.deadlineTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Reputation Stake:</span>
                  <span className="font-bold text-emerald-500">{selectedSquad.penaltyAmount} Kudos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Active Peers:</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{selectedSquad.memberCount} members</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Proof Format:</span>
                  <span className="font-bold uppercase text-[10px] bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-700 dark:text-neutral-200">
                    {selectedSquad.proofType || "image"}
                  </span>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSquad(null);
                    setNavTab("feed");
                  }}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-black text-white cursor-pointer transition shadow-md shadow-orange-500/25"
                >
                  View Squad Feed & Drops
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSquad(null)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ── 7. VIRAL INSTAGRAM STORY MODAL EXPORT ── */}
      <InstagramStoryCard
        isOpen={isInstagramStoryExportOpen}
        onClose={closeInstagramStoryExport}
        userName={user.name}
        userAvatar={user.avatar}
        currentStreak={user.currentStreak}
        longestStreak={user.longestStreak}
        arenaName="#DailyHabit"
        tierBadge={user.tierBadge}
      />

      {/* ── 8. INSTAGRAM SETTINGS & ACTIVITY MODAL ── */}
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialView={settingsInitialView}
      />
    </div>
  );
};
