"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Coins,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { tribelyService } from "@/services/tribely.service";

interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  arenaId: number;
  arenaTitle: string;
  entryStake: number;
  isPrivate?: boolean;
  onSuccess?: () => void;
}

export const StakingModal: React.FC<StakingModalProps> = ({
  isOpen,
  onClose,
  arenaId,
  arenaTitle,
  entryStake,
  isPrivate = false,
  onSuccess,
}) => {
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingBalance, setFetchingBalance] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchBalance = async () => {
      setFetchingBalance(true);
      setError(null);
      try {
        const wallet = await tribelyService.getKudosWallet();
        if (mounted && wallet) {
          setUserBalance(wallet.kudos_balance);
        }
      } catch (err: any) {
        if (mounted) {
          setError("Failed to fetch current Kudos balance.");
        }
      } finally {
        if (mounted) setFetchingBalance(false);
      }
    };

    fetchBalance();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentBalance = userBalance ?? 0;
  const hasSufficientBalance = currentBalance >= entryStake;
  const balanceAfterStake = currentBalance - entryStake;

  const handleConfirmStake = async () => {
    if (!hasSufficientBalance) return;
    setLoading(true);
    setError(null);

    try {
      const res = await tribelyService.joinArenaWithStake(
        arenaId,
        inviteCode.trim() || undefined
      );

      setIsSuccess(true);

      // Dispatch global custom event for optimistic updates across all components
      window.dispatchEvent(
        new CustomEvent("kudos_balance_updated", {
          detail: { kudos_balance: res.user_kudos_balance },
        })
      );

      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to stake Kudos and join arena.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl md:rounded-3xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-2xl p-6 text-left text-neutral-900 dark:text-neutral-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] transition-colors cursor-pointer"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#E6F4EA] dark:bg-[#137333]/20 border border-[#CEEAD6] dark:border-[#137333]/30 flex items-center justify-center text-[#0F9D58] dark:text-[#81C995] mb-3 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">Stake Confirmed!</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              You have staked {entryStake} Kudos into {arenaTitle}. Welcome to the arena!
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#FEF7E0] dark:bg-[#F9AB00]/20 border border-[#FEEFC3] dark:border-[#F9AB00]/30 text-[#B06000] dark:text-[#F9AB00] flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-white">Join Arena with Stake</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-xs">{arenaTitle}</p>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Balance Overview Card */}
            <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-2.5 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Your Current Balance</span>
                <span className="font-semibold text-neutral-900 dark:text-white font-mono">
                  {fetchingBalance ? "Loading..." : `${currentBalance.toLocaleString()} Kudos`}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Required Entry Stake</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400 font-mono">
                  -{entryStake.toLocaleString()} Kudos
                </span>
              </div>

              <div className="border-t border-[#E8EAED] dark:border-[#303134] pt-2 flex justify-between items-center text-xs">
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">Balance After Stake</span>
                <span
                  className={`font-semibold font-mono ${
                    hasSufficientBalance ? "text-[#0F9D58] dark:text-[#81C995]" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {fetchingBalance
                    ? "..."
                    : `${balanceAfterStake.toLocaleString()} Kudos`}
                </span>
              </div>
            </div>

            {/* Insufficient Balance Warning */}
            {!fetchingBalance && !hasSufficientBalance && (
              <div className="mb-4 p-3 rounded-xl bg-[#FEF7E0] dark:bg-[#F9AB00]/10 border border-[#FEEFC3] dark:border-[#F9AB00]/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-semibold">Insufficient Kudos Balance</p>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[11px]">
                    You need {entryStake - currentBalance} more Kudos to enter this arena. Maintain check-ins elsewhere or invite friends to earn more Kudos!
                  </p>
                </div>
              </div>
            )}

            {/* Private Arena Code Input */}
            {isPrivate && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  Cohort Passcode / Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CODE100"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm font-mono focus:outline-none focus:border-[#1A73E8] transition-colors"
                />
              </div>
            )}

            {/* Security Guarantee Notice */}
            <div className="flex items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 mb-5 bg-[#E8F0FE]/60 dark:bg-[#1A73E8]/10 p-2.5 rounded-xl border border-[#D2E3FC] dark:border-[#1A73E8]/20">
              <ShieldCheck className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8] shrink-0" />
              <span>
                Your stake is locked in the arena escrow vault. 50% is redistributed every Sunday to top streak performers.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmStake}
                disabled={loading || fetchingBalance || !hasSufficientBalance}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium shadow-xs transition-colors cursor-pointer ${
                  !hasSufficientBalance
                    ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                    : "bg-[#1A73E8] hover:bg-[#1557B0] text-white"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Locking Stake...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Confirm Stake ({entryStake} Kudos)
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
