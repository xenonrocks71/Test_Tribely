"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Zap,
  Users,
  Trophy,
  Camera,
  MessageCircle,
  Plus,
  Check,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  X,
  Key,
  Shield,
  Clock,
  Compass,
  Loader2,
  CheckCircle2,
  Lock,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { useApp, ProofPost } from "@/context/AppContext";
import { ArenaStoryTray } from "./ArenaStoryTray";
import { tribelyService, ApiArena } from "@/services/tribely.service";
import { iconForArena } from "@/app/utils/arenas";

// Adapt ApiArena -> TrendingTribe-like shape for the Explore grid
interface TrendingTribe {
  id: string;
  name: string;
  tag: string;
  category: string;
  emoji: string;
  coverImage: string;
  activeToday: number;
  stakeKudos: number;
  multiplierActive: boolean;
  multiplierValue: number;
  vaultPool: number;
  memberAvatars: string[];
  description: string;
  is_private: boolean;
  rawId: number;
  deadlineTime: string;
}

// Curated high-aesthetic Unsplash habit imagery tailored to real habits
function getArenaCoverImage(name: string, idx: number, rawId?: number): string {
  const n = name.toLowerCase();
  if (n.includes("5 am") || n.includes("morning") || n.includes("run")) {
    return "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80"; // morning runner
  }
  if (n.includes("leet") || n.includes("code") || n.includes("algorithm")) {
    return "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80"; // clean code setup
  }
  if (n.includes("deep work") || n.includes("focus") || n.includes("protocol")) {
    return "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80"; // focus workspace
  }
  if (n.includes("book") || n.includes("read") || n.includes("synthesis")) {
    return "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80"; // book & coffee
  }
  if (n.includes("meditat") || n.includes("mindful") || n.includes("zen")) {
    return "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80"; // meditation serene
  }
  if (n.includes("gym") || n.includes("strength") || n.includes("train") || n.includes("workout")) {
    return "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80"; // gym workout
  }
  if (n.includes("cold") || n.includes("shower") || n.includes("plunge")) {
    return "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80"; // clean water & nature
  }
  if (n.includes("step") || n.includes("walk") || n.includes("march")) {
    return "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80"; // forest trail walk
  }
  if (n.includes("eat") || n.includes("clean") || n.includes("nutrition") || n.includes("diet") || n.includes("junk")) {
    return "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80"; // fresh nutritious bowl
  }
  if (n.includes("sleep") || n.includes("detox") || n.includes("digital")) {
    return "https://images.unsplash.com/photo-1511295742362-92c96b124e52?auto=format&fit=crop&w=800&q=80"; // cozy night atmosphere
  }

  const defaultCovers = [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80",
  ];
  return defaultCovers[((rawId || idx) % defaultCovers.length)];
}

function mapApiToTrending(arena: ApiArena, idx: number): TrendingTribe {
  return {
    id: String(arena.id),
    rawId: arena.id,
    name: arena.name,
    tag: "#" + arena.name.replace(/\s+/g, "").slice(0, 18),
    category: arena.proof_type === "image" ? "Photo Proof" : arena.proof_type === "text" ? "Text Proof" : "Daily Habit",
    emoji: iconForArena(arena.name, arena.proof_type),
    coverImage: getArenaCoverImage(arena.name, idx, arena.id),
    activeToday: arena.member_count || 1,
    stakeKudos: Number(arena.penalty_amount || 50),
    multiplierActive: false,
    multiplierValue: 1.0,
    vaultPool: (arena.member_count || 1) * Number(arena.penalty_amount || 50),
    memberAvatars: [],
    description: arena.description || `Daily ${arena.proof_type || "habit"} accountability cohort.`,
    is_private: Boolean(arena.is_private),
    deadlineTime: arena.deadline_time || "23:59",
  };
}

