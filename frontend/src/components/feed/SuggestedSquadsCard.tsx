"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Shield,
  Sparkles,
  Lock,
  Globe,
  Check,
  Plus,
  Coins,
  ArrowRight,
  X,
  AlertCircle,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tribelyService, ApiArena } from "@/services/tribely.service";

export const SuggestedSquadsCard: React.FC = () => {
  const { arenas, joinSquad, user, setActiveTab, triggerHaptic, showToast } = useApp();

  const [suggestedSquads, setSuggestedSquads] = useState<ApiArena[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSquad, setSelectedSquad] = useState<ApiArena | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinedSquadIds, setJoinedSquadIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let isMounted = true;
    const loadSuggestions = async () => {
      try {
        const allArenas = await tribelyService.fetchDiscoveryArenas();
        if (!isMounted) return;

        const joinedIds = new Set(arenas.map((a) => a.rawId));
        // Filter out arenas the user is already in and any test/smoke arenas
        const unjoined = allArenas.filter(
          (a) =>
            !joinedIds.has(a.id) &&
            !a.name.toLowerCase().includes("smoke") &&
            !a.name.toLowerCase().includes("test")
        );

        setSuggestedSquads(unjoined.slice(0, 6));
      } catch {
        // Silent catch
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadSuggestions();
    return () => {
      isMounted = false;
    };
  }, [arenas]);

  const handleAction = async (squad: ApiArena) => {
    triggerHaptic([20]);
    if (squad.is_private) {
      // Open Private Squad Escrow Modal
      setSelectedSquad(squad);
    } else {
      // Instant 1-tap Join
      setIsSubmitting(true);
      const success = await joinSquad(squad.id);
      setIsSubmitting(false);
      if (success) {
        setJoinedSquadIds((prev) => new Set([...prev, squad.id]));
      }
    }
  };

  const handleConfirmPrivateJoin = async () => {
    if (!selectedSquad) return;
    if (user.kudosBalance < 50) {
      showToast("Insufficient Kudos balance! You need 50 Kudos to join.", "info");
      return;
    }
    setIsSubmitting(true);
    const success = await joinSquad(selectedSquad.id);
    setIsSubmitting(false);
    if (success) {
      setJoinedSquadIds((prev) => new Set([...prev, selectedSquad.id]));
      setSelectedSquad(null);
    }
  };

  if (!isLoading && suggestedSquads.length === 0) {
    return null;
  }

  return (
    <div className="w-full py-4 bg-neutral-50 dark:bg-[#0c0c0c] border-y border-neutral-200 dark:border-neutral-900 select-none">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <h3 className="text-xs font-black tracking-tight text-neutral-900 dark:text-white uppercase">
              Suggested Squads For You
            </h3>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Join accountability tribes to build habits with stakes
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic([15]);
            setActiveTab("explore");
          }}
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <span>See all</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ── HORIZONTAL SCROLLING SUGGESTION CARDS ── */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
        {suggestedSquads.map((squad) => {
          const isJoined = joinedSquadIds.has(squad.id);
          const isPrivate = squad.is_private;

          return (
            <div
              key={squad.id}
              className="min-w-[210px] max-w-[210px] flex-shrink-0 bg-white dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div>
                {/* Top Badge (Public vs Private) */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isPrivate
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {isPrivate ? (
                      <>
                        <Lock className="w-2.5 h-2.5" />
                        <span>Private</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-2.5 h-2.5" />
                        <span>Public</span>
                      </>
                    )}
                  </span>

                  <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" />
                    <span>{squad.member_count || 1}</span>
                  </span>
                </div>

                {/* Squad Name & Description */}
                <h4 className="text-xs font-black text-neutral-900 dark:text-white line-clamp-1">
                  {squad.name}
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 h-7 leading-snug">
                  {squad.description || "Daily check-ins, sprint pot, and mutual accountability."}
                </p>

                {/* Monetary Policy Pill */}
                <div className="mt-2.5 p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between text-[9px] font-bold">
                  <span className="text-neutral-500 dark:text-neutral-400">Miss Fine</span>
                  <span className="text-rose-500 flex items-center gap-0.5">
                    <span>⚡</span>
                    <span>{squad.penalty_amount || 50} Kudos</span>
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-3">
                {isJoined ? (
                  <div className="w-full py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-emerald-500 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{isPrivate ? "Pending" : "Joined"}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction(squad)}
                    className={`w-full py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isPrivate
                        ? "bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20"
                        : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/20"
                    }`}
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>{isPrivate ? "Stake & Join" : "1-Tap Join"}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── PRIVATE SQUAD ESCROW CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {selectedSquad && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-3xl p-6 text-neutral-900 dark:text-white space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">{selectedSquad.name}</h3>
                    <p className="text-[11px] text-amber-500 font-bold flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>Private Cohort • Escrow Protected</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSquad(null)}
                  className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Squad Terms Card */}
              <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Commitment Stake
                  </span>
                  <span className="text-amber-500 font-black text-sm flex items-center gap-1">
                    <Coins className="w-4 h-4" />
                    <span>50.00 Kudos</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Daily Miss Penalty
                  </span>
                  <span className="text-rose-500 font-black">
                    ⚡ {selectedSquad.penalty_amount || 50} Kudos / Day
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Your Current Balance
                  </span>
                  <span className="text-emerald-500 font-black">
                    ⚡ {user.kudosBalance} Kudos
                  </span>
                </div>
              </div>

              {/* Cohort Rule Explanation */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>How the Squad Works:</strong> Submit your daily habit proof before the cutoff time to protect your active streak. If you miss a deadline, your streak resets and 50 Kudos is pooled for consistent peers.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting || user.kudosBalance < 50}
                  onClick={handleConfirmPrivateJoin}
                  className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Depositing & Requesting...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Deposit 50 Kudos & Request Join</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSquad(null)}
                  className="w-full py-2 text-neutral-400 text-xs font-semibold hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
