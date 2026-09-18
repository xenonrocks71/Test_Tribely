"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

export const ProofReplyModal: React.FC = () => {
  const { activeProofForReply, closeProofReply, proofComments, addProofComment, triggerHaptic } =
    useApp();

  const [commentInput, setCommentInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const targetKey = activeProofForReply?.id || "";
  const rawSubKey = activeProofForReply?.rawSubmissionId ? String(activeProofForReply.rawSubmissionId) : "";
  const currentComments = (targetKey && proofComments[targetKey]) ||
    (rawSubKey && proofComments[rawSubKey]) ||
    [];

  useEffect(() => {
    if (currentComments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentComments.length]);

  if (!activeProofForReply) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || isSubmitting) return;
    const textToSend = commentInput.trim();
    setCommentInput("");
    setIsSubmitting(true);
    try {
      await addProofComment(activeProofForReply.id, textToSend);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmojiChip = (emojiText: string) => {
    triggerHaptic([10]);
    setCommentInput(emojiText);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-full max-w-md bg-white dark:bg-[#1E1E1E] border-t border-[#E8EAED] dark:border-[#303134] rounded-t-3xl max-h-[85vh] flex flex-col justify-between shadow-2xl text-neutral-900 dark:text-white"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#E8EAED] dark:border-[#303134] flex items-center justify-between bg-white dark:bg-[#1E1E1E]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center font-semibold text-xs">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">
                  Proof Discussion
                </h3>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
                  {activeProofForReply.arenaTag} • {currentComments.length} {currentComments.length === 1 ? "reply" : "replies"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={closeProofReply}
              className="p-2 rounded-full text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Proof Context Snippet Header */}
          <div className="p-3 bg-[#F8F9FA] dark:bg-[#202124] border-b border-[#E8EAED] dark:border-[#303134] flex items-center gap-3">
            <div className="w-12 h-14 rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 border border-[#DADCE0] dark:border-[#3C4043] flex items-center justify-center">
              {activeProofForReply.mainImage ? (
                <img
                  src={activeProofForReply.mainImage}
                  alt={activeProofForReply.caption}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg">🔥</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                  {activeProofForReply.userName}
                </span>
                <span className="text-[10px] text-[#0F9D58] dark:text-[#81C995] font-medium">
                  {activeProofForReply.verifiedTime}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate mt-0.5">
                {activeProofForReply.caption}
              </p>
              {activeProofForReply.telemetry && (
                <div className="text-[9px] text-[#1A73E8] dark:text-[#8AB4F8] font-medium mt-1">
                  ⚡ {activeProofForReply.telemetry}
                </div>
              )}
            </div>
          </div>

          {/* Comments List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 no-scrollbar min-h-[160px] bg-white dark:bg-[#1E1E1E]">
            {currentComments.length === 0 ? (
              <div className="text-center py-8 space-y-1">
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">No replies yet.</p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Be the first to encourage this drop!</p>
              </div>
            ) : (
              currentComments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2.5">
                  <AvatarWithFallback
                    avatarUrl={comment.userAvatar}
                    name={comment.userName}
                    sizeClass="w-7 h-7"
                    textClass="text-[10px] font-bold"
                    className="border border-[#DADCE0] dark:border-[#3C4043] mt-0.5 shrink-0"
                  />
                  <div className="flex-1 bg-[#F1F3F4] dark:bg-[#282A2D] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-2.5 shadow-2xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold text-neutral-900 dark:text-white">
                        {comment.userName}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{comment.timeAgo}</span>
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-200 leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Quick Reaction Pills & Input Form */}
          <div className="p-3 border-t border-[#E8EAED] dark:border-[#303134] bg-white dark:bg-[#1E1E1E] space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {["🔥 Savage pace!", "💪 Respect the grind", "🎯 Locked in", "👏 Multiplier safe!"].map(
                (quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => handleEmojiChip(quick)}
                    className="px-3 py-1 rounded-full bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[11px] text-neutral-700 dark:text-neutral-300 font-medium hover:border-[#1A73E8] dark:hover:border-[#8AB4F8] hover:text-[#1A73E8] dark:hover:text-[#8AB4F8] hover:bg-[#E8F0FE]/40 dark:hover:bg-[#1A73E8]/10 transition whitespace-nowrap cursor-pointer shadow-2xs"
                  >
                    {quick}
                  </button>
                )
              )}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={`Reply to ${activeProofForReply.userName}'s drop...`}
                autoFocus
                className="flex-1 py-2 px-4 rounded-full bg-[#F1F3F4] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-xs text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-2 focus:ring-[#1A73E8]/15 transition"
              />

              <button
                type="submit"
                onClick={handleSend}
                disabled={!commentInput.trim() || isSubmitting}
                className="p-2 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                aria-label="Send reply"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
