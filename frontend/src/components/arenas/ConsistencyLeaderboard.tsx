"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Flame,
  Coins,
  CheckCircle2,
  Users,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { LeaderboardMember } from "@/types/tribely";
import { tribelyService } from "@/services/tribely.service";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

interface ConsistencyLeaderboardProps {
  arenaId: number;
  className?: string;
}

export const ConsistencyLeaderboard: React.FC<ConsistencyLeaderboardProps> = ({
  arenaId,
  className = "",
}) => {
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchLeaderboard = async () => {
    try {
      const data = await tribelyService.getArenaLeaderboard(arenaId);
      if (Array.isArray(data)) {
        setMembers(data);
      }
    } catch (err) {
      // Graceful fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [arenaId]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const topThree = members.slice(0, 3);
  const restMembers = members.slice(3);

  const getRankBadgeStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "from-amber-400 to-yellow-500 text-neutral-950 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]";
      case 2:
        return "from-slate-300 to-slate-400 text-neutral-950 border-slate-200 shadow-[0_0_15px_rgba(203,213,225,0.2)]";
      case 3:
        return "from-amber-700 to-amber-800 text-amber-100 border-amber-600 shadow-[0_0_15px_rgba(180,83,9,0.2)]";
      default:
        return "bg-neutral-800 text-neutral-300 border-neutral-700";
    }
  };

  return (
    <div
      className={`rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Consistency Podium
            </h3>
            <p className="text-xs text-neutral-400">
              Ranked by Habit Streaks & Projected Kudos Split
            </p>
          </div>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing || loading}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Refresh Leaderboard"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin text-amber-400" : ""}`}
          />
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
            <p className="text-xs text-neutral-400 font-medium">
              Calculating arena consistency matrix...
            </p>
          </div>
        ) : members.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Users className="w-10 h-10 text-neutral-600 mb-3" />
            <p className="text-sm font-semibold text-white">No active participants yet</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs">
              Stake Kudos to join this arena and become the first spotter on the podium!
            </p>
          </div>
        ) : (
          <>
            {/* Top 3 Visual Podium */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {topThree.map((member) => (
                  <div
                    key={member.user_id}
                    className={`relative flex flex-col items-center p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
                      member.rank === 1
                        ? "bg-gradient-to-b from-amber-500/10 via-neutral-900 to-neutral-950 border-amber-500/40 shadow-lg shadow-amber-500/10"
                        : "bg-neutral-950/60 border-neutral-800"
                    }`}
                  >
                    {/* Rank Ribbon Badge */}
                    <div
                      className={`absolute -top-3 px-3 py-0.5 rounded-full text-xs font-black border bg-gradient-to-r ${getRankBadgeStyle(
                        member.rank
                      )}`}
                    >
                      {member.badge} Rank #{member.rank}
                    </div>

                    {/* Avatar with Streak Flame Ring */}
                    <div className="relative mt-2 mb-3">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-neutral-700 bg-neutral-800 flex items-center justify-center shadow-md">
                        <AvatarWithFallback
                          avatarUrl={member.avatar_url}
                          name={member.user_name}
                          sizeClass="w-full h-full"
                          textClass="text-lg font-bold"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-neutral-900 border border-orange-500/40 text-[10px] font-bold text-orange-400 flex items-center gap-0.5 shadow-sm">
                        <Flame className="w-3 h-3 fill-orange-400 text-orange-500" />
                        {member.streak_count}d
                      </div>
                    </div>

                    {/* Name & Handle */}
                    <h4 className="text-sm font-bold text-white text-center truncate max-w-[160px]">
                      {member.user_name}
                    </h4>
                    <span className="text-xs text-neutral-400 font-mono">
                      {member.user_handle}
                    </span>

                    {/* Projected Weekly Payout Spotlight */}
                    <div className="w-full mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        Projected:
                      </span>
                      <span className="font-bold text-amber-300 font-mono">
                        +{member.projected_weekly_kudos.toLocaleString()} Kudos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rest of the Leaderboard Table */}
            {restMembers.length > 0 && (
              <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950/40">
                <div className="divide-y divide-neutral-800/80">
                  {restMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-neutral-400 w-6 text-center font-mono">
                          #{member.rank}
                        </span>
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700">
                          <AvatarWithFallback
                            avatarUrl={member.avatar_url}
                            name={member.user_name}
                            sizeClass="w-full h-full"
                            textClass="text-xs font-bold"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {member.user_name}
                          </p>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {member.user_handle}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1 text-orange-400 font-semibold font-mono">
                          <Flame className="w-3.5 h-3.5 fill-orange-400" />
                          {member.streak_count}d
                        </div>
                        <div className="flex items-center gap-1 text-neutral-400 font-mono hidden sm:flex">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          {member.verified_submissions} checks
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
