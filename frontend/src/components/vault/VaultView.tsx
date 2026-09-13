"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Zap,
  Flame,
  Shield,
  Clock,
  TrendingUp,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useApp } from "@/context/AppContext";

export const VaultView: React.FC = () => {
  const { user, arenas, feedPosts, claimStreakLifeline, triggerHaptic, showToast } = useApp();
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
        avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
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
        avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
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
    <div className="w-full pb-24 text-white">
      {/* 1. Header with 7-Day Sprint Economy Banner */}
      <div className="p-4 border-b border-neutral-900 bg-gradient-to-b from-neutral-900 to-neutral-950 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">7-Day Sprint Vault</h2>
              <p className="text-[11px] text-neutral-400">Weekly cohort accountability cycle</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-black text-amber-400 flex items-center justify-end gap-1">
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
              {user.kudosBalance} Kudos
            </div>
            <span className="text-[10px] text-neutral-500">Reputation Balance</span>
          </div>
        </div>

        {/* Sprint Status & Multiplier Meter */}
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300">Sprint Cycle #14 Progress</span>
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {user.multiplier} Multiplier Active 🚀
            </span>
          </div>

          {/* 7-Day Sprint Indicator Rings */}
          <div className="grid grid-cols-7 gap-1.5 pt-1">
            {sprintDays.map((day, idx) => {
              const isPast = idx < currentDayOfSprint - 1;
              const isToday = idx === currentDayOfSprint - 1;
              const isFuture = idx >= currentDayOfSprint;

              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-black border transition ${
                      isPast
                        ? "bg-emerald-500 border-emerald-400 text-neutral-950 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        : isToday
                        ? "bg-neutral-800 border-cyan-400 text-cyan-400 ring-2 ring-cyan-400/40"
                        : "bg-neutral-950 border-neutral-800 text-neutral-600"
                    }`}
                  >
                    {isPast ? "✓" : isToday ? "TODAY" : ""}
                  </div>
                  <span className="text-[9px] font-semibold text-neutral-400">{day}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
            Each daily verified drop instantly returns <strong className="text-white">1/7th</strong> of your stake.
            Hitting 7/7 unlocks the full <strong className="text-emerald-400">1.5x Tribe Pool payout</strong> on Sunday
            midnight.
          </p>
        </div>

        {/* Emergency Streak Lifeline / Shield Inventory */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Streak Shields ({user.streakShields}/3)</div>
              <div className="text-[10px] text-neutral-400">Protects multiplier on missed days</div>
            </div>
          </div>

          <button
            type="button"
            onClick={claimStreakLifeline}
            className="py-1.5 px-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold hover:bg-cyan-500 hover:text-neutral-950 transition cursor-pointer"
          >
            + Claim Shield
          </button>
        </div>
      </div>

      {/* 2. Leaderboard Navigation Switcher */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Cohort Leaderboard
          </h3>

          <div className="flex items-center p-0.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveLeaderboardTab("sprint");
              }}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeLeaderboardTab === "sprint" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400"
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
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeLeaderboardTab === "global" ? "bg-emerald-500 text-neutral-950" : "text-neutral-400"
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
          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center flex flex-col items-center justify-between order-1 mt-3">
            <div className="w-12 h-12 rounded-full p-0.5 bg-neutral-700 relative">
              <img
                src={leaderboard[1].avatar}
                alt={leaderboard[1].name}
                className="w-full h-full rounded-full object-cover"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-neutral-700 text-[10px] font-black flex items-center justify-center text-white">
                2
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-white truncate max-w-[80px]">
                {leaderboard[1].name}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                🔥 {leaderboard[1].streakDays}d
              </div>
            </div>
          </div>

          {/* Rank 1 (Tallest Center) */}
          <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-500/10 to-neutral-900 border border-amber-500/30 text-center flex flex-col items-center justify-between order-2 shadow-lg shadow-amber-500/10">
            <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-yellow-300 relative shadow-[0_0_15px_rgba(245,158,11,0.4)]">
              <img
                src={leaderboard[0].avatar}
                alt={leaderboard[0].name}
                className="w-full h-full rounded-full object-cover"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-[10px] font-black flex items-center justify-center text-neutral-950">
                👑
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-amber-300 truncate max-w-[90px]">
                {leaderboard[0].name}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                🔥 {leaderboard[0].streakDays}d
              </div>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center flex flex-col items-center justify-between order-3 mt-5">
            <div className="w-11 h-11 rounded-full p-0.5 bg-amber-800/80 relative">
              <img
                src={leaderboard[2].avatar}
                alt={leaderboard[2].name}
                className="w-full h-full rounded-full object-cover"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-800 text-[10px] font-black flex items-center justify-center text-white">
                3
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-white truncate max-w-[80px]">
                {leaderboard[2].name}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                🔥 {leaderboard[2].streakDays}d
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="py-8 text-center text-neutral-500 text-xs">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
            <p>Submit proofs to appear on the leaderboard!</p>
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
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-neutral-900/60 border-neutral-800/70"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center text-xs font-black text-neutral-500">
                  #{peer.rank}
                </span>

                <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700">
                  <img src={peer.avatar} alt={peer.name} className="w-full h-full object-cover" />
                </div>

                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{peer.name}</span>
                    {peer.isCurrentUser && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500 text-neutral-950">
                        YOU
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400">@{peer.username}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-black text-amber-400">{peer.kudosEarned} ⚡</div>
                <div className="text-[10px] font-semibold text-emerald-400 flex items-center justify-end gap-0.5">
                  <Flame className="w-3 h-3 fill-emerald-400" />
                  {peer.streakDays}d streak
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Inviting Card when User is Sole Competitor */}
        {leaderboard.length <= 1 && (
          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center space-y-2 mt-3">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>You're currently holding #1 in this sprint!</span>
            </div>
            <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
              Invite spotters to race for the weekly pot and multiply your habit stakes.
            </p>
            <button
              type="button"
              onClick={() => {
                triggerHaptic([15]);
                if (typeof window !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.origin + "/dashboard?tab=explore");
                  showToast("📋 Cohort invite link copied!", "success");
                }
              }}
              className="mt-1 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500 hover:text-neutral-950 transition cursor-pointer"
            >
              + Invite Spotters to Race
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
