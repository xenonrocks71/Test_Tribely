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
    <div className="w-full py-4 mb-4 bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl shadow-xs select-none">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
            <h3 className="text-xs font-semibold tracking-tight text-neutral-900 dark:text-white">
              Suggested Tribes
            </h3>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Join accountability tribes to build daily habits together
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic([15]);
            setActiveTab("explore");
          }}
          className="text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline flex items-center gap-0.5 cursor-pointer"
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
              className="min-w-[210px] max-w-[210px] flex-shrink-0 bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition-colors hover:border-[#DADCE0] dark:hover:border-[#3C4043]"
            >
              <div>
                {/* Top Badge (Public vs Private) */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-[#282A2D] text-neutral-700 dark:text-neutral-300 border border-neutral-300/60 dark:border-[#3C4043]"
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

                  <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" />
                    <span>{squad.member_count || 1}</span>
                  </span>
                </div>

                {/* Squad Name & Description */}
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-white line-clamp-1">
                  {squad.name}
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 h-7 leading-snug">
                  {squad.description || "Daily check-ins and mutual accountability."}
                </p>

                {/* Monetary Policy Pill */}
                <div className="mt-2.5 p-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] flex items-center justify-between text-[10px] font-medium">
                  <span className="text-neutral-500 dark:text-neutral-400">Miss Cutoff</span>
                  <span className="text-neutral-700 dark:text-neutral-300 font-mono text-[10px]">
                    {squad.penalty_amount || 50} Kudos
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-3">
                {isJoined ? (
                  <div className="w-full py-1.5 rounded-full bg-[#E6F4EA] dark:bg-[#137333]/20 border border-[#CEEAD6] dark:border-[#137333]/30 text-[#137333] dark:text-[#81C995] text-xs font-medium flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isPrivate ? "Pending" : "Joined"}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction(squad)}
                    className="w-full py-1.5 rounded-full text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#A8C7FA] text-white dark:text-[#121212]"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>{isPrivate ? "Request Join" : "Join Tribe"}</span>
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
              className="w-full max-w-md bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-[#303134] rounded-t-3xl sm:rounded-3xl p-6 text-neutral-900 dark:text-white space-y-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-[#303134]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-[#E8F0FE] dark:bg-[#8AB4F8]/15 text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#8AB4F8]/30">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{selectedSquad.name}</h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#1A73E8] dark:text-[#8AB4F8]" />
                      <span>Private Tribe • Escrow Protected</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSquad(null)}
                  className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-[#282A2D] text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Squad Terms Card */}
              <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Commitment Stake
                  </span>
                  <span className="text-neutral-900 dark:text-white font-semibold text-sm flex items-center gap-1">
                    <Coins className="w-4 h-4 text-neutral-500" />
                    <span>50.00 Kudos</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Daily Miss Penalty
                  </span>
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {selectedSquad.penalty_amount || 50} Kudos / Day
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                    Your Current Balance
                  </span>
                  <span className="text-[#0F9D58] dark:text-[#81C995] font-semibold">
                    {user.kudosBalance} Kudos
                  </span>
                </div>
              </div>

              {/* Cohort Rule Explanation */}
              <div className="p-3 rounded-xl bg-[#E8F0FE] dark:bg-[#8AB4F8]/10 border border-[#D2E3FC] dark:border-[#8AB4F8]/20 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8] flex-shrink-0 mt-0.5" />
                <div>
                  <strong>How the Tribe Works:</strong> Submit your daily habit proof before cutoff time to protect your active streak.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting || user.kudosBalance < 50}
                  onClick={handleConfirmPrivateJoin}
                  className="w-full py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#A8C7FA] text-white dark:text-[#121212] font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Depositing & Requesting...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Deposit 50 Kudos & Request Join</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSquad(null)}
                  className="w-full py-2 text-neutral-500 dark:text-neutral-400 text-xs font-medium hover:text-neutral-900 dark:hover:text-white cursor-pointer"
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
