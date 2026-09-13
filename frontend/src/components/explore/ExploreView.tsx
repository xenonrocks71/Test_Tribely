"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  Flame,
  Zap,
  Lock,
  Plus,
  Check,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useApp, HabitArena } from "@/context/AppContext";

export const ExploreView: React.FC = () => {
  const { arenas, openDm, triggerHaptic, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [joinedArenas, setJoinedArenas] = useState<Record<string, boolean>>({
    arena_1: true,
    arena_2: true,
  });

  const categories = [
    { id: "all", label: "All Tribes" },
    { id: "fitness", label: "Athletics 🏃" },
    { id: "tech", label: "Code & Build 💻" },
    { id: "focus", label: "Deep Work ⚡" },
    { id: "health", label: "Mind & Body 🧘" },
  ];

  const filteredArenas = arenas.filter((arena) => {
    const matchesSearch =
      arena.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      arena.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      arena.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleToggleJoin = (arena: HabitArena) => {
    triggerHaptic([20, 30]);
    const isJoined = joinedArenas[arena.id];
    setJoinedArenas((prev) => ({
      ...prev,
      [arena.id]: !isJoined,
    }));

    if (!isJoined) {
      showToast(`🎉 Joined ${arena.name}! Daily deadline: ${arena.deadlineTime}`, "success");
    } else {
      showToast(`Left ${arena.name}.`, "info");
    }
  };

  return (
    <div className="w-full pb-24 text-white">
      {/* Top Search & Filter Bar */}
      <div className="p-4 border-b border-neutral-900 sticky top-0 bg-neutral-950/95 backdrop-blur z-20 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search high-stakes habit arenas..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setSelectedCategory(cat.id);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-emerald-500 text-neutral-950 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Arena Banner */}
      <div className="p-4">
        <div className="relative rounded-3xl overflow-hidden p-5 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-neutral-950 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Featured Arena
            </span>
            <span className="text-[11px] font-bold text-neutral-400">🔥 98% Consistency</span>
          </div>

          <div className="mt-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>🌅</span> 5 AM Iron Will Cohort
            </h3>
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
              No snooze buttons. GPS telemetry or camera proof required before 05:30 AM local time.
            </p>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-neutral-800/80 text-xs">
            <div>
              <div className="text-neutral-400 text-[10px]">Active Stake Pool</div>
              <div className="font-black text-amber-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                12,500 Kudos
              </div>
            </div>
            <div>
              <div className="text-neutral-400 text-[10px]">Tribe Multiplier</div>
              <div className="font-black text-emerald-400">1.5x Active</div>
            </div>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => handleToggleJoin(arenas[0])}
                className={`py-1.5 px-4 rounded-xl text-xs font-black transition cursor-pointer ${
                  joinedArenas[arenas[0].id]
                    ? "bg-neutral-800 text-emerald-400 border border-emerald-500/30"
                    : "bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20 hover:brightness-110"
                }`}
              >
                {joinedArenas[arenas[0].id] ? "Joined ✓" : "Join Tribe"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Arenas List */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-400 px-1">
          <span>Active Accountability Arenas</span>
          <span>{filteredArenas.length} Available</span>
        </div>

        {filteredArenas.map((arena, idx) => {
          const isJoined = !!joinedArenas[arena.id];

          return (
            <motion.div
              key={arena.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800/80 hover:border-neutral-700/80 transition space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xl shrink-0">
                    {arena.emoji}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">{arena.name}</h4>
                    <span className="text-xs text-emerald-400 font-semibold">{arena.tag}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleJoin(arena)}
                  className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    isJoined
                      ? "bg-neutral-800 text-emerald-400 border border-emerald-500/30"
                      : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-neutral-950"
                  }`}
                >
                  {isJoined ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Joined</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Join</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed">{arena.description}</p>

              {/* Arena Metadata Grid */}
              <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-center">
                <div>
                  <div className="text-[10px] text-neutral-500">Members</div>
                  <div className="text-xs font-bold text-neutral-200 flex items-center justify-center gap-1">
                    <Users className="w-3 h-3 text-neutral-400" />
                    {arena.memberCount}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">Daily Stake</div>
                  <div className="text-xs font-bold text-amber-400">⚡ {arena.penaltyAmount} Stake</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">Deadline</div>
                  <div className="text-xs font-bold text-cyan-400">{arena.deadlineTime}</div>
                </div>
              </div>

              {/* Action Link to Arena DMs */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-neutral-500 font-medium">
                  Vault Pool: {arena.vaultPoolKudos} Kudos
                </span>

                <button
                  type="button"
                  onClick={() => openDm(arena.id, arena.name, arena.tag)}
                  className="text-xs text-neutral-300 hover:text-white font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Open Arena Chat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
