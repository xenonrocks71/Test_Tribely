"use client";

import React, { useState, useEffect } from "react";
import { Coins, Sparkles, ArrowUpRight } from "lucide-react";
import { tribelyService } from "@/services/tribely.service";

interface KudosBadgeProps {
  initialBalance?: number;
  className?: string;
  showDetails?: boolean;
}

export const KudosBadge: React.FC<KudosBadgeProps> = ({
  initialBalance,
  className = "",
  showDetails = false,
}) => {
  const [balance, setBalance] = useState<number>(initialBalance ?? 1000);
  const [loading, setLoading] = useState<boolean>(initialBalance === undefined);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const fetchBalance = async () => {
      try {
        const wallet = await tribelyService.getKudosWallet();
        if (mounted && wallet && typeof wallet.kudos_balance === "number") {
          setBalance(wallet.kudos_balance);
        }
      } catch (err) {
        // Fallback gracefully without breaking UI
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchBalance();

    // Listen to custom Kudos update events (e.g. after staking or payouts)
    const handleKudosUpdate = (event: any) => {
      if (typeof event.detail?.kudos_balance === "number") {
        setBalance(event.detail.kudos_balance);
      }
    };
    window.addEventListener("kudos_balance_updated", handleKudosUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("kudos_balance_updated", handleKudosUpdate);
    };
  }, []);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-yellow-500/10 hover:from-amber-500/20 hover:to-yellow-500/20 border border-amber-500/30 hover:border-amber-400/50 shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all duration-200 cursor-pointer"
        title="Your Kudos Virtual Currency Balance"
      >
        <div className="relative flex items-center justify-center">
          <Coins className="w-4 h-4 text-amber-400 animate-pulse group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xs font-bold tracking-tight text-amber-200 group-hover:text-amber-100 font-mono">
            {loading ? "..." : balance.toLocaleString()}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
            Kudos
          </span>
        </div>

        {showDetails && (
          <ArrowUpRight className="w-3 h-3 text-amber-400/60 group-hover:text-amber-300 transition-colors" />
        )}
      </div>

      {/* Micro Hover Card Tooltip */}
      {isHovered && (
        <div className="absolute top-full right-0 mt-2 z-50 w-56 p-3 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-neutral-800 shadow-xl text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
            <span className="text-xs font-medium text-neutral-400">Kudos Vault</span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-2.5 h-2.5" /> Staking Ready
            </span>
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {balance.toLocaleString()} Kudos
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
            Stake Kudos to enter accountability arenas. Win weekly shares of the prize pool by keeping your streaks alive!
          </p>
        </div>
      )}
    </div>
  );
};
