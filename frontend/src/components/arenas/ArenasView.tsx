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
  Globe,
  Hash,
  ChevronRight,
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
  { id: "all", label: "All", emoji: "🔥" },
  { id: "fitness", label: "Fitness", emoji: "🏃", match: (name: string) => /run|gym|workout|strength|step|athletics|plunge|shower/i.test(name) },
  { id: "code", label: "Coding", emoji: "💻", match: (name: string) => /code|leet|dev|program|algorithm/i.test(name) },
  { id: "reading", label: "Reading", emoji: "📚", match: (name: string) => /read|book|synthesis|study/i.test(name) },
  { id: "mindset", label: "Mindset", emoji: "🧘", match: (name: string) => /meditat|mindful|detox|sleep|zen|focus/i.test(name) },
  { id: "nutrition", label: "Nutrition", emoji: "🥗", match: (name: string) => /eat|clean|nutrition|junk|diet/i.test(name) },
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
  const [newTribeIcon, setNewTribeIcon] = useState("🏃");
  const [newTribeCategory, setNewTribeCategory] = useState("Athletics");
  const [newTribeDescription, setNewTribeDescription] = useState("");
  const [newTribeProofType, setNewTribeProofType] = useState<"image" | "link" | "text">("image");
  const [newTribeCutoff, setNewTribeCutoff] = useState("10:00 PM");
  const [newTribeStake, setNewTribeStake] = useState("50");
  const [newTribeIsPrivate, setNewTribeIsPrivate] = useState(false);
  const [isSubmittingTribe, setIsSubmittingTribe] = useState(false);

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

  // Suggest ONLY real arenas the user has NOT joined
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
      if (chip.match && !chip.match(tribe.name)) return false;
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
    showToast(`Tribe code "${code}" copied!`, "success");
    setTimeout(() => setCopiedCode(null), 2200);
  };

  // Handle 1-tap join squad
  const handleJoinSquad = async (tribe: TrendingTribe) => {
    triggerHaptic([20, 35]);
    setJoiningId(tribe.rawId);
    setJoinedTribes((prev) => ({ ...prev, [String(tribe.rawId)]: true }));
    showToast(`Joining ${tribe.name}…`, "info");

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
    setIsSubmittingTribe(true);

    const effectiveDesc = newTribeDescription.trim() || `Daily ${newTribeCategory} accountability habit tribe.`;

    const res = await tribelyService.createArena({
      name: newTribeName.trim(),
      category: newTribeCategory,
      description: effectiveDesc,
      penalty_amount: Number(newTribeStake) || 50,
      is_private: newTribeIsPrivate,
      proof_type: newTribeProofType,
      deadline_time: newTribeCutoff || "10:00 PM",
      icon_url: newTribeIcon || "⚡",
    });

    setIsSubmittingTribe(false);

    if (res.success) {
      showToast(`🚀 Habit Tribe "${newTribeName.trim()}" launched!`, "success");
      setIsActionCenterOpen(false);
      setNewTribeName("");
      setNewTribeDescription("");
      setNewTribeCategory("Athletics");
      setNewTribeIcon("🏃");
      setNewTribeProofType("image");
      setNewTribeCutoff("10:00 PM");
      setNewTribeStake("50");
      setNewTribeIsPrivate(false);
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
    showToast(`🔑 Verifying code ${cleanCode}…`, "info");
    const result = await tribelyService.joinByInviteCode(cleanCode);
    if (result.success) {
      showToast(result.message || `✅ Joined successfully!`, "success");
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

  // Real proof posts for 3-column photo grid
  const exploreProofs = useMemo(() => {
    return feedPosts.filter((p) => Boolean(p.mainImage));
  }, [feedPosts]);

  const isSearchActive = viewMode !== "enrolled" && searchQuery.trim().length > 0;

  return (
    <div className="w-full pb-28 bg-transparent text-neutral-900 dark:text-white transition-colors">

      {/* ── SEARCH & DISCOVERY BAR (Non-sticky: scrolls naturally with page) ── */}
      {viewMode !== "enrolled" && (
        <div className="px-4 mb-4">
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xs transition-colors">
            {/* Page Title + Action Button */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold text-neutral-900 dark:text-white tracking-tight">
                  Discover Tribes
                </h1>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
                  Find and join accountability squads
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => { triggerHaptic([15]); setIsActionCenterOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white dark:bg-[#8AB4F8] dark:text-[#202124] dark:hover:bg-[#A8C7FA] text-xs font-medium transition shadow-xs cursor-pointer"
                aria-label="Create or Join Tribe"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Tribe</span>
              </motion.button>
            </div>

            {/* Search Bar (Google Pill Style) */}
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tribes, habits, codes…"
                className="w-full pl-9 pr-9 py-2.5 rounded-full bg-[#F1F3F4] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/15 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Chips (Google Filter Chips) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
              {CATEGORY_CHIPS.map((chip) => {
                const isActive = selectedCategory === chip.id;
                return (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    key={chip.id}
                    type="button"
                    onClick={() => { triggerHaptic([10]); setSelectedCategory(chip.id); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer border ${
                      isActive
                        ? "bg-[#E8F0FE] text-[#1A73E8] border-[#D2E3FC] dark:bg-[#8AB4F8]/15 dark:text-[#8AB4F8] dark:border-[#8AB4F8]/30 shadow-2xs"
                        : "bg-[#F8F9FA] dark:bg-[#202124] text-neutral-600 dark:text-neutral-400 border-[#E8EAED] dark:border-[#303134] hover:border-[#DADCE0] dark:hover:border-[#3C4043]"
                    }`}
                  >
                    {chip.emoji} {chip.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE SEARCH RESULTS ── */}
      <AnimatePresence mode="wait">
        {isSearchActive && (
          <motion.div
            key="search-results"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pt-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-neutral-500 dark:text-neutral-400">
                {filteredSquads.length} result{filteredSquads.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
              </span>
            </div>

            {filteredSquads.length === 0 ? (
              <div className="py-14 flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <Search className="w-6 h-6 text-neutral-400 dark:text-neutral-500" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[15px] font-semibold text-neutral-900 dark:text-white">No results found</h4>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 max-w-[260px]">
                    No tribes match &quot;{searchQuery}&quot;. Launch your own!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setNewTribeName(searchQuery); setIsActionCenterOpen(true); }}
                  className="px-4 py-2 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-[13px] font-semibold transition cursor-pointer"
                >
                  Create &quot;{searchQuery}&quot; Tribe
                </button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-900 rounded-2xl overflow-hidden border border-neutral-100 dark:border-neutral-900">
                {filteredSquads.map((tribe) => (
                  <div
                    key={tribe.id}
                    onClick={() => setSelectedTrendingForSheet(tribe)}
                    className="flex items-center gap-3 p-3.5 bg-white dark:bg-[#111111] hover:bg-neutral-50 dark:hover:bg-[#161616] transition-colors cursor-pointer"
                  >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                      <img src={tribe.coverImage} alt={tribe.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">{tribe.name}</span>
                        {tribe.is_private ? (
                          <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                        ) : (
                          <Globe className="w-3 h-3 text-neutral-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[12px] text-neutral-500 dark:text-neutral-400">{tribe.tag}</span>
                        <span className="text-[12px] text-neutral-400 dark:text-neutral-600">·</span>
                        <span className="text-[12px] text-neutral-500 dark:text-neutral-400">{tribe.activeToday} members</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(tribe.inviteCode, e)}
                        className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-300 transition hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      >
                        <Key className="w-2.5 h-2.5 text-amber-500" />
                        <span>{tribe.inviteCode}</span>
                        {copiedCode === tribe.inviteCode ? (
                          <Check className="w-2.5 h-2.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-neutral-400" />
                        )}
                      </button>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      disabled={joiningId === tribe.rawId}
                      onClick={(e) => { e.stopPropagation(); handleJoinSquad(tribe); }}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#1A73E8] hover:bg-[#1557B0] text-white transition cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
                    >
                      {joiningId === tribe.rawId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : "Join"}
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ENROLLED HABIT TRIBES ── */}
      {viewMode !== "search" && !isSearchActive && (
        <>
          <ArenaStoryTray />

          <div className="px-4 pt-4 space-y-3">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-white">
                Your Tribes
                <span className="ml-2 text-[13px] font-normal text-neutral-400 dark:text-neutral-500">
                  {arenas.length} active
                </span>
              </h2>
              <button
                type="button"
                onClick={() => { setActiveActionTab("join"); setIsActionCenterOpen(true); }}
                className="flex items-center gap-1 text-xs font-medium text-[#1A73E8] hover:text-[#1557B0] dark:text-[#8AB4F8] cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Join with code</span>
              </button>
            </div>

            {arenas.length === 0 ? (
              /* Empty Enrolled State */
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-10 px-6 rounded-2xl border border-[#E8EAED] dark:border-[#303134] bg-[#F8F9FA] dark:bg-[#1E1E1E] text-center space-y-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#E8F0FE] dark:bg-[#8AB4F8]/15 border border-[#D2E3FC] dark:border-[#8AB4F8]/20 flex items-center justify-center mx-auto text-[#1A73E8] dark:text-[#8AB4F8]">
                  <Flame className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[15px] font-semibold text-neutral-900 dark:text-white">No tribes yet</h4>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 max-w-[240px] mx-auto leading-relaxed">
                    Join an accountability tribe and start building habits with stakes.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById("explore-squads-section")?.scrollIntoView({ behavior: "smooth" })}
                    className="px-4 py-2 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[13px] font-medium transition cursor-pointer shadow-xs"
                  >
                    Explore Tribes
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveActionTab("join"); setIsActionCenterOpen(true); }}
                    className="px-4 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 transition cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Enter code
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Enrolled Tribe Cards — responsive grid on tablet & desktop */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {arenas.map((arena, idx) => {
                  const isCompleted = isArenaCompletedToday(arena.id);
                  const code = arena.inviteCode || `TRIB-${arena.rawId || arena.id}`;
                  const isCopied = copiedCode === code;

                  return (
                    <motion.div
                      key={arena.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => { triggerHaptic([10]); setSelectedEnrolledTribe(arena); }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] hover:border-[#DADCE0] dark:hover:border-[#3C4043] transition-all cursor-pointer group shadow-xs"
                    >
                      {/* Emoji / Avatar */}
                      <div className="w-11 h-11 rounded-[14px] bg-[#F1F3F4] dark:bg-[#202124] flex items-center justify-center text-xl shrink-0">
                        {arena.emoji}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">
                            {arena.name}
                          </h3>
                          {arena.isPrivate ? (
                            <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                          ) : (
                            <Globe className="w-3 h-3 text-neutral-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
                            {arena.memberCount || 1} members
                          </span>
                          <span className="text-[12px] text-neutral-400 dark:text-neutral-600">·</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(code, e)}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer"
                          >
                            <Key className="w-2.5 h-2.5 text-amber-500" />
                            <span>{code}</span>
                            {isCopied ? (
                              <Check className="w-2.5 h-2.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Right: Status + Arrow */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1 ${
                          isCompleted
                            ? "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6] dark:bg-[#137333]/20 dark:text-[#81C995] dark:border-[#137333]/30"
                            : "bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3] dark:bg-[#B06000]/20 dark:text-[#FDD663] dark:border-[#B06000]/30"
                        }`}>
                          {isCompleted ? (
                            <><Check className="w-2.5 h-2.5 stroke-[2.5]" /><span>Done</span></>
                          ) : (
                            <><Clock className="w-2.5 h-2.5" /><span>{arena.deadlineTime}</span></>
                          )}
                        </span>
                        <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-500 dark:group-hover:text-neutral-400 transition-colors" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── DISCOVER / EXPLORE SECTION ── */}
      {viewMode !== "enrolled" && !isSearchActive && (
        <div id="explore-squads-section" className="space-y-4 pt-1">

          {/* Section Header: Discover */}
          <div className="px-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                Available Squads
                <span className="px-2 py-0.5 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[11px] font-medium text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/25">
                  {filteredSquads.length}
                </span>
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Habit cohorts you can join today
              </p>
            </div>
          </div>

          {/* Discovery Grid */}
          <div className="px-4">
            {isLoadingDiscovery ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="rounded-2xl overflow-hidden skeleton-shimmer">
                    <div className="aspect-[4/3]" />
                    <div className="p-2.5 space-y-1.5 bg-white dark:bg-[#111111]">
                      <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                      <div className="h-2.5 w-1/2 rounded skeleton-shimmer opacity-60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSquads.length === 0 ? (
              <div className="py-10 px-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-center space-y-2">
                <Sparkles className="w-6 h-6 text-neutral-400 dark:text-neutral-600 mx-auto" />
                <p className="text-[14px] font-medium text-neutral-700 dark:text-neutral-300">
                  {discoveryArenas.length === 0
                    ? "No tribes yet — be the first to create one! 🚀"
                    : "You've joined all available tribes in this category 🎉"}
                </p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  {discoveryArenas.length === 0
                    ? "Tap 'New Tribe' to launch your habit group."
                    : "Switch categories or launch your own custom tribe."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSquads.map((tribe, idx) => {
                  const isJoining = joiningId === tribe.rawId;
                  return (
                    <motion.div
                      key={tribe.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => setSelectedTrendingForSheet(tribe)}
                      className="rounded-2xl overflow-hidden bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] hover:border-[#DADCE0] dark:hover:border-[#3C4043] transition-all cursor-pointer group shadow-xs"
                    >
                      {/* Cover Image */}
                      <div className="aspect-[4/3] relative overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                        <img
                          src={tribe.coverImage}
                          alt={tribe.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                        {/* Top badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white">
                            {tribe.emoji} {tribe.category}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            {tribe.activeToday}
                          </span>
                        </div>

                        {/* Name overlay */}
                        <div className="absolute bottom-2 inset-x-2">
                          <h4 className="text-[13px] font-semibold text-white line-clamp-1 drop-shadow-sm">
                            {tribe.name}
                          </h4>
                          <p className="text-[10px] text-amber-300/90 mt-0.5">
                            ⏰ {tribe.deadlineTime}
                          </p>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-2.5 space-y-2">
                        {/* Join Code */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(tribe.inviteCode, e)}
                          className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] text-[11px] font-mono text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
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

                        {/* Join CTA */}
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          disabled={isJoining}
                          onClick={(e) => { e.stopPropagation(); handleJoinSquad(tribe); }}
                          className="w-full py-1.5 rounded-full text-[13px] font-medium transition cursor-pointer flex items-center justify-center gap-1 bg-[#1A73E8] hover:bg-[#1557B0] text-white dark:bg-[#8AB4F8] dark:text-[#202124] dark:hover:bg-[#A8C7FA] disabled:opacity-50 shadow-xs"
                        >
                          {isJoining ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>Join</span></>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Community Proof Grid (3-col Instagram explore) */}
          {exploreProofs.length > 0 && (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between px-4">
                <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-white">
                  Community Proofs
                </h2>
                <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  {exploreProofs.length} drops
                </span>
              </div>

              <div className="grid grid-cols-3 gap-[1.5px]">
                {exploreProofs.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => openProofReply(post)}
                    className="aspect-square relative overflow-hidden group cursor-pointer bg-neutral-100 dark:bg-neutral-900"
                  >
                    <img
                      src={post.mainImage}
                      alt={post.caption || "Community habit proof"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-white">
                        <Flame className="w-4 h-4 fill-rose-500 text-rose-500" />
                        <span className="text-[12px] font-semibold">{post.reactions?.fire || 0}</span>
                      </div>
                    </div>
                    {/* Arena tag chip */}
                    <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] font-medium text-white truncate block">{post.arenaTag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── BOTTOM SHEETS ── */}
      {/* ─────────────────────────────────────────────────────── */}

      {/* SHEET 1: Enrolled Tribe Detail */}
      <AnimatePresence>
        {selectedEnrolledTribe && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedEnrolledTribe(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-[#1c1c1e] border-t border-neutral-200 dark:border-neutral-800 rounded-t-[28px] overflow-hidden text-neutral-900 dark:text-white shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cover Banner */}
              <div className="h-40 relative bg-black shrink-0">
                {selectedEnrolledTribe.bannerImage ? (
                  <img src={selectedEnrolledTribe.bannerImage} alt={selectedEnrolledTribe.name} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <button
                  type="button"
                  onClick={() => setSelectedEnrolledTribe(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{selectedEnrolledTribe.emoji}</span>
                    <span className="px-2 py-0.5 rounded-full bg-black/50 border border-white/10 text-[11px] font-medium text-emerald-400">
                      {selectedEnrolledTribe.tag}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-white">{selectedEnrolledTribe.name}</h3>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {selectedEnrolledTribe.description || "Daily peer accountability cohort for building consistency."}
                </p>

                {/* Join Code Box */}
                <div className="p-3.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-[12px] font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      <span>Tribe Code</span>
                    </div>
                    <span className="text-[16px] font-mono font-semibold text-neutral-900 dark:text-white">
                      {selectedEnrolledTribe.inviteCode || `TRIB-${selectedEnrolledTribe.rawId || selectedEnrolledTribe.id}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(selectedEnrolledTribe.inviteCode || `TRIB-${selectedEnrolledTribe.rawId || selectedEnrolledTribe.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-200/70 dark:bg-[#303134] text-[12px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300/80 dark:hover:bg-[#3C4043] transition cursor-pointer"
                  >
                    {copiedCode === (selectedEnrolledTribe.inviteCode || `TRIB-${selectedEnrolledTribe.rawId || selectedEnrolledTribe.id}`) ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-500" /><span>Copied!</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
                    )}
                  </button>
                </div>

                {/* 7-Day Track — Google Calendar / Fit calm streak indicator */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px] text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" /> 7-Day Streak</span>
                    <span className={`font-medium ${isArenaCompletedToday(selectedEnrolledTribe.id) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {isArenaCompletedToday(selectedEnrolledTribe.id) ? "✓ Done today" : "Pending today"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 p-2.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134]">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
                      const isCompleted = isArenaCompletedToday(selectedEnrolledTribe.id);
                      const isPast = i < 3;
                      const isToday = i === 3;
                      return (
                        <div key={i} className={`flex-1 h-9 rounded-xl flex items-center justify-center text-[11px] font-medium transition ${
                          isPast
                            ? "bg-[#E6F4EA] dark:bg-[#137333]/25 text-[#137333] dark:text-[#81C995] border border-[#CEEAD6] dark:border-[#137333]/30"
                            : isToday
                            ? isCompleted
                              ? "bg-[#0F9D58] text-white"
                              : "border-2 border-[#1A73E8] dark:border-[#8AB4F8] text-[#1A73E8] dark:text-[#8AB4F8] bg-transparent font-semibold"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600"
                        }`}>
                          {isPast || (isToday && isCompleted) ? "✓" : day}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Members", value: selectedEnrolledTribe.memberCount || 1, icon: <Users className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8] mx-auto mb-0.5" /> },
                    { label: "Stake", value: `⚡ ${selectedEnrolledTribe.penaltyAmount || 50}`, icon: null },
                    { label: "Cutoff", value: selectedEnrolledTribe.deadlineTime, icon: null },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="p-2.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134]">
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-0.5">{label}</div>
                      {icon}
                      <div className="text-[13px] font-semibold text-neutral-900 dark:text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  {!isArenaCompletedToday(selectedEnrolledTribe.id) && (
                    <button
                      type="button"
                      onClick={() => { const id = selectedEnrolledTribe.id; setSelectedEnrolledTribe(null); openCamera(id); }}
                      className="w-full py-3 rounded-full bg-[#0F9D58] hover:bg-[#0B8043] text-white font-medium text-[14px] shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Submit Today&apos;s Proof</span>
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { const t = selectedEnrolledTribe; setSelectedEnrolledTribe(null); openDm(t.id, t.name, t.tag); }}
                      className="py-2.5 rounded-full bg-transparent text-neutral-800 dark:text-neutral-200 text-[13px] font-medium transition cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <MessageCircle className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                      <span>Tribe Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { const t = selectedEnrolledTribe; setSelectedEnrolledTribe(null); router.push(`/arenas/${t.rawId || t.id}`); }}
                      className="py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[13px] font-medium transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Open Chamber</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHEET 2: Discovery Tribe Detail */}
      <AnimatePresence>
        {selectedTrendingForSheet && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedTrendingForSheet(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-[#1c1c1e] border-t border-neutral-200 dark:border-neutral-800 rounded-t-[28px] overflow-hidden text-neutral-900 dark:text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cover */}
              <div className="h-44 relative bg-black">
                <img src={selectedTrendingForSheet.coverImage} alt={selectedTrendingForSheet.name} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <button type="button" onClick={() => setSelectedTrendingForSheet(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{selectedTrendingForSheet.emoji}</span>
                    <span className="px-2 py-0.5 rounded-full bg-black/50 border border-white/10 text-[11px] font-medium text-emerald-400">{selectedTrendingForSheet.tag}</span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-white">{selectedTrendingForSheet.name}</h3>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">{selectedTrendingForSheet.description}</p>

                {/* Join Code */}
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#2c2c2e] border border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                      <Key className="w-3 h-3 text-amber-500" /> Tribe Code
                    </div>
                    <span className="text-[16px] font-mono font-semibold text-neutral-900 dark:text-white">{selectedTrendingForSheet.inviteCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(selectedTrendingForSheet.inviteCode)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[13px] font-medium transition cursor-pointer"
                  >
                    {copiedCode === selectedTrendingForSheet.inviteCode ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-500" /><span>Copied!</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
                    )}
                  </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Members", value: selectedTrendingForSheet.activeToday },
                    { label: "Entry Stake", value: `⚡ ${selectedTrendingForSheet.stakeKudos}` },
                    { label: "Cutoff", value: selectedTrendingForSheet.deadlineTime },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#2c2c2e] border border-neutral-100 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">{label}</div>
                      <div className="text-[13px] font-semibold text-neutral-900 dark:text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Join CTA */}
                <button
                  type="button"
                  disabled={joiningId === selectedTrendingForSheet.rawId}
                  onClick={() => { handleJoinSquad(selectedTrendingForSheet); setSelectedTrendingForSheet(null); }}
                  className="w-full py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[14px] shadow-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {joiningId === selectedTrendingForSheet.rawId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : "Join Habit Tribe"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHEET 3: Create / Join Action Center */}
      <AnimatePresence>
        {isActionCenterOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setIsActionCenterOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-[#1E1E1E] border-t border-[#E8EAED] dark:border-[#303134] rounded-t-[28px] p-5 text-neutral-900 dark:text-white space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-9 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto -mt-1 mb-2" />

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-white">Habit Tribe Hub</h3>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">Launch a tribe or join with a code</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActionCenterOpen(false)}
                  className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Control */}
              <div className="flex p-1 rounded-full bg-[#F1F3F4] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134]">
                {(["create", "join"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { triggerHaptic([10]); setActiveActionTab(tab); }}
                    className={`flex-1 py-1.5 rounded-full text-[13px] font-medium transition cursor-pointer ${
                      activeActionTab === tab
                        ? "bg-white dark:bg-[#303134] text-[#1A73E8] dark:text-[#8AB4F8] shadow-xs font-semibold"
                        : "text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    {tab === "create" ? "Create Tribe" : "Join with Code"}
                  </button>
                ))}
              </div>

              {/* Create Form */}
              {activeActionTab === "create" ? (
                <form onSubmit={handleCreateTribeSubmit} className="flex-1 overflow-y-auto pr-1 space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">Tribe Name *</label>
                      <span className="text-[10px] text-neutral-400 font-mono">{newTribeName.length}/60</span>
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={newTribeName}
                      onChange={(e) => setNewTribeName(e.target.value)}
                      placeholder="e.g. 5AM High-Output Builders"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[13px] text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]/30 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300 block mb-1">Category</label>
                      <select
                        value={newTribeCategory}
                        onChange={(e) => {
                          setNewTribeCategory(e.target.value);
                          const emojiMap: Record<string, string> = {
                            "Athletics": "🏃",
                            "Code & Build": "💻",
                            "Deep Focus": "⚡",
                            "Mind & Body": "🧘",
                            "Clean Nutrition": "🥗",
                          };
                          if (emojiMap[e.target.value]) setNewTribeIcon(emojiMap[e.target.value]);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[12px] text-neutral-900 dark:text-white focus:outline-none"
                      >
                        <option>Athletics</option>
                        <option>Code &amp; Build</option>
                        <option>Deep Focus</option>
                        <option>Mind &amp; Body</option>
                        <option>Clean Nutrition</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300 block mb-1">Daily Cutoff</label>
                      <input
                        type="text"
                        value={newTribeCutoff}
                        onChange={(e) => setNewTribeCutoff(e.target.value)}
                        placeholder="11:59 PM"
                        className="w-full px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[12px] text-neutral-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300 block mb-1">Tribe Mission / Rules</label>
                    <textarea
                      rows={2}
                      value={newTribeDescription}
                      onChange={(e) => setNewTribeDescription(e.target.value)}
                      placeholder="What is the daily standard? (e.g. 5km run or 1hr deep code)"
                      className="w-full px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[12px] text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#1A73E8] resize-none"
                    />
                  </div>

                  {/* Proof Type Selector */}
                  <div>
                    <label className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300 block mb-1.5">Proof Verification Type</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "image", label: "📸 Photo", desc: "Camera snapshot" },
                        { id: "link", label: "🔗 Link", desc: "URL verification" },
                        { id: "text", label: "📝 Text", desc: "Reflection log" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic([10]);
                            setNewTribeProofType(item.id as "image" | "link" | "text");
                          }}
                          className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                            newTribeProofType === item.id
                              ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8] dark:bg-[#8AB4F8]/15 dark:border-[#8AB4F8] dark:text-[#8AB4F8] shadow-xs"
                              : "bg-[#F8F9FA] dark:bg-[#202124] border-[#E8EAED] dark:border-[#303134] text-neutral-600 dark:text-neutral-400"
                          }`}
                        >
                          <div className="text-[11px] font-medium">{item.label}</div>
                          <div className="text-[9px] opacity-75">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Commitment Stake */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">Daily Miss Stake (Kudos)</label>
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 font-mono">⚡ {newTribeStake}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                      {[25, 50, 100, 200].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            triggerHaptic([10]);
                            setNewTribeStake(String(amt));
                          }}
                          className={`py-1 rounded-full text-[11px] font-medium transition cursor-pointer text-center ${
                            newTribeStake === String(amt)
                              ? "bg-[#1A73E8] text-white shadow-xs"
                              : "bg-[#F8F9FA] dark:bg-[#202124] text-neutral-700 dark:text-neutral-300 border border-[#E8EAED] dark:border-[#303134]"
                          }`}
                        >
                          ⚡ {amt}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={newTribeStake}
                      onChange={(e) => setNewTribeStake(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[13px] text-neutral-900 dark:text-white font-mono focus:outline-none"
                    />
                  </div>

                  {/* Privacy Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic([10]);
                        setNewTribeIsPrivate(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        !newTribeIsPrivate
                          ? "bg-[#E8F0FE] border-[#1A73E8] text-neutral-900 dark:text-white dark:bg-[#8AB4F8]/15 dark:border-[#8AB4F8]"
                          : "bg-[#F8F9FA] dark:bg-[#202124] border-[#E8EAED] dark:border-[#303134] text-neutral-500"
                      }`}
                    >
                      <div className="text-[11px] font-medium flex items-center gap-1">🌐 Public</div>
                      <div className="text-[9px] opacity-75">Open discovery</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic([10]);
                        setNewTribeIsPrivate(true);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        newTribeIsPrivate
                          ? "bg-[#FEF7E0] border-[#F9AB00] text-neutral-900 dark:text-white dark:bg-[#F9AB00]/15 dark:border-[#F9AB00]"
                          : "bg-[#F8F9FA] dark:bg-[#202124] border-[#E8EAED] dark:border-[#303134] text-neutral-500"
                      }`}
                    >
                      <div className="text-[11px] font-medium flex items-center gap-1">🔒 Private</div>
                      <div className="text-[9px] opacity-75">Admin approved</div>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingTribe || !newTribeName.trim()}
                    className="w-full py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[14px] shadow-xs transition cursor-pointer mt-1 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingTribe ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Launching...</span>
                      </>
                    ) : (
                      <span>Launch Tribe</span>
                    )}
                  </button>
                </form>
              ) : (
                /* Join by Code */
                <form onSubmit={handleJoinByCodeSubmit} className="space-y-4">
                  <div className="text-center space-y-1 py-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#FEF7E0] dark:bg-[#F9AB00]/15 border border-[#FEEFC3] dark:border-[#F9AB00]/25 flex items-center justify-center mx-auto">
                      <Key className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-[13px] font-medium text-neutral-900 dark:text-white">Enter Tribe Code</p>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                      Enter the code shared by your habit group
                    </p>
                  </div>
                  <input
                    type="text"
                    maxLength={12}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. GYM-99"
                    className="w-full text-center tracking-[0.2em] text-[18px] font-semibold px-4 py-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[#1A73E8] dark:text-[#8AB4F8] placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-[#1A73E8]"
                  />
                  <button
                    type="submit"
                    disabled={!inviteCode.trim()}
                    className="w-full py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[14px] disabled:opacity-40 shadow-xs transition cursor-pointer"
                  >
                    Join Tribe
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
