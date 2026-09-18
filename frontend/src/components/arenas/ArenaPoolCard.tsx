"use client";

import React, { useState, useEffect } from "react";
import {
  Coins,
  Trophy,
  ShieldAlert,
  Users,
  Zap,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { ArenaPoolDetails } from "@/types/tribely";
import { tribelyService } from "@/services/tribely.service";

interface ArenaPoolCardProps {
  arenaId: number;
  initialPool?: ArenaPoolDetails | null;
  isJoined?: boolean;
  onOpenStaking?: () => void;
  className?: string;
}

export const ArenaPoolCard: React.FC<ArenaPoolCardProps> = ({
  arenaId,
  initialPool,
  isJoined = false,
  onOpenStaking,
  className = "",
}) => {
  const [poolDetails, setPoolDetails] = useState<ArenaPoolDetails | null>(
    initialPool || null
  );
  const [loading, setLoading] = useState<boolean>(!initialPool);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const fetchPool = async () => {
      try {
        const data = await tribelyService.getArenaPoolDetails(arenaId);
        if (mounted && data) {
          setPoolDetails(data);
        }
      } catch (err) {
        // Fallback gracefully
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPool();

    // Listen for WebSocket pool balance updates
    const handleWebSocketPoolUpdate = (event: any) => {
      if (
        event.detail?.arena_id === arenaId &&
        typeof event.detail?.pool_balance === "number"
      ) {
        setPoolDetails((prev) =>
          prev
            ? {
                ...prev,
                pool_balance: event.detail.pool_balance,
                weekly_prize_pool: Math.floor(event.detail.pool_balance / 2),
              }
            : null
        );
      }
    };

    window.addEventListener("pool_balance_updated", handleWebSocketPoolUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("pool_balance_updated", handleWebSocketPoolUpdate);
    };
  }, [arenaId]);

  const poolBalance = poolDetails?.pool_balance ?? 0;
  const weeklyPrize = poolDetails?.weekly_prize_pool ?? Math.floor(poolBalance / 2);
  const entryStake = poolDetails?.entry_stake ?? 50;
  const penaltyAmount = poolDetails?.penalty_amount ?? 50;
  const memberCount = poolDetails?.active_members_count ?? 1;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-xs transition-all duration-200 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Bar */}
      <div className="relative z-10 px-5 py-3.5 border-b border-[#E8EAED] dark:border-[#303134] bg-[#F8F9FA]/60 dark:bg-[#202124]/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FEF7E0] dark:bg-[#F9AB00]/15 border border-[#FEEFC3] dark:border-[#F9AB00]/25 text-[#B06000] dark:text-[#F9AB00] flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-neutral-900 dark:text-white tracking-wide uppercase">
              Arena Staking Pool
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Escrow & 50% Weekly Rewards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] dark:bg-[#137333]/20 text-[#137333] dark:text-[#81C995] border border-[#CEEAD6] dark:border-[#137333]/30">
            <Zap className="w-3 h-3 text-[#0F9D58]" />
            Live Sync
          </span>
        </div>
      </div>

      {/* Main Metric Spotlight */}
      <div className="relative z-10 p-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Total Accumulated Vault
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-bold text-neutral-900 dark:text-white font-mono tracking-tight">
                {loading ? "..." : poolBalance.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Kudos</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              50% split this Sunday among top consistent members
            </p>
          </div>

          {!isJoined && onOpenStaking && (
            <button
              onClick={onOpenStaking}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stake to Join ({entryStake} Kudos)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 3-Col Policy Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5">
          {/* Weekly Prize Pool */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134]">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs font-medium">Sunday Payout</span>
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-base font-semibold text-neutral-900 dark:text-white font-mono">
              {weeklyPrize.toLocaleString()} Kudos
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
              50% of arena pool
            </span>
          </div>

          {/* Entry Stake Requirement */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134]">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs font-medium">Entry Stake</span>
              <Coins className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
            </div>
            <div className="text-base font-semibold text-neutral-900 dark:text-white font-mono">
              {entryStake} Kudos
            </div>
            <span className="text-[11px] text-[#1A73E8] dark:text-[#8AB4F8] font-medium">
              Locked into vault
            </span>
          </div>

          {/* Missed Deadline Fine */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134]">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs font-medium">Missed Deadline</span>
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="text-base font-semibold text-neutral-900 dark:text-white font-mono">
              -{penaltyAmount} Kudos
            </div>
            <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
              Deducted to pool
            </span>
          </div>
        </div>

        {/* Active Winners / Roster Footer */}
        <div className="mt-4 pt-3 border-t border-[#E8EAED] dark:border-[#303134] flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            <span>{memberCount} Active Participants</span>
          </div>
          <span className="text-[11px] text-neutral-400">
            Escrow Verified Ledger
          </span>
        </div>
      </div>
    </div>
  );
};
