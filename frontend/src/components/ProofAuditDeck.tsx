"use client";

import React, { useState, useEffect } from "react";
import { Check, X, Sparkles, ShieldCheck, Flame, ChevronRight, ArrowRight, Zap, RefreshCw } from "lucide-react";

export interface PendingProofItem {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar?: string | null;
  proof_url: string;
  submitted_at: string;
  upvotes: number;
  downvotes: number;
  streak_count?: number;
  ai_confidence_score?: number;
  ai_status?: string;
  ai_audit_notes?: string;
}

interface ProofAuditDeckProps {
  isOpen: boolean;
  onClose: () => void;
  arenaName: string;
  pendingProofs: PendingProofItem[];
  onVote: (submissionId: number, voteType: "up" | "down") => Promise<void>;
}

export default function ProofAuditDeck({
  isOpen,
  onClose,
  arenaName,
  pendingProofs,
  onVote
}: ProofAuditDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voting, setVoting] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"right" | "left" | null>(null);

  const currentProof = pendingProofs[currentIndex];

  const handleVoteAction = async (voteType: "up" | "down") => {
    if (!currentProof || voting) return;
    setVoting(true);
    setSwipeDirection(voteType === "up" ? "right" : "left");

    try {
      await onVote(currentProof.id, voteType);
    } catch (err) {
      console.error("Vote action error:", err);
    } finally {
      setTimeout(() => {
        setSwipeDirection(null);
        setVoting(false);
        setCurrentIndex((prev) => prev + 1);
      }, 200);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !currentProof) return;
      if (e.key === "ArrowRight" || e.key === "l") {
        handleVoteAction("up");
      } else if (e.key === "ArrowLeft" || e.key === "h") {
        handleVoteAction("down");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, currentProof]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-slate-100 text-lg">Proof Audit Deck</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!currentProof || currentIndex >= pendingProofs.length ? (
          <div className="py-12 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400 mb-3" />
            <h4 className="text-lg font-bold text-slate-100">All Caught Up!</h4>
            <p className="mt-1 text-sm text-slate-400">
              You have audited all pending habit proofs in {arenaName}.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-slate-950 hover:bg-amber-400 transition-all cursor-pointer"
            >
              Back to Arena
            </button>
          </div>
        ) : (
          <div>
            {/* Progress Bar */}
            <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
              <span>Card {currentIndex + 1} of {pendingProofs.length}</span>
              <span className="flex items-center space-x-1 text-amber-400">
                <Flame className="h-3.5 w-3.5" />
                <span>{currentProof.streak_count || 5} Day Streak</span>
              </span>
            </div>

            {/* Proof Card Container */}
            <div
              className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-4 transition-transform duration-200 ${
                swipeDirection === "right"
                  ? "translate-x-12 rotate-6 opacity-0"
                  : swipeDirection === "left"
                  ? "-translate-x-12 -rotate-6 opacity-0"
                  : "translate-x-0 rotate-0 opacity-100"
              }`}
            >
              {/* AI Confidence Badge */}
              <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                <div className="flex items-center space-x-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>AI Auto-Audit Confidence</span>
                </div>
                <span className="font-mono text-amber-400">
                  {currentProof.ai_confidence_score
                    ? `${Math.round(currentProof.ai_confidence_score * 100)}%`
                    : "95%"}
                </span>
              </div>

              {/* Submitter Details */}
              <div className="mb-3 flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 font-bold text-amber-400">
                  {currentProof.user_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-slate-100">{currentProof.user_name}</h4>
                  <p className="text-xs text-slate-400">
                    Submitted {currentProof.submitted_at ? new Date(currentProof.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
                  </p>
                </div>
              </div>

              {/* Proof Image / Content Frame */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                {currentProof.proof_url.startsWith("http") || currentProof.proof_url.startsWith("/uploads") ? (
                  <img
                    src={currentProof.proof_url}
                    alt="Habit Proof"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm font-medium text-slate-300 italic">
                      "{currentProof.proof_url}"
                    </p>
                  </div>
                )}
              </div>

              {/* Audit Notes */}
              {currentProof.ai_audit_notes && (
                <p className="mt-3 text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                  <span className="font-semibold text-slate-300">Context:</span> {currentProof.ai_audit_notes}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-between space-x-4">
              <button
                onClick={() => handleVoteAction("down")}
                disabled={voting}
                className="flex-1 flex items-center justify-center space-x-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 font-bold text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
                <span>Challenge (←)</span>
              </button>

              <button
                onClick={() => handleVoteAction("up")}
                disabled={voting}
                className="flex-1 flex items-center justify-center space-x-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 font-bold text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Check className="h-5 w-5" />
                <span>Approve (→)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