const CATEGORY_CHIPS = [
  { id: "all", label: "🔥 All", match: () => true },
  { id: "fitness", label: "🏃 Fitness", match: (name: string) => /run|gym|workout|strength|step|athletics|plunge|shower/i.test(name) },
  { id: "code", label: "💻 Coding", match: (name: string) => /code|leet|dev|program|algorithm/i.test(name) },
  { id: "reading", label: "📚 Reading", match: (name: string) => /read|book|synthesis|study/i.test(name) },
  { id: "mindset", label: "🧘 Mindset", match: (name: string) => /meditat|mindful|detox|sleep|zen|focus/i.test(name) },
  { id: "nutrition", label: "🥗 Nutrition", match: (name: string) => /eat|clean|nutrition|junk|diet/i.test(name) },
];

interface ArenasViewProps {
  viewMode?: "all" | "search" | "enrolled";
}

export const ArenasView: React.FC<ArenasViewProps> = ({ viewMode = "all" }) => {
  const router = useRouter();
  const {
    arenas,
    user,
    openCamera,
    openDm,
    triggerHaptic,
    showToast,
    isLoadingArenas,
    refreshArenas,
    isArenaCompletedToday,
    joinSquad,
    feedPosts,
    openProofReply,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [joinedTribes, setJoinedTribes] = useState<Record<string, boolean>>({});
  const [discoveryArenas, setDiscoveryArenas] = useState<TrendingTribe[]>([]);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [joiningId, setJoiningId] = useState<number | null>(null);

  // Modals
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<"create" | "join">("create");
  const [selectedTrendingForSheet, setSelectedTrendingForSheet] = useState<TrendingTribe | null>(null);

  // Create Tribe Form State
  const [newTribeName, setNewTribeName] = useState("");
  const [newTribeCategory, setNewTribeCategory] = useState("Athletics");
  const [newTribeCutoff, setNewTribeCutoff] = useState("06:30 AM");
  const [newTribeStake, setNewTribeStake] = useState("50");

  // Join Code State
  const [inviteCode, setInviteCode] = useState("");

  // Pre-mark user's already-joined arenas
  useEffect(() => {
    const joined: Record<string, boolean> = {};
    arenas.forEach((a) => {
      if (a.rawId) joined[String(a.rawId)] = true;
      if (a.id) joined[String(a.id)] = true;
    });
    setJoinedTribes(joined);
  }, [arenas]);

  // Fetch real discovery arenas from database
  useEffect(() => {
    setIsLoadingDiscovery(true);
    tribelyService
      .fetchDiscoveryArenas()
      .then((list) => {
        if (list.length) {
          setDiscoveryArenas(list.map((a, i) => mapApiToTrending(a, i)));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingDiscovery(false));
  }, []);

  // Set of user's already joined squad IDs
  const joinedSquadIds = useMemo(() => {
    const set = new Set<string>();
    arenas.forEach((a) => {
      if (a.rawId) set.add(String(a.rawId));
      if (a.id) set.add(String(a.id));
    });
    return set;
  }, [arenas]);

  // Suggest ONLY real arenas the user has NOT joined earlier
  const unjoinedDiscovery = useMemo(() => {
    return discoveryArenas.filter((tribe) => {
      const rawIdStr = String(tribe.rawId || tribe.id);
      if (joinedSquadIds.has(rawIdStr)) return false;
      if (joinedTribes[rawIdStr]) return false;
      return true;
    });
  }, [discoveryArenas, joinedSquadIds, joinedTribes]);

  // Filtered by Search Query & Category Filter Chip
  const filteredSquads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const chip = CATEGORY_CHIPS.find((c) => c.id === selectedCategory) || CATEGORY_CHIPS[0];

    return unjoinedDiscovery.filter((tribe) => {
      const matchesChip = chip.match(tribe.name);
      if (!matchesChip) return false;

      if (!query) return true;
      return (
        tribe.name.toLowerCase().includes(query) ||
        tribe.tag.toLowerCase().includes(query) ||
        tribe.category.toLowerCase().includes(query) ||
        tribe.description.toLowerCase().includes(query)
      );
    });
  }, [unjoinedDiscovery, searchQuery, selectedCategory]);

  // Handle 1-tap join squad
  const handleJoinSquad = async (tribe: TrendingTribe) => {
    triggerHaptic([20, 35]);
    setJoiningId(tribe.rawId);

    // Optimistic update
    setJoinedTribes((prev) => ({ ...prev, [String(tribe.rawId)]: true }));
    showToast(`Joining ${tribe.name}...`, "info");

    try {
      const success = await joinSquad(tribe.rawId);
      if (success) {
        showToast(`🔥 Joined ${tribe.name}! Stake locked in.`, "success");
        await refreshArenas();
      } else {
        // Revert optimistic update
        setJoinedTribes((prev) => {
          const next = { ...prev };
          delete next[String(tribe.rawId)];
          return next;
        });
      }
    } catch {
      setJoinedTribes((prev) => {
        const next = { ...prev };
        delete next[String(tribe.rawId)];
        return next;
      });
      showToast("Could not join squad. Please try again.", "info");
    } finally {
      setJoiningId(null);
    }
  };

  const handleCreateTribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTribeName.trim()) return;
    triggerHaptic([30, 50]);

    const res = await tribelyService.createArena({
      name: newTribeName.trim(),
      description: `Daily ${newTribeCategory} accountability squad.`,
      penalty_amount: Number(newTribeStake) || 50,
      is_private: false,
      proof_type: "IMAGE",
      deadline_time: newTribeCutoff || "23:59",
    });

    if (res.success) {
      showToast(`🚀 Squad "${newTribeName.trim()}" created!`, "success");
      setIsActionCenterOpen(false);
      setNewTribeName("");
      await refreshArenas();
    } else {
      showToast(res.error || "Failed to create tribe", "info");
    }
  };

  const handleJoinByCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.length < 4) return;
    triggerHaptic([30, 50]);
    showToast(`🔑 Verifying code ${inviteCode.toUpperCase()}...`, "info");
    const result = await tribelyService.joinByInviteCode(inviteCode.trim().toUpperCase());
    if (result.success) {
      showToast(`✅ Joined squad successfully!`, "success");
      setIsActionCenterOpen(false);
      setInviteCode("");
      await refreshArenas();
    } else {
      showToast(result.message || "Invalid invite code.", "info");
    }
  };

  // Real proof posts for Instagram Explore 3-column photo grid
  const exploreProofs = useMemo(() => {
    return feedPosts.filter((p) => Boolean(p.mainImage));
  }, [feedPosts]);

  return (
    <div className="w-full pb-24 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white selection:bg-emerald-500/30 transition-colors">
      
      {/* ── TOP SEARCH & EXPLORE HEADER (Instagram Explore Style) ── */}
      {viewMode !== "enrolled" && (
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-900/80 px-3.5 pt-3 pb-2.5 space-y-2.5">
          {/* Edge-to-Edge Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center flex-1">
              <Search className="absolute left-3 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search squads, habits, tags..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 text-xs font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 p-0.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Action Button (+) */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => {
                triggerHaptic([15]);
                setIsActionCenterOpen(true);
              }}
              className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 transition cursor-pointer shrink-0"
              title="Create Tribe or Enter Squad Code"
              aria-label="Create Squad"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Instagram Explore Topic Chips Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {CATEGORY_CHIPS.map((chip) => {
              const isActive = selectedCategory === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic([10]);
                    setSelectedCategory(chip.id);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs scale-[1.02]"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-800/80"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LIVE SEARCH RESULTS VIEW (When query is active) ── */}
      {viewMode !== "enrolled" && searchQuery.trim().length > 0 && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Search Results ({filteredSquads.length})
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              Unjoined Cohorts
            </span>
          </div>

          {filteredSquads.length === 0 ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-400">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  No squads found
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
                  No unjoined squads match &quot;{searchQuery}&quot;. You can start your own squad or try another habit keyword.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActionCenterOpen(true)}
                className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition cursor-pointer shadow-xs"
              >
                + Create &quot;{searchQuery}&quot; Squad
              </button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl overflow-hidden bg-white dark:bg-[#121212] shadow-xs">
              {filteredSquads.map((tribe) => (
                <div
                  key={tribe.id}
                  onClick={() => setSelectedTrendingForSheet(tribe)}
                  className="p-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    {/* Circle Squad Avatar */}
                    <div className="relative w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                      <img
                        src={tribe.coverImage}
                        alt={tribe.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-neutral-900/80 text-[10px] flex items-center justify-center">
                        {tribe.emoji}
                      </span>
                    </div>

                    {/* Squad Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-neutral-900 dark:text-white truncate">
                          {tribe.name}
                        </h4>
                        <span className="text-[10px] text-emerald-500 font-black">✓</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {tribe.tag} • {tribe.activeToday} spotters • ⚡ {tribe.stakeKudos} Kudos
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                        ⏰ Cutoff {tribe.deadlineTime}
                      </p>
                    </div>
                  </div>

                  {/* 1-Tap Join Action */}
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    disabled={joiningId === tribe.rawId}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinSquad(tribe);
                    }}
                    className="px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
                  >
                    {joiningId === tribe.rawId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>Join</span>
                    )}
                  </motion.button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ENROLLED SQUADS (Tier 2: Shown when in enrolled tab or all view) ── */}
      {viewMode !== "search" && (
        <>
          <ArenaStoryTray />

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Your Squads
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  ({arenas.length} Active)
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 font-semibold">Weekly 7-Day Cycle</span>
            </div>

            {arenas.length === 0 ? (
              <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-gradient-to-b dark:from-neutral-900 dark:to-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                    You haven&apos;t joined any squads yet. Pick a habit below to lock in.
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
                    Join an accountability squad, put skin in the game, and build unstoppable daily streaks together.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("explore-squads-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition cursor-pointer shadow-xs"
                >
                  <span>Explore Public Squads</span>
                  <span>→</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {arenas.map((arena) => {
                  const isCompleted = isArenaCompletedToday(arena.id);
                  const potAmount = Math.max(350, (arena.memberCount || 1) * (arena.penaltyAmount || 50));

                  return (
                    <motion.div
                      key={arena.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        triggerHaptic([10]);
                        router.push(`/arenas/${arena.rawId || arena.id}`);
                      }}
                      className={`rounded-3xl overflow-hidden border transition-all duration-300 relative shadow-sm flex flex-col justify-between group cursor-pointer ${
                        isCompleted
                          ? "border-emerald-500/30 bg-neutral-50 dark:bg-gradient-to-b dark:from-neutral-900 dark:to-neutral-950"
                          : "border-amber-500/30 bg-neutral-50 dark:bg-gradient-to-b dark:from-neutral-900 dark:to-neutral-950"
                      }`}
                    >
                      {/* Banner Image with gradient */}
                      <div className="absolute inset-0 z-0 overflow-hidden">
                        {arena.bannerImage ? (
                          <img
                            src={arena.bannerImage}
                            alt={arena.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-700 brightness-[0.6] dark:brightness-[0.4]"
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-800 dark:bg-neutral-900" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-neutral-950/40" />
                      </div>

                      {/* Card Top Row */}
                      <div className="relative z-10 p-4 pb-2 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center text-xl shadow-inner backdrop-blur-md">
                            {arena.emoji}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-black text-white tracking-tight drop-shadow">
                                {arena.name}
                              </h3>
                              <span className="text-[10px] text-emerald-400 font-bold">✓</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-bold text-neutral-300">
                                {arena.tag}
                              </span>
                              <span
                                className={`px-2 py-0.2 rounded-full text-[9px] font-black ${
                                  isCompleted
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                }`}
                              >
                                {isCompleted ? "✓ Proof Locked In" : "⏳ Pending Proof"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/20 border border-amber-500/50 text-[11px] font-black text-amber-300 flex items-center gap-1.5 backdrop-blur-md shadow-xs">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          <span>{potAmount.toLocaleString()} Kudos Pool</span>
                        </span>
                      </div>

                      {/* Card Center: Progress */}
                      <div className="relative z-10 p-4 py-2 space-y-2.5">
                        <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/10">
                          <span className="text-[11px] text-amber-200/90 font-medium">
                            Split the Sunday midnight jackpot with 7/7 consistent spotters.
                          </span>
                          <span className="text-[10px] text-emerald-400 font-black shrink-0 ml-2">
                            Day 4/7
                          </span>
                        </div>

                        {/* Micro 7-Day Consistency Tracker */}
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-1.5">
                            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
                              const isPastCompleted = i < 3;
                              const isToday = i === 3;
                              return (
                                <div
                                  key={i}
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black transition ${
                                    isPastCompleted
                                      ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300"
                                      : isToday
                                      ? isCompleted
                                        ? "bg-emerald-500 text-neutral-950 shadow-xs"
                                        : "bg-amber-500/30 border border-amber-500/60 text-amber-300 animate-pulse"
                                      : "bg-neutral-800/60 border border-neutral-800 text-neutral-400"
                                  }`}
                                  title={`Day ${i + 1} (${day})`}
                                >
                                  {isPastCompleted || (isToday && isCompleted) ? "✓" : day}
                                </div>
                              );
                            })}
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-neutral-400 font-semibold">Cutoff:</span>
                            <span className="text-xs font-bold text-cyan-400 ml-1">
                              {arena.deadlineTime}
                            </span>
                          </div>
                        </div>

                        {/* Facepile + Active Spotters */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center -space-x-2">
                            {[0, 1, 2, 3].map((idx) => (
                              <div key={idx} className="relative">
                                <img
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${arena.id}_peer_${idx}`}
                                  alt="Peer"
                                  className={`w-7 h-7 rounded-full object-cover border-2 border-neutral-950 ${
                                    idx < 2 ? "" : "grayscale opacity-50"
                                  }`}
                                />
                                {idx < 2 && (
                                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-neutral-950" />
                                )}
                              </div>
                            ))}
                            <span className="pl-3 text-[10px] font-bold text-neutral-300">
                              {Math.max(1, arena.memberCount)} active spotters
                            </span>
                          </div>

                          <span className="text-[10px] font-mono text-neutral-300">
                            {arena.penaltyAmount || 50} Kudos Stake
                          </span>
                        </div>
                      </div>

                      {/* Card Bottom Action Bar */}
                      <div className="relative z-10 p-4 pt-2.5 border-t border-white/10 flex items-center justify-between bg-black/30 backdrop-blur-xs">
                        <span className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verified Accountability</span>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDm(arena.id, arena.name, arena.tag);
                            }}
                            className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-white/15 text-white transition cursor-pointer"
                            title="Open Squad Chat"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/arenas/${arena.rawId || arena.id}`);
                            }}
                            className="py-2 px-3.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 flex items-center gap-1.5 shadow-xs hover:brightness-110 transition cursor-pointer"
                          >
                            <span>Open Squad</span>
                            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── EXPLORE & SUGGESTED HABIT SQUADS (Instagram Explore Mode) ── */}
      {viewMode !== "enrolled" && searchQuery.trim().length === 0 && (
        <div id="explore-squads-section" className="space-y-6">
          
          {/* Section 1: Suggested Squads */}
          <div className="px-4 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <span>Suggested For You</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                    {filteredSquads.length} Available
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Habit cohorts from database you haven&apos;t joined yet
                </p>
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">
                Explore
              </span>
            </div>

            {isLoadingDiscovery ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="rounded-2xl h-60 bg-neutral-100 dark:bg-neutral-900 animate-pulse border border-neutral-200 dark:border-neutral-800"
                  />
                ))}
              </div>
            ) : filteredSquads.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  You&apos;ve joined all suggested squads in this category! 🎉
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Switch categories above or create a new custom tribe.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredSquads.map((tribe, idx) => (
                  <motion.div
                    key={tribe.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => setSelectedTrendingForSheet(tribe)}
                    className="rounded-2xl overflow-hidden bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800/80 relative flex flex-col justify-between shadow-xs hover:shadow-md transition group cursor-pointer"
                  >
                    {/* Visual Banner Photo */}
                    <div className="aspect-[16/11] relative overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                      <img
                        src={tribe.coverImage}
                        alt={tribe.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500 brightness-95 dark:brightness-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      {/* Top Badges */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 text-[9px] font-black text-white">
                        {tribe.emoji} {tribe.category}
                      </span>

                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/20 backdrop-blur-xs border border-emerald-500/40 text-[9px] font-black text-emerald-300 flex items-center gap-1">
                        <Flame className="w-2.5 h-2.5 fill-emerald-400" />
                        {tribe.activeToday}
                      </span>

                      {/* Title overlay on photo bottom */}
                      <div className="absolute bottom-2 inset-x-2 text-white">
                        <h4 className="text-xs font-black tracking-tight leading-tight line-clamp-1">
                          {tribe.name}
                        </h4>
                        <div className="text-[10px] text-amber-300 font-bold mt-0.5">
                          ⚡ {tribe.stakeKudos} Kudos Entry
                        </div>
                      </div>
                    </div>

                    {/* Card Body & Action */}
                    <div className="p-2.5 space-y-2 bg-white dark:bg-[#121212] flex-1 flex flex-col justify-between">
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed font-normal">
                        {tribe.description}
                      </p>

                      <div className="pt-1">
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          disabled={joiningId === tribe.rawId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJoinSquad(tribe);
                          }}
                          className="w-full py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 bg-neutral-900 text-white hover:bg-emerald-500 hover:text-neutral-950 dark:bg-white dark:text-neutral-950 dark:hover:bg-emerald-400 dark:hover:text-neutral-950 shadow-xs"
                        >
                          {joiningId === tribe.rawId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Join Squad</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Instagram 3-Column Community Proofs Grid */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center justify-between px-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Community Proof Drops</span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Explore verified habit proofs from active spotters
                </p>
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold">
                Live Feed
              </span>
            </div>

            {exploreProofs.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-neutral-400">
                Fresh proof drops will appear in the Explore grid once spotters submit today!
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 px-1">
                {exploreProofs.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => openProofReply(post)}
                    className="aspect-square relative overflow-hidden group cursor-pointer bg-neutral-100 dark:bg-neutral-900"
                  >
                    <img
                      src={post.mainImage}
                      alt={post.caption || "Community habit proof"}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Translucent Hover / Touch Indicator */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white">
                      <span className="flex items-center gap-1 text-xs font-black">
                        <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                        {post.reactions?.fire || 0}
                      </span>
                    </div>

                    {/* Top right icon */}
                    <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white">
                      <Camera className="w-3 h-3" />
                    </div>

                    {/* Bottom Tag snippet */}
                    <div className="absolute bottom-1 inset-x-1 px-1 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white truncate text-center">
                      {post.arenaTag}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 1: FLOATING ACTION CENTER (+ NEW ARENA / JOIN WITH KEY) ── */}
      <AnimatePresence>
        {isActionCenterOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl p-5 text-neutral-900 dark:text-white space-y-4 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-900">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">Tribe Action Center</h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      Start a peer cohort or unlock private squad
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActionCenterOpen(false)}
                  className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Switcher */}
              <div className="flex p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic([10]);
                    setActiveActionTab("create");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeActionTab === "create"
                      ? "bg-emerald-500 text-neutral-950 font-black shadow-xs"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  Create a Tribe
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic([10]);
                    setActiveActionTab("join");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeActionTab === "join"
                      ? "bg-emerald-500 text-neutral-950 font-black shadow-xs"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  Enter Invite Key
                </button>
              </div>

              {/* Option 1: Create a Tribe Form */}
              {activeActionTab === "create" ? (
                <form onSubmit={handleCreateTribeSubmit} className="space-y-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                      Tribe Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newTribeName}
                      onChange={(e) => setNewTribeName(e.target.value)}
                      placeholder="e.g. 5AM High-Output Builders"
                      className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                        Category
                      </label>
                      <select
                        value={newTribeCategory}
                        onChange={(e) => setNewTribeCategory(e.target.value)}
                        className="w-full mt-1 px-3 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none"
                      >
                        <option value="Athletics">🏃 Athletics</option>
                        <option value="Code & Build">💻 Code & Build</option>
                        <option value="Deep Focus">⚡ Deep Focus</option>
                        <option value="Mind & Body">🧘 Mind & Body</option>
                        <option value="Clean Nutrition">🥗 Clean Nutrition</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                        Daily Cutoff
                      </label>
                      <input
                        type="text"
                        value={newTribeCutoff}
                        onChange={(e) => setNewTribeCutoff(e.target.value)}
                        placeholder="06:30 AM"
                        className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                      7-Day Stake per Member (Kudos)
                    </label>
                    <input
                      type="number"
                      value={newTribeStake}
                      onChange={(e) => setNewTribeStake(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-2xl bg-emerald-500 text-neutral-950 font-black text-xs hover:brightness-110 shadow-md shadow-emerald-500/20 transition cursor-pointer mt-2"
                  >
                    Launch Tribe & Start Cohort 🚀
                  </button>
                </form>
              ) : (
                /* Option 2: Enter Invite Key */
                <form onSubmit={handleJoinByCodeSubmit} className="space-y-4 pt-1">
                  <div className="text-center py-2 space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
                      <Key className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                      Private Squad Key
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Enter the 6-digit access key shared by your accountability cohort.
                    </p>
                  </div>

                  <div>
                    <input
                      type="text"
                      maxLength={8}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="e.g. TRIB-88"
                      className="w-full text-center tracking-widest text-base font-black px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-emerald-600 dark:text-emerald-400 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={inviteCode.length < 4}
                    className="w-full py-3 rounded-2xl bg-emerald-500 text-neutral-950 font-black text-xs hover:brightness-110 disabled:opacity-40 shadow-md shadow-emerald-500/20 transition cursor-pointer"
                  >
                    Unlock Private Squad 🔑
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: TRENDING TRIBE CHALLENGE DETAILS BOTTOM SHEET ── */}
      <AnimatePresence>
        {selectedTrendingForSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl overflow-hidden text-neutral-900 dark:text-white shadow-2xl"
            >
              {/* Cover Header */}
              <div className="h-44 relative bg-black">
                <img
                  src={selectedTrendingForSheet.coverImage}
                  alt={selectedTrendingForSheet.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                <button
                  type="button"
                  onClick={() => setSelectedTrendingForSheet(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-3 left-4 right-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/60 text-[10px] font-black uppercase text-emerald-400 border border-emerald-500/30">
                    {selectedTrendingForSheet.tag}
                  </span>
                  <h3 className="text-base font-black text-white mt-1">
                    {selectedTrendingForSheet.name}
                  </h3>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-medium">
                  {selectedTrendingForSheet.description}
                </p>

                <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-2xl bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-center">
                  <div>
                    <div className="text-[10px] text-neutral-500 font-semibold">Active Spotters</div>
                    <div className="text-xs font-black text-neutral-900 dark:text-white flex items-center justify-center gap-1 mt-0.5">
                      <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                      {selectedTrendingForSheet.activeToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 font-semibold">Entry Stake</div>
                    <div className="text-xs font-black text-amber-500 dark:text-amber-400 mt-0.5">
                      ⚡ {selectedTrendingForSheet.stakeKudos}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 font-semibold">Daily Cutoff</div>
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {selectedTrendingForSheet.deadlineTime}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={joiningId === selectedTrendingForSheet.rawId}
                    onClick={() => {
                      handleJoinSquad(selectedTrendingForSheet);
                      setSelectedTrendingForSheet(null);
                    }}
                    className="w-full py-3 rounded-2xl bg-emerald-500 text-neutral-950 font-black text-xs hover:brightness-110 shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {joiningId === selectedTrendingForSheet.rawId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Stake {selectedTrendingForSheet.stakeKudos} Kudos & Join Challenge 🚀</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
