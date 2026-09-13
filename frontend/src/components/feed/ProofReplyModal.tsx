"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";

export const ProofReplyModal: React.FC = () => {
  const { activeProofForReply, closeProofReply, proofComments, addProofComment, triggerHaptic } =
    useApp();

  const [commentInput, setCommentInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const currentComments = activeProofForReply ? proofComments[activeProofForReply.id] || [] : [];

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
    setCommentInput((prev) => (prev ? `${prev} ${emojiText}` : emojiText));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl max-h-[85vh] flex flex-col justify-between shadow-2xl text-neutral-900 dark:text-white"
        >
          {/* Header */}
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                  Proof Discussion Thread
                </h3>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                  {activeProofForReply.arenaTag} • {currentComments.length} {currentComments.length === 1 ? "reply" : "replies"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={closeProofReply}
              className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Proof Context Snippet Header */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-900/40 border-b border-neutral-100 dark:border-neutral-900 flex items-center gap-3">
            <div className="w-12 h-14 rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
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
                <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                  {activeProofForReply.userName}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {activeProofForReply.verifiedTime}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 truncate mt-0.5">
                {activeProofForReply.caption}
              </p>
              {activeProofForReply.telemetry && (
                <div className="text-[9px] text-cyan-600 dark:text-cyan-400 font-bold mt-1">
                  ⚡ {activeProofForReply.telemetry}
                </div>
              )}
            </div>
          </div>

          {/* Comments List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 no-scrollbar min-h-[160px]">
            {currentComments.length === 0 ? (
              <div className="text-center py-8 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">No replies yet.</p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-600">Be the first to encourage this drop!</p>
              </div>
            ) : (
              currentComments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2.5">
                  <img
                    src={comment.userAvatar}
                    alt={comment.userName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-800 mt-0.5"
                  />
                  <div className="flex-1 bg-neutral-100 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl p-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-bold text-neutral-900 dark:text-white">
                        {comment.userName}
                      </span>
                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500">{comment.timeAgo}</span>
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-200 leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Quick Reaction Pills & Input Form */}
          <div className="p-3 border-t border-neutral-100 dark:border-neutral-900 bg-white dark:bg-neutral-950 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {["🔥 Savage pace!", "💪 Respect the grind", "🎯 Locked in", "👏 Multiplier safe!"].map(
                (quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => handleEmojiChip(quick)}
                    className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-700 dark:text-neutral-300 font-semibold hover:border-emerald-500/40 transition whitespace-nowrap cursor-pointer"
                  >
                    {quick}
                  </button>
                )
              )}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={`Reply to ${activeProofForReply.userName}'s drop...`}
                autoFocus
                className="flex-1 py-2.5 px-4 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
              />

              <button
                type="submit"
                disabled={!commentInput.trim() || isSubmitting}
                className="p-2.5 rounded-2xl bg-emerald-500 text-neutral-950 font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition cursor-pointer"
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
