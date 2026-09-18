"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Zap,
  Flame,
  Clock,
  TrendingUp,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { resolveBackendUrl } from "@/lib/api-client";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

export const VaultView: React.FC = () => {
  const { user, arenas, feedPosts, triggerHaptic, showToast } = useApp();
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<"global" | "sprint">("sprint");

  // Build real leaderboard from feedPosts (group by user, count submissions)
  const leaderboard = useMemo(() => {
    const userMap: Record<string, { name: string; avatar: string; handle: string; count: number; isCurrentUser: boolean }> = {};
    feedPosts.forEach((post) => {
      if (!userMap[post.userId]) {
        userMap[post.userId] = {
          name: post.userName,
          avatar: post.userAvatar,
          handle: post.userHandle,
          count: 0,
          isCurrentUser: post.userId === user.id,
        };
      }
      userMap[post.userId].count += 1;
    });
    // Ensure current user is in the list
    if (!userMap[user.id]) {
      userMap[user.id] = {
        name: user.name,
        avatar: user.avatar && !user.avatar.includes("dicebear.com") ? resolveBackendUrl(user.avatar) : "",
        handle: user.username,
        count: 0,
        isCurrentUser: true,
      };
    }
    return Object.entries(userMap)
      .map(([id, data], idx) => ({
        rank: idx + 1,
        id,
        name: data.name,
        username: data.handle,
        avatar: data.avatar && !data.avatar.includes("dicebear.com") ? resolveBackendUrl(data.avatar) : "",
        streakDays: data.isCurrentUser ? user.currentStreak : data.count,
        consistencyRate: Math.min(100, Math.round((data.count / Math.max(1, feedPosts.length)) * 100 * 3)),
        kudosEarned: data.count * 50,
        isCurrentUser: data.isCurrentUser,
      }))
      .sort((a, b) => b.kudosEarned - a.kudosEarned)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [feedPosts, user]);

  // Calculate Sprint Progress (Day 4 of 7)
  const currentDayOfSprint = 4;
  const sprintDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="w-full pb-24 text-neutral-900 dark:text-white transition-colors duration-200">
      {/* 1. Header with 7-Day Sprint Economy Banner */}
      <div className="p-4 border-b border-[#E8EAED] dark:border-[#303134] bg-white dark:bg-[#121212] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#FEF7E0] dark:bg-[#F9AB00]/15 text-amber-600 dark:text-amber-400 border border-[#FEEFC3] dark:border-[#F9AB00]/25">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">7-Day Sprint Vault</h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Weekly cohort accountability cycle</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
              <Zap className="w-3.5 h-3.5 fill-current" />
              {user.kudosBalance} Kudos
            </div>
            <span className="text-[10px] text-neutral-500">Reputation Balance</span>
          </div>
        </div>

        {/* Sprint Status & Multiplier Meter */}
        <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Sprint Cycle #14 Progress</span>
            <span className="text-xs font-medium text-[#0F9D58] bg-[#E6F4EA] dark:bg-[#0F9D58]/15 px-2.5 py-0.5 rounded-full border border-[#CEEAD6] dark:border-[#0F9D58]/30">
              {user.multiplier} Multiplier Active
            </span>
          </div>

          {/* 7-Day Sprint Indicator Rings */}
          <div className="grid grid-cols-7 gap-1.5 pt-1">
            {sprintDays.map((day, idx) => {
              const isPast = idx < currentDayOfSprint - 1;
              const isToday = idx === currentDayOfSprint - 1;

              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-semibold border transition ${
                      isPast
                        ? "bg-[#E6F4EA] dark:bg-[#0F9D58]/15 border-[#CEEAD6] dark:border-[#0F9D58]/30 text-[#0F9D58]"
                        : isToday
                        ? "bg-white dark:bg-[#202124] border-2 border-[#1A73E8] text-[#1A73E8] dark:text-[#8AB4F8]"
                        : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500"
                    }`}
                  >
                    {isPast ? "✓" : isToday ? "TODAY" : ""}
                  </div>
                  <span className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400">{day}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed pt-1">
            Each daily verified drop instantly returns <strong className="text-neutral-900 dark:text-white font-semibold">1/7th</strong> of your stake.
            Hitting 7/7 unlocks the full <strong className="text-[#0F9D58] font-semibold">1.5x Tribe Pool payout</strong> on Sunday midnight.
          </p>
        </div>
      </div>

      {/* 2. Leaderboard Navigation Switcher */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Cohort Leaderboard
          </h3>

          <div className="flex items-center p-0.5 rounded-full bg-neutral-100 dark:bg-[#1E1E1E] border border-neutral-200 dark:border-[#303134] text-xs">
            <button
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveLeaderboardTab("sprint");
              }}
              className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
                activeLeaderboardTab === "sprint"
                  ? "bg-[#1A73E8] text-white shadow-xs dark:bg-[#8AB4F8] dark:text-[#202124]"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              This Sprint
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveLeaderboardTab("global");
              }}
              className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
                activeLeaderboardTab === "global"
                  ? "bg-[#1A73E8] text-white shadow-xs dark:bg-[#8AB4F8] dark:text-[#202124]"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              All-Time
            </button>
          </div>
        </div>

        {/* Top 3 Podium Cards */}
        {leaderboard.length >= 3 ? (
          <div className="grid grid-cols-3 gap-2 pt-2">
            {/* Rank 2 */}
            <div className="p-3 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-center flex flex-col items-center justify-between order-1 mt-3 shadow-xs">
              <div className="w-12 h-12 rounded-full p-0.5 bg-neutral-200 dark:bg-neutral-700 relative">
                <AvatarWithFallback
                  avatarUrl={leaderboard[1].avatar}
                  name={leaderboard[1].name}
                  sizeClass="w-full h-full"
                  textClass="text-xs font-bold"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-neutral-700 text-[10px] font-bold flex items-center justify-center text-white">
                  2
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate max-w-[80px]">
                  {leaderboard[1].name}
                </div>
                <div className="text-[10px] text-[#0F9D58] font-medium">
                  {leaderboard[1].streakDays}d streak
                </div>
              </div>
            </div>

            {/* Rank 1 (Tallest Center) */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border-2 border-[#1A73E8] dark:border-[#8AB4F8] text-center flex flex-col items-center justify-between order-2 shadow-xs">
              <div className="w-14 h-14 rounded-full p-0.5 border-2 border-[#1A73E8] relative">
                <AvatarWithFallback
                  avatarUrl={leaderboard[0].avatar}
                  name={leaderboard[0].name}
                  sizeClass="w-full h-full"
                  textClass="text-sm font-bold"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1A73E8] text-[10px] font-bold flex items-center justify-center text-white">
                  👑
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xs font-bold text-neutral-900 dark:text-white truncate max-w-[90px]">
                  {leaderboard[0].name}
                </div>
                <div className="text-[10px] text-[#0F9D58] font-medium">
                  {leaderboard[0].streakDays}d streak
                </div>
              </div>
            </div>

            {/* Rank 3 */}
            <div className="p-3 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-center flex flex-col items-center justify-between order-3 mt-5 shadow-xs">
              <div className="w-11 h-11 rounded-full p-0.5 bg-neutral-200 dark:bg-neutral-700 relative">
                <AvatarWithFallback
                  avatarUrl={leaderboard[2].avatar}
                  name={leaderboard[2].name}
                  sizeClass="w-full h-full"
                  textClass="text-xs font-bold"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-neutral-600 text-[10px] font-bold flex items-center justify-center text-white">
                  3
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate max-w-[80px]">
                  {leaderboard[2].name}
                </div>
                <div className="text-[10px] text-[#0F9D58] font-medium">
                  {leaderboard[2].streakDays}d streak
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-neutral-400 text-xs">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-700" />
            <p>Submit daily proofs to appear on the leaderboard!</p>
          </div>
        )}

        {/* Complete Leaderboard List */}
        <div className="space-y-2 pt-2">
          {leaderboard.map((peer, idx) => (
            <motion.div
              key={peer.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`p-3 rounded-2xl flex items-center justify-between border transition ${
                peer.isCurrentUser
                  ? "bg-[#E8F0FE] dark:bg-[#1A73E8]/10 border-[#D2E3FC] dark:border-[#1A73E8]/30 shadow-xs"
                  : "bg-white dark:bg-[#1E1E1E] border-[#E8EAED] dark:border-[#303134] shadow-xs"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  #{peer.rank}
                </span>

                <div className="w-9 h-9 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
                  <AvatarWithFallback
                    avatarUrl={peer.avatar}
                    name={peer.name}
                    sizeClass="w-full h-full"
                    textClass="text-xs font-bold"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <span>{peer.name}</span>
                    {peer.isCurrentUser && (
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#0F9D58] text-white">
                        YOU
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">@{peer.username}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">{peer.kudosEarned} Kudos</div>
                <div className="text-[10px] font-medium text-[#0F9D58] flex items-center justify-end gap-0.5">
                  <Flame className="w-3 h-3 fill-current" />
                  {peer.streakDays}d streak
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Inviting Card when User is Sole Competitor */}
        {leaderboard.length <= 1 && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-center space-y-2 mt-3 shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0F9D58]">
              <Sparkles className="w-4 h-4" />
              <span>You're currently holding #1 in this sprint!</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
              Invite spotters to race for the weekly pot and multiply your habit stakes.
            </p>
            <button
              type="button"
              onClick={() => {
                triggerHaptic([15]);
                if (typeof window !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.origin + "/feed");
                  showToast("Cohort invite link copied!", "success");
                }
              }}
              className="mt-1 px-4 py-2 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 border border-[#D2E3FC] dark:border-[#1A73E8]/30 text-[#1A73E8] dark:text-[#8AB4F8] text-xs font-medium hover:bg-[#D2E3FC] transition cursor-pointer"
            >
              + Invite Spotters to Race
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
