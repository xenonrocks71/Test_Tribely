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
  Loader2,
  Lock,
  Copy,
  Share2,
  Calendar,
} from "lucide-react";
import { useApp, HabitArena } from "@/context/AppContext";
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
  inviteCode: string;
}

// Curated high-aesthetic Unsplash habit imagery tailored to real habits
function getArenaCoverImage(name: string, idx: number, rawId?: number): string {
  const n = name.toLowerCase();
  if (n.includes("5 am") || n.includes("morning") || n.includes("run")) {
    return "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("leet") || n.includes("code") || n.includes("algorithm")) {
    return "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("deep work") || n.includes("focus") || n.includes("protocol")) {
    return "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("book") || n.includes("read") || n.includes("synthesis")) {
    return "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("meditat") || n.includes("mindful") || n.includes("zen")) {
    return "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("gym") || n.includes("strength") || n.includes("train") || n.includes("workout")) {
    return "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("cold") || n.includes("shower") || n.includes("plunge")) {
    return "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("step") || n.includes("walk") || n.includes("march")) {
    return "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("eat") || n.includes("clean") || n.includes("nutrition") || n.includes("diet") || n.includes("junk")) {
    return "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("sleep") || n.includes("detox") || n.includes("digital")) {
    return "https://images.unsplash.com/photo-1511295742362-92c96b124e52?auto=format&fit=crop&w=800&q=80";
  }

  const defaultCovers = [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80",
  ];
  return defaultCovers[(rawId || idx) % defaultCovers.length];
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
    description: arena.description || `Daily ${arena.proof_type || "habit"} accountability tribe.`,
    is_private: Boolean(arena.is_private),
    deadlineTime: arena.deadline_time || "23:59",
    inviteCode: arena.invite_code || `TRIB-${arena.id}`,
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

  // Modals & Detail Sheets
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<"create" | "join">("create");
  const [selectedTrendingForSheet, setSelectedTrendingForSheet] = useState<TrendingTribe | null>(null);
  const [selectedEnrolledTribe, setSelectedEnrolledTribe] = useState<HabitArena | null>(null);

  // Copied code feedback tracking
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create Tribe Form State
  const [newTribeName, setNewTribeName] = useState("");
  const [newTribeCategory, setNewTribeCategory] = useState("Athletics");
  const [newTribeCutoff, setNewTribeCutoff] = useState("10:00 PM");
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

  // Set of user's already joined tribe IDs
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
        tribe.description.toLowerCase().includes(query) ||
        tribe.inviteCode.toLowerCase().includes(query)
      );
    });
  }, [unjoinedDiscovery, searchQuery, selectedCategory]);

  // 1-Click Copy Tribe Join Code
  const handleCopyCode = (code: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!code) return;
    triggerHaptic([15, 25]);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    showToast(`📋 Tribe Code "${code}" copied to clipboard!`, "success");
    setTimeout(() => setCopiedCode(null), 2200);
  };

  // Handle 1-tap join squad
  const handleJoinSquad = async (tribe: TrendingTribe) => {
    triggerHaptic([20, 35]);
    setJoiningId(tribe.rawId);

    setJoinedTribes((prev) => ({ ...prev, [String(tribe.rawId)]: true }));
    showToast(`Joining ${tribe.name}...`, "info");

    try {
      const success = await joinSquad(tribe.rawId);
      if (success) {
        showToast(`🔥 Joined ${tribe.name}! Daily habit locked in.`, "success");
        await refreshArenas();
      } else {
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
      showToast("Could not join tribe. Please try again.", "info");
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
      description: `Daily ${newTribeCategory} accountability habit tribe.`,
      penalty_amount: Number(newTribeStake) || 50,
      is_private: false,
      proof_type: "IMAGE",
      deadline_time: newTribeCutoff || "10:00 PM",
    });

    if (res.success) {
      showToast(`🚀 Habit Tribe "${newTribeName.trim()}" launched!`, "success");
      setIsActionCenterOpen(false);
      setNewTribeName("");
      await refreshArenas();
    } else {
      showToast(res.error || "Failed to create Habit Tribe", "info");
    }
  };

  const handleJoinByCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) return;
    triggerHaptic([30, 50]);
    showToast(`🔑 Verifying Tribe Code ${cleanCode}...`, "info");
    const result = await tribelyService.joinByInviteCode(cleanCode);
    if (result.success) {
      showToast(result.message || `✅ Joined Habit Tribe successfully!`, "success");
      setIsActionCenterOpen(false);
      setInviteCode("");
      await refreshArenas();
      if (result.arena_id) {
        router.push(`/arenas/${result.arena_id}`);
      }
    } else {
      showToast(result.message || "Invalid Tribe Code.", "info");
    }
  };

  // Real proof posts for Instagram Explore 3-column photo grid
  const exploreProofs = useMemo(() => {
    return feedPosts.filter((p) => Boolean(p.mainImage));
  }, [feedPosts]);

  return (
    <div className="w-full pb-28 bg-neutral-50/70 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 selection:bg-emerald-500/30 transition-colors">
      
      {/* ── TOP SEARCH & HABIT TRIBES HEADER ── */}
      {viewMode !== "enrolled" && (
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800/80 px-3.5 pt-3 pb-2.5 space-y-2.5">
          {/* Search Bar + Create Action Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center flex-1">
              <Search className="absolute left-3 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Habit Tribes, habits, tags, codes..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition"
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
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1 text-xs"
              title="Create Habit Tribe or Enter Joining Code"
              aria-label="Create Habit Tribe"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline font-black pr-1">New</span>
            </motion.button>
          </div>

          {/* Category Chips Carousel */}
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
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800"
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
              Available Habit Tribes
            </span>
          </div>

          {filteredSquads.length === 0 ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center space-y-3 bg-white dark:bg-neutral-900/60 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  No Habit Tribes found
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
                  No unjoined tribes match &quot;{searchQuery}&quot;. You can launch your own Habit Tribe with this name.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewTribeName(searchQuery);
                  setIsActionCenterOpen(true);
                }}
                className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition cursor-pointer shadow-xs"
              >
                + Create &quot;{searchQuery}&quot; Tribe
              </button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-xs">
              {filteredSquads.map((tribe) => (
                <div
                  key={tribe.id}
                  onClick={() => setSelectedTrendingForSheet(tribe)}
                  className="p-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="relative w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                      <img
                        src={tribe.coverImage}
                        alt={tribe.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-neutral-900/80 text-[10px] flex items-center justify-center text-white">
                        {tribe.emoji}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-neutral-900 dark:text-white truncate">
                          {tribe.name}
                        </h4>
                        <span className="text-[10px] text-emerald-500 font-black">✓</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {tribe.tag} • {tribe.activeToday} spotters
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(tribe.inviteCode, e)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] font-mono text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700/60 transition"
                          title="Copy Joining Code"
                        >
                          <Key className="w-2.5 h-2.5 text-amber-500" />
                          <span>Code: {tribe.inviteCode}</span>
                          {copiedCode === tribe.inviteCode ? (
                            <Check className="w-2.5 h-2.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-neutral-400" />
                          )}
                        </button>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                          ⏰ Cutoff {tribe.deadlineTime}
                        </span>
                      </div>
                    </div>
                  </div>

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

      {/* ── ENROLLED HABIT TRIBES (MINIMAL, CLEAN CARDS) ── */}
      {viewMode !== "search" && (
        <>
          <ArenaStoryTray />

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Your Habit Tribes
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  ({arenas.length} Active)
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">
                Daily Accountability
              </span>
            </div>

            {arenas.length === 0 ? (
              <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                    You haven&apos;t joined any Habit Tribes yet.
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
                    Join an accountability tribe, submit daily proofs, and build bulletproof streaks with your peers.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("explore-squads-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition cursor-pointer shadow-xs"
                  >
                    <span>Explore Tribes</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionTab("join");
                      setIsActionCenterOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold transition cursor-pointer border border-neutral-200 dark:border-neutral-700"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>Join with Code</span>
                  </button>
                </div>
              </div>
            ) : (
              /* MINIMAL, UNCLUTTERED HABIT TRIBE CARDS */
              <div className="space-y-3">
                {arenas.map((arena) => {
                  const isCompleted = isArenaCompletedToday(arena.id);
                  const code = arena.inviteCode || `TRIB-${arena.rawId || arena.id}`;
                  const isCopied = copiedCode === code;

                  return (
                    <motion.div
                      key={arena.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        triggerHaptic([10]);
                        setSelectedEnrolledTribe(arena);
                      }}
                      className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer group relative overflow-hidden border shadow-xs hover:shadow-md ${
                        isCompleted
                          ? "bg-white dark:bg-neutral-900 border-emerald-500/30 hover:border-emerald-500/60 dark:border-emerald-500/20 dark:hover:border-emerald-500/40"
                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-amber-500/50 dark:hover:border-amber-500/40"
                      }`}
                    >
                      {/* Top row: Icon + Name + Tag + Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-center text-xl shrink-0 shadow-xs">
                            {arena.emoji}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-black text-neutral-900 dark:text-white tracking-tight truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                                {arena.name}
                              </h3>
                              {arena.isPrivate ? (
                                <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                              ) : (
                                <span className="text-[11px] text-emerald-500 font-black shrink-0">✓</span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate mt-0.5">
                              {arena.tag} • {arena.memberCount || 1} spotters
                            </p>
                          </div>
                        </div>

                        {/* Minimal Status Badge */}
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center gap-1 transition ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                          }`}
                        >
                          {isCompleted ? (
                            <>
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>Completed</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Due {arena.deadlineTime}</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Bottom row: Joining Code Pill + Tap to View Details indicator */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                        {/* Joining Code Badge with 1-click Copy */}
                        <div
                          onClick={(e) => handleCopyCode(code, e)}
                          title="Click to copy Tribe Join Code"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700/80 border border-neutral-200 dark:border-neutral-700/60 text-[11px] font-mono font-bold text-neutral-700 dark:text-neutral-200 transition cursor-pointer"
                        >
                          <Key className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="tracking-wide">Code: {code}</span>
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-500 ml-0.5 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-white ml-0.5 shrink-0" />
                          )}
                        </div>

                        {/* Minimal view details arrow */}
                        <div className="flex items-center gap-1 text-xs font-bold text-neutral-400 dark:text-neutral-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          <span>Details</span>
                          <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
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

      {/* ── DISCOVER HABIT TRIBES (Explore Section) ── */}
      {viewMode !== "enrolled" && searchQuery.trim().length === 0 && (
        <div id="explore-squads-section" className="space-y-6">
          
          {/* Section 1: Suggested Habit Tribes */}
          <div className="px-4 pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <span>Discover Habit Tribes</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                    {filteredSquads.length} Available
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Habit cohorts you can join or unlock with code
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
                    className="rounded-2xl h-52 bg-neutral-100 dark:bg-neutral-900 animate-pulse border border-neutral-200 dark:border-neutral-800"
                  />
                ))}
              </div>
            ) : filteredSquads.length === 0 ? (
              <div className="py-10 px-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  You&apos;ve joined all suggested Habit Tribes in this category! 🎉
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Switch categories above or launch a custom Habit Tribe.
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
                    className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 relative flex flex-col justify-between shadow-xs hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition group cursor-pointer"
                  >
                    {/* Visual Banner Photo */}
                    <div className="aspect-[16/11] relative overflow-hidden bg-neutral-100 dark:bg-neutral-800">
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
                        <Users className="w-2.5 h-2.5" />
                        {tribe.activeToday}
                      </span>

                      {/* Title overlay on photo bottom */}
                      <div className="absolute bottom-2 inset-x-2 text-white">
                        <h4 className="text-xs font-black tracking-tight leading-tight line-clamp-1">
                          {tribe.name}
                        </h4>
                        <div className="text-[10px] text-amber-300 font-bold mt-0.5">
                          ⏰ Cutoff {tribe.deadlineTime}
                        </div>
                      </div>
                    </div>

                    {/* Card Body with Join Code & Join CTA */}
                    <div className="p-2.5 space-y-2 bg-white dark:bg-neutral-900 flex-1 flex flex-col justify-between">
                      {/* Joining Code Badge */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(tribe.inviteCode, e)}
                        className="w-full flex items-center justify-between px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700/80 border border-neutral-200 dark:border-neutral-700/60 text-[10px] font-mono font-bold text-neutral-700 dark:text-neutral-200 transition text-left"
                        title="Copy Tribe Code"
                      >
                        <span className="flex items-center gap-1 truncate">
                          <Key className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                          <span className="truncate">{tribe.inviteCode}</span>
                        </span>
                        {copiedCode === tribe.inviteCode ? (
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                        )}
                      </button>

                      <div className="pt-0.5">
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
                              <span>Join Tribe</span>
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

          {/* Section 2: Instagram 3-Column Community Proof Drops */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center justify-between px-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Community Proof Drops</span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Verified proofs from active habit tribe members
                </p>
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold">
                Live Feed
              </span>
            </div>

            {exploreProofs.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-neutral-400">
                Fresh proof drops will appear here once tribe members submit today!
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

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white">
                      <span className="flex items-center gap-1 text-xs font-black">
                        <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                        {post.reactions?.fire || 0}
                      </span>
                    </div>

                    <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white">
                      <Camera className="w-3 h-3" />
                    </div>

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

      {/* ── MODAL 1: ENROLLED HABIT TRIBE FULL DETAILS SHEET ── */}
      <AnimatePresence>
        {selectedEnrolledTribe && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl overflow-hidden text-neutral-900 dark:text-white shadow-2xl max-h-[90vh] flex flex-col"
            >
              {/* Cover Banner Header */}
              <div className="h-44 relative bg-black shrink-0">
                {selectedEnrolledTribe.bannerImage ? (
                  <img
                    src={selectedEnrolledTribe.bannerImage}
                    alt={selectedEnrolledTribe.name}
                    className="w-full h-full object-cover brightness-[0.7]"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                <button
                  type="button"
                  onClick={() => setSelectedEnrolledTribe(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center text-base">
                      {selectedEnrolledTribe.emoji}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-black/60 text-[10px] font-black uppercase text-emerald-400 border border-emerald-500/30">
                      {selectedEnrolledTribe.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1">
                    {selectedEnrolledTribe.name}
                  </h3>
                </div>
              </div>

              {/* Sheet Body: All Detailed Data */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Description */}
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-medium">
                  {selectedEnrolledTribe.description || "Daily peer accountability cohort for building consistency."}
                </p>

                {/* Joining Code Sharing Box */}
                <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Key className="w-3 h-3 text-amber-500" />
                      <span>Tribe Joining Code</span>
                    </span>
                    <div className="text-sm font-mono font-black text-neutral-900 dark:text-white">
                      {selectedEnrolledTribe.inviteCode || `TRIB-${selectedEnrolledTribe.rawId || selectedEnrolledTribe.id}`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(selectedEnrolledTribe.inviteCode || `TRIB-${selectedEnrolledTribe.rawId || selectedEnrolledTribe.id}`)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedCode === (selectedEnrolledTribe.inviteCode || `TRIB-${selectedEnrolledTribe.rawId || selectedEnrolledTribe.id}`) ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 7-Day Consistency Track */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>7-Day Consistency Track</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {isArenaCompletedToday(selectedEnrolledTribe.id) ? "✓ Completed Today" : "Pending Today"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
                      const isCompleted = isArenaCompletedToday(selectedEnrolledTribe.id);
                      const isPastCompleted = i < 3;
                      const isToday = i === 3;
                      return (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition ${
                            isPastCompleted
                              ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 dark:text-emerald-300"
                              : isToday
                              ? isCompleted
                                ? "bg-emerald-500 text-neutral-950 font-black shadow-xs"
                                : "bg-amber-500/20 border border-amber-500/60 text-amber-600 dark:text-amber-300 animate-pulse"
                              : "bg-neutral-200/60 dark:bg-neutral-800/60 border border-neutral-300/60 dark:border-neutral-800 text-neutral-400"
                          }`}
                          title={`Day ${i + 1} (${day})`}
                        >
                          {isPastCompleted || (isToday && isCompleted) ? "✓" : day}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tribe Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                  <div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">Spotters</div>
                    <div className="text-xs font-black text-neutral-900 dark:text-white flex items-center justify-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-emerald-500" />
                      {selectedEnrolledTribe.memberCount || 1}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">Stake</div>
                    <div className="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      ⚡ {selectedEnrolledTribe.penaltyAmount || 50} Kudos
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">Daily Cutoff</div>
                    <div className="text-xs font-black text-neutral-900 dark:text-white mt-0.5">
                      {selectedEnrolledTribe.deadlineTime}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 space-y-2">
                  {!isArenaCompletedToday(selectedEnrolledTribe.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEnrolledTribe(null);
                        openCamera();
                      }}
                      className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Submit Today&apos;s Proof Now</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const tribe = selectedEnrolledTribe;
                        setSelectedEnrolledTribe(null);
                        openDm(tribe.id, tribe.name, tribe.tag);
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white font-bold text-xs border border-neutral-200 dark:border-neutral-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-500" />
                      <span>Tribe Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const tribe = selectedEnrolledTribe;
                        setSelectedEnrolledTribe(null);
                        router.push(`/arenas/${tribe.rawId || tribe.id}`);
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-neutral-900 text-white hover:bg-black dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Enter Chamber</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: DISCOVERED HABIT TRIBE CHALLENGE DETAILS SHEET ── */}
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
                  className="w-full h-full object-cover brightness-[0.7]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                <button
                  type="button"
                  onClick={() => setSelectedTrendingForSheet(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center text-base">
                      {selectedTrendingForSheet.emoji}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-black/60 text-[10px] font-black uppercase text-emerald-400 border border-emerald-500/30">
                      {selectedTrendingForSheet.tag}
                    </span>
                  </div>
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

                {/* Joining Code Sharing Box */}
                <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Key className="w-3 h-3 text-amber-500" />
                      <span>Tribe Joining Code</span>
                    </span>
                    <div className="text-sm font-mono font-black text-neutral-900 dark:text-white">
                      {selectedTrendingForSheet.inviteCode}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(selectedTrendingForSheet.inviteCode)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedCode === selectedTrendingForSheet.inviteCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                  <div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">Active Spotters</div>
                    <div className="text-xs font-black text-neutral-900 dark:text-white flex items-center justify-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-emerald-500" />
                      {selectedTrendingForSheet.activeToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">Entry Stake</div>
                    <div className="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      ⚡ {selectedTrendingForSheet.stakeKudos}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">Daily Cutoff</div>
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
                      <span>Join Habit Tribe & Lock In 🚀</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: FLOATING ACTION CENTER (CREATE TRIBE / ENTER CODE) ── */}
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
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">Habit Tribe Hub</h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      Launch a new peer tribe or enter a joining code
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
                  Create Habit Tribe
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
                  Join with Code
                </button>
              </div>

              {/* Option 1: Create a Habit Tribe Form */}
              {activeActionTab === "create" ? (
                <form onSubmit={handleCreateTribeSubmit} className="space-y-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                      Habit Tribe Name
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
                        placeholder="10:00 PM"
                        className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                      Commitment Stake (Kudos)
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
                    Launch Habit Tribe & Generate Code 🚀
                  </button>
                </form>
              ) : (
                /* Option 2: Enter Joining Code */
                <form onSubmit={handleJoinByCodeSubmit} className="space-y-4 pt-1">
                  <div className="text-center py-2 space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
                      <Key className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                      Enter Tribe Joining Code
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Enter the 6-character code shared by your habit group to join directly.
                    </p>
                  </div>

                  <div>
                    <input
                      type="text"
                      maxLength={12}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="e.g. GYM-99"
                      className="w-full text-center tracking-widest text-base font-black px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-emerald-600 dark:text-emerald-400 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!inviteCode.trim()}
                    className="w-full py-3 rounded-2xl bg-emerald-500 text-neutral-950 font-black text-xs hover:brightness-110 disabled:opacity-40 shadow-md shadow-emerald-500/20 transition cursor-pointer"
                  >
                    Unlock & Join Habit Tribe 🔑
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
