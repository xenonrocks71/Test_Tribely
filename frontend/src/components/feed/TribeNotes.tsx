"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Sparkles, Send, X, Flame, Zap, MessageCircle } from "lucide-react";
import { useApp, TribeNote } from "@/context/AppContext";

export const TribeNotes: React.FC = () => {
  const { notes, user, postDailyNote, sendTribeMessage, triggerHaptic, showToast } = useApp();

  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [activeReplyNote, setActiveReplyNote] = useState<TribeNote | null>(null);
  const [replyInput, setReplyInput] = useState("");

  const quickPrompts = [
    "Heading out for 5K in 10m 🏃",
    "Pre-workout kicked in 🔥",
    "Deep work: phone locked away 📵",
    "Struggling with focus today...",
    "1.5x Multiplier safe today ⚡",
  ];

  const handleSelfNoteClick = () => {
    triggerHaptic([15]);
    const selfNote = notes.find((n) => n.isSelf);
    setNoteInput(selfNote?.noteText || "");
    setIsCreateNoteOpen(true);
  };

  const handlePeerNoteClick = (note: TribeNote) => {
    triggerHaptic([15]);
    if (note.isSelf) {
      handleSelfNoteClick();
      return;
    }
    setActiveReplyNote(note);
    setReplyInput("");
  };

  const handlePublishNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    postDailyNote(noteInput);
    setIsCreateNoteOpen(false);
    setNoteInput("");
  };

  const handleSendNoteReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeReplyNote) return;
    triggerHaptic([20]);
    sendTribeMessage(`Replying to note "${activeReplyNote.noteText}": ${replyInput.trim()}`);
    showToast(`💬 Replied to @${activeReplyNote.userName}!`, "success");
    setActiveReplyNote(null);
    setReplyInput("");
  };

  return (
    <div className="w-full pt-3 pb-2 border-b border-neutral-900/60 bg-neutral-950/40">
      <div className="px-4 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
            Tribe Notes
          </span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-400">
            24h Ephemeral
          </span>
        </div>
        <span className="text-[10px] text-neutral-500 font-medium">Daily Mindset Bubbles</span>
      </div>

      {/* Horizontal Carousel of Notes with Floating Bubbles */}
      <div className="flex items-start gap-4 overflow-x-auto px-4 py-2 no-scrollbar">
        {notes.map((note) => {
          const isSelf = note.isSelf;

          return (
            <div
              key={note.id}
              className="flex flex-col items-center shrink-0 w-[84px] text-center cursor-pointer group"
              onClick={() => (isSelf ? handleSelfNoteClick() : handlePeerNoteClick(note))}
            >
              {/* Floating Instagram-Style Thought Bubble */}
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative mb-1.5 max-w-[88px] px-2.5 py-1.5 rounded-2xl text-[10px] leading-tight font-semibold shadow-lg backdrop-blur-md transition-all border ${
                  isSelf
                    ? "bg-neutral-900/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/40"
                    : "bg-neutral-900/90 border-neutral-800 text-neutral-200 shadow-black/40 hover:border-neutral-700"
                }`}
              >
                {/* Micro Thought Tail Pip */}
                <div
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b ${
                    isSelf
                      ? "bg-neutral-900 border-emerald-500/40"
                      : "bg-neutral-900 border-neutral-800"
                  }`}
                />

                <p className="line-clamp-2 break-words">
                  {note.noteText || (isSelf ? "+ Share thought" : "")}
                </p>
              </motion.div>

              {/* Avatar Anchor */}
              <div className="relative mt-0.5">
                <div
                  className={`w-14 h-14 rounded-full p-0.5 transition-all ${
                    isSelf
                      ? "bg-gradient-to-tr from-emerald-500 to-teal-400 p-[2px]"
                      : "bg-neutral-800 group-hover:bg-neutral-700"
                  }`}
                >
                  <img
                    src={note.userAvatar}
                    alt={note.userName}
                    className="w-full h-full rounded-full object-cover bg-neutral-950 border border-neutral-900"
                  />
                </div>

                {isSelf && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-neutral-950 flex items-center justify-center text-neutral-950 font-black shadow-md">
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Display Name */}
              <span className="text-[10px] font-medium text-neutral-400 truncate max-w-[76px] mt-1.5">
                {isSelf ? "Your Note" : note.userName.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── MODAL 1: SHARE TODAY'S MINDSET BOTTOM SHEET ── */}
      <AnimatePresence>
        {isCreateNoteOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-neutral-950 border-t border-neutral-800 rounded-t-3xl p-5 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">Share Daily Note</h3>
                    <p className="text-[10px] text-neutral-400">Disappears at midnight • 60 chars max</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateNoteOpen(false)}
                  className="p-1.5 rounded-full bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Note Preview Thought Bubble */}
              <div className="flex flex-col items-center py-2">
                <div className="relative px-4 py-2.5 rounded-2xl bg-neutral-900 border border-emerald-500/40 text-emerald-200 text-xs font-semibold shadow-lg shadow-emerald-950/40 max-w-[240px] text-center mb-2">
                  {noteInput.trim() || "What's on your mind today?"}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-neutral-900 border-r border-b border-emerald-500/40" />
                </div>
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500"
                />
              </div>

              {/* Input Form */}
              <form onSubmit={handlePublishNote} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    maxLength={60}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Share today's mindset or habit callout..."
                    autoFocus
                    className="w-full px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <span
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold ${
                      noteInput.length >= 50 ? "text-amber-400" : "text-neutral-500"
                    }`}
                  >
                    {60 - noteInput.length}
                  </span>
                </div>

                {/* Quick Prompts */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-neutral-400">Quick Prompts:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          triggerHaptic([10]);
                          setNoteInput(prompt);
                        }}
                        className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 text-[10px] text-neutral-300 font-medium transition cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateNoteOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-neutral-300 text-xs font-bold hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!noteInput.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-neutral-950 text-xs font-black hover:brightness-110 disabled:opacity-40 transition cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    Share Note ✨
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: PEER NOTE QUICK-REPLY DOCK ── */}
      <AnimatePresence>
        {activeReplyNote && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-neutral-950 border-t border-neutral-800 rounded-t-3xl p-5 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                <div className="flex items-center gap-2.5">
                  <img
                    src={activeReplyNote.userAvatar}
                    alt={activeReplyNote.userName}
                    className="w-8 h-8 rounded-full object-cover border border-neutral-800"
                  />
                  <div>
                    <h3 className="text-xs font-bold text-white">Reply to {activeReplyNote.userName}'s note</h3>
                    <p className="text-[10px] text-neutral-400">Will be sent directly to their arena DM</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveReplyNote(null)}
                  className="p-1.5 rounded-full bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Note Quote Card */}
              <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-2.5">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-emerald-400 uppercase">
                    {activeReplyNote.arenaTag || "Daily Note"}
                  </div>
                  <p className="text-xs text-neutral-200 mt-0.5 font-medium">
                    "{activeReplyNote.noteText}"
                  </p>
                </div>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendNoteReply} className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder={`Reply to ${activeReplyNote.userName}...`}
                    autoFocus
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!replyInput.trim()}
                    className="p-2.5 rounded-2xl bg-emerald-500 text-neutral-950 font-bold hover:brightness-110 disabled:opacity-40 transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Emoji Rebuttals */}
                <div className="flex items-center gap-2 pt-1">
                  {["🔥 Let's go!", "⚡ Right behind you", "👏 You got this", "💪 Respect"].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => {
                        triggerHaptic([10]);
                        setReplyInput(quick);
                      }}
                      className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 font-semibold hover:border-emerald-500/40 transition whitespace-nowrap cursor-pointer"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
