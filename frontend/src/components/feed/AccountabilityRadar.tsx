"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Flame,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Shield,
  ArrowRight,
  Sparkles,
  Key,
  Users,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tribelyService } from "@/services/tribely.service";

interface AccountabilityRadarProps {
  onOpenInviteModal?: () => void;
  onOpenCreateSquad?: () => void;
}

/**
 * Desktop & Laptop Right-Hand Accountability Radar Widget.
 * Visible on desktop viewports (>= 1280px / xl) alongside the main feed.
 * Keeps daily habit deadlines, 1.5x multipliers, at-risk peers, and vault stakes top of mind.
 */
export const AccountabilityRadar: React.FC<AccountabilityRadarProps> = ({ onOpenInviteModal }) => {
  const {
    user,
    arenas,
    openCamera,
    triggerHaptic,
    showToast,
  } = useApp();

  const [nudgedUsers, setNudgedUsers] = useState<Record<number, boolean>>({});
  const [isNudging, setIsNudging] = useState<number | null>(null);

  const handleNudgeMember = async (arenaId: number, targetUserId: number, targetName: string) => {
    triggerHaptic([20, 30]);
    setIsNudging(targetUserId);
    try {
      const res = await tribelyService.nudgeMember(arenaId, targetUserId);
      if (res.success) {
        setNudgedUsers((prev) => ({ ...prev, [targetUserId]: true }));
        showToast(`⚡ Nudge sent to ${targetName}!`, "nudge");
      } else {
        showToast(res.message || "Failed to send nudge", "info");
      }
    } catch {
      showToast("Nudge failed", "info");
    } finally {
      setIsNudging(null);
    }
  };

  const hasSubmittedToday = user.hasSubmittedToday;
  const activeSquadCount = arenas.length;

  return (
    <div className="flex flex-col gap-4 w-80 select-none pb-6">
      {/* ── 1. TODAY'S DAILY HABIT STATUS CARD ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200/80 dark:border-[#303134] shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
            <span>24h Cycle Status</span>
          </span>
          {hasSubmittedToday ? (
            <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] border border-[#CEEAD6] dark:border-[#0F9D58]/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Verified</span>
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-[#FEF7E0] dark:bg-[#F9AB00]/15 text-amber-700 dark:text-amber-300 border border-[#FEEFC3] dark:border-[#F9AB00]/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Proof Needed</span>
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white tracking-tight leading-snug mb-1">
          {hasSubmittedToday ? "Today's Habit Locked In" : "Daily Proof Awaiting Check-in"}
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-3.5">
          {hasSubmittedToday
            ? "Your streak is protected. Check in tomorrow to keep your momentum going."
            : "Drop habit verification before the 24-hour cycle cutoff to avoid escrow fines."}
        </p>

        {!hasSubmittedToday ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => {
              triggerHaptic([20]);
              openCamera();
            }}
            className="w-full py-2.5 px-4 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#A8C7FA] text-white dark:text-[#121212] text-xs font-medium shadow-xs flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Submit Habit Drop</span>
          </motion.button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-[#0F9D58] bg-[#E6F4EA] dark:bg-[#0F9D58]/15 p-2.5 rounded-xl border border-[#CEEAD6] dark:border-[#0F9D58]/30">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0F9D58]" />
            <span>Completed for today &middot; Streak +1</span>
          </div>
        )}
      </div>

      {/* ── 2. SQUAD RADAR ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200/80 dark:border-[#303134] shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
            <span>Active Squads</span>
          </span>
          <span className="text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8]">
            {activeSquadCount} Active {activeSquadCount === 1 ? "Squad" : "Squads"}
          </span>
        </div>

        {arenas.length === 0 ? (
          <p className="text-xs text-neutral-400 italic py-2">
            Join or launch an arena to unlock collective streak multipliers.
          </p>
        ) : (
          <div className="space-y-2">
            {arenas.slice(0, 3).map((squad) => (
              <Link
                key={squad.id}
                href={`/arenas/${squad.rawId || squad.id}`}
                className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#202124] border border-neutral-200/60 dark:border-[#303134] flex items-center justify-between hover:border-[#1A73E8]/40 dark:hover:border-[#8AB4F8]/40 transition group cursor-pointer block"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base">{squad.emoji || "⚡"}</span>
                  <div className="truncate">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-200 block truncate group-hover:text-[#1A73E8] dark:group-hover:text-[#8AB4F8] transition-colors">
                      {squad.name}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {squad.memberCount} members &middot; {squad.penaltyAmount} stake
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#1A73E8] dark:group-hover:text-[#8AB4F8] group-hover:translate-x-0.5 transition" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. QUICK STATS SUMMARY ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200/80 dark:border-[#303134] shadow-xs">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            <Flame className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
            <span>Streak</span>
          </div>
          <span className="text-base font-bold text-neutral-900 dark:text-white">
            {user.currentStreak} Days
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200/80 dark:border-[#303134] shadow-xs">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Vault</span>
          </div>
          <span className="text-base font-bold text-neutral-900 dark:text-white">
            {user.kudosBalance.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
