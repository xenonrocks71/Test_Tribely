"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Smile, Flame, Zap, Shield, Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext";

interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar: string;
  isSelf: boolean;
  message: string;
  timestamp: string;
}

export const DmDrawer: React.FC = () => {
  const { isDmDrawerOpen, closeDm, activeDmArena, user, triggerHaptic } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [inputVal, setInputVal] = useState("");

  if (!isDmDrawerOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    triggerHaptic([20]);

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderName: user.name,
      senderAvatar: user.avatar,
      isSelf: true,
      message: inputVal.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputVal("");
  };

  const handleQuickEmoji = (emoji: string) => {
    triggerHaptic([15]);
    setInputVal((prev) => prev + emoji);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-full max-w-md h-full bg-neutral-950 border-l border-neutral-900 flex flex-col justify-between"
        >
          {/* Header */}
          <div className="p-4 border-b border-neutral-900 flex items-center justify-between bg-neutral-950/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                💬
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {activeDmArena?.name || "Tribe Arena Chat"}
                </h3>
                <span className="text-xs text-emerald-400 font-medium">
                  {activeDmArena?.tag || "#Discipline"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={closeDm}
              className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 no-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xl">
                  💬
                </div>
                <p className="text-xs font-bold text-neutral-300">No messages in this habit squad yet</p>
                <p className="text-[11px] text-neutral-500 max-w-xs">
                  Be the first to say hello, discuss daily habits, and keep your squad accountable!
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${msg.isSelf ? "justify-end" : "justify-start"}`}
                >
                {!msg.isSelf && (
                  <img
                    src={msg.senderAvatar}
                    alt={msg.senderName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-neutral-800"
                  />
                )}

                <div
                  className={`max-w-[78%] rounded-2xl p-3 text-xs leading-relaxed ${
                    msg.isSelf
                      ? "bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950/40"
                      : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-none"
                  }`}
                >
                  {!msg.isSelf && (
                    <div className="text-[10px] font-bold text-emerald-400 mb-1">
                      {msg.senderName}
                    </div>
                  )}
                  <p>{msg.message}</p>
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      msg.isSelf ? "text-emerald-200" : "text-neutral-500"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            )))}
          </div>

          {/* Quick Reaction Pill Bar & Input Footer */}
          <div className="p-3 border-t border-neutral-900 bg-neutral-950 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {["🔥 Locked In", "⚡ Nudge", "🏃 Lacing up", "👏 Respect", "🎯 Focus"].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => {
                    triggerHaptic([10]);
                    setInputVal(quick);
                  }}
                  className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 font-semibold hover:border-emerald-500/40 transition whitespace-nowrap cursor-pointer"
                >
                  {quick}
                </button>
              ))}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Message your accountability tribe..."
                className="flex-1 py-2.5 px-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition"
              />

              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="p-2.5 rounded-2xl bg-emerald-500 text-neutral-950 disabled:opacity-40 disabled:cursor-not-allowed font-bold hover:brightness-110 active:scale-95 transition cursor-pointer"
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
