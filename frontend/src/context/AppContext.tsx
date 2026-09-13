"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { tribelyService, ApiArena, ApiSubmission, ApiHeatmapDay, ApiMessage } from "@/services/tribely.service";

// ─────────────────────────────────────────────────────────────────────────────
// Types (kept UI-friendly for component layer compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  kudosBalance: number;
  currentStreak: number;
  longestStreak: number;
  streakShields: number;
  multiplier: number;
  tierBadge: string;
  hasSubmittedToday: boolean;
  followingCount: number;
  followersCount: number;
  arenasCount: number;
}

export interface HabitArena {
  id: string;
  name: string;
  tag: string;
  emoji: string;
  description: string;
  memberCount: number;
  penaltyAmount: number;
  deadlineTime: string;
  countdownMinutesLeft: number;
  vaultPoolKudos: number;
  multiplierActive: boolean;
  multiplierValue: number;
  bannerImage: string;
  rawId: number;   // actual numeric ID for API calls
  proofType?: string;
  inviteCode?: string;
  isPrivate?: boolean;
}

export interface StorySlide {
  id?: string;
  imageUrl: string;
  selfieUrl?: string | null;
  caption: string;
  telemetry: string;
  timeAgo: string;
  arenaTag?: string;
}

export interface StoryUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  arenaTag: string;
  arenaId?: number;
  status: "self" | "verified" | "urgent" | "missed";
  countdownText?: string;
  minutesLeft?: number;
  proofs?: StorySlide[];
  latestProof?: StorySlide;
}

export interface ProofPost {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  userAvatar: string;
  arenaId: string;
  arenaTag: string;
  arenaName?: string;
  isJoined?: boolean;
  isPrivate?: boolean;
  penaltyAmount?: number;
  deadlineTime?: string;
  verifiedTime: string;
  submittedAt?: string;
  isToday?: boolean;
  mainImage: string;
  selfiePiP?: string | null;
  telemetry: string;
  telemetryIcon: "run" | "code" | "read" | "gym" | "meditate";
  caption: string;
  reactions: { fire: number; electric: number; respect: number; target: number };
  currentUserReaction?: "fire" | "electric" | "respect" | "target" | null;
  upvotes?: number;
  downvotes?: number;
  userVote?: "upvote" | "downvote" | null;
  commentsCount: number;
  timeAgo: string;
  rawSubmissionId?: number;
  proofType?: string;
}

export interface HeatmapTile {
  date: string;
  dayOfMonth: number;
  status: "verified" | "shielded" | "absent" | "today_pending" | "future";
  proofTitle?: string;
  telemetrySnippet?: string;
}

export interface TribeNote {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  isSelf: boolean;
  noteText: string;
  timeAgo: string;
  expiresAt: string;
  arenaTag?: string;
}

export interface TribeMessage {
  id: string;
  arenaId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  isSelf: boolean;
  type: "text" | "system_event" | "audio";
  text?: string;
  systemEvent?: {
    type: "proof_drop" | "shield_used" | "multiplier_boost";
    memberName: string;
    description: string;
    proofId?: string;
  };
  audioDuration?: string;
  audioWaveform?: number[];
  timestamp: string;
  reactions: Record<string, number>;
  currentUserReactions?: string[];
}

export interface ProofComment {
  id: string;
  proofId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timeAgo: string;
  likes: number;
}

export interface LeaderboardMember {
  rank: number;
  id: string;
  name: string;
  username: string;
  avatar: string;
  streakDays: number;
  consistencyRate: number;
  kudosEarned: number;
  isCurrentUser?: boolean;
}

export interface MosaicItem {
  id: string;
  imageUrl: string;
  arenaTag: string;
  dayNumber: number;
  likes: number;
}

export interface TrendingTribe {
  id: string;
  rawId?: number;
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
  is_private?: boolean;
}

export type SuperPropType = "lightning" | "crown" | "diamond";

export interface SuperPropBurst {
  id: string;
  postId: string;
  type: SuperPropType;
  emoji: string;
  title: string;
}

export type NavTab = "feed" | "explore" | "camera" | "vault" | "profile" | "squads";

export interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "nudge" | "fire" | "info";
}

const LOCAL_STORAGE_VOTES_KEY = "tribely_persisted_votes";

interface PersistedVoteEntry {
  vote: "upvote" | "downvote" | null;
  timestamp: number;
}

function getPersistedVotes(): Record<string, PersistedVoteEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePersistedVote(postId: string, rawSubId: number | string | undefined, vote: "upvote" | "downvote" | null) {
  if (typeof window === "undefined") return;
  try {
    const votes = getPersistedVotes();
    const entry: PersistedVoteEntry = { vote, timestamp: Date.now() };
    votes[postId] = entry;
    const cleanNum = String(postId).replace(/\D/g, "");
    if (cleanNum) votes[cleanNum] = entry;
    if (rawSubId) votes[String(rawSubId)] = entry;
    localStorage.setItem(LOCAL_STORAGE_VOTES_KEY, JSON.stringify(votes));
  } catch {}
}

export const FALLBACK_FEED_POSTS: ProofPost[] = [
  {
    id: "sub_demo_1",
    rawSubmissionId: 901,
    userId: "201",
    userName: "Alex Rivera",
    userHandle: "alex_r",
    userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    arenaId: "1",
    arenaName: "5 AM Club & Morning Run",
    arenaTag: "#5AMClub",
    isJoined: true,
    isPrivate: false,
    isToday: true,
    proofType: "image",
    penaltyAmount: 50,
    deadlineTime: "06:30 AM",
    submittedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    verifiedTime: "Verified Today at 05:45 AM",
    mainImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1000&q=80",
    selfiePiP: null,
    telemetry: "⚡ 5.2 km dawn run logged",
    telemetryIcon: "run",
    caption: "5:00 AM wake up locked in! Sunrise pace was brisk but feeling unstoppable today. 🔥",
    upvotes: 14,
    downvotes: 0,
    userVote: null,
    reactions: { fire: 14, electric: 0, respect: 0, target: 0 },
    currentUserReaction: null,
    commentsCount: 3,
    timeAgo: "25m ago",
  },
  {
    id: "sub_demo_2",
    rawSubmissionId: 902,
    userId: "202",
    userName: "Marcus Vance",
    userHandle: "marcus_dev",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    arenaId: "2",
    arenaName: "LeetCode 75 Grind",
    arenaTag: "#LeetCode",
    isJoined: true,
    isPrivate: false,
    isToday: true,
    proofType: "link",
    penaltyAmount: 50,
    deadlineTime: "11:59 PM",
    submittedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    verifiedTime: "Verified Today at 04:30 PM",
    mainImage: "https://leetcode.com/problems/trapping-rain-water/",
    selfiePiP: null,
    telemetry: "⚡ Algorithm Solution • LeetCode Hard",
    telemetryIcon: "code",
    caption: "Trapping Rain Water solved in O(N) two-pointer approach! Day 19 streak intact. 💻",
    upvotes: 21,
    downvotes: 0,
    userVote: null,
    reactions: { fire: 21, electric: 0, respect: 0, target: 0 },
    currentUserReaction: null,
    commentsCount: 5,
    timeAgo: "1h ago",
  },
  {
    id: "sub_demo_3",
    rawSubmissionId: 903,
    userId: "203",
    userName: "Elena Rostova",
    userHandle: "elena_lifts",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    arenaId: "3",
    arenaName: "Heavy Iron & Hypertrophy",
    arenaTag: "#GymGrind",
    isJoined: false,
    isPrivate: false,
    isToday: true,
    proofType: "image",
    penaltyAmount: 50,
    deadlineTime: "10:00 PM",
    submittedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    verifiedTime: "Verified Today at 02:15 PM",
    mainImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1000&q=80",
    selfiePiP: null,
    telemetry: "⚡ Leg Day • Squat 110kg 5x5",
    telemetryIcon: "gym",
    caption: "Heavy squats completed before cutoff. Don't skip leg day! 🏋️‍♀️",
    upvotes: 9,
    downvotes: 0,
    userVote: null,
    reactions: { fire: 9, electric: 0, respect: 0, target: 0 },
    currentUserReaction: null,
    commentsCount: 1,
    timeAgo: "3h ago",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: map API types -> UI types
// ─────────────────────────────────────────────────────────────────────────────

const EMOJI_MAP: Record<string, string> = {
  run: "🏃", gym: "🏋️", code: "💻", read: "📚", meditate: "🧘",
};

function arenaEmoji(name: string, proofType?: string): string {
  if (/5am|dawn|morning|wake/i.test(name)) return "🏃";
  if (/gym|lift|iron|heavy|workout|fitness/i.test(name)) return "🏋️";
  if (/leet|code|dev|program/i.test(name)) return "💻";
  if (/read|book|page/i.test(name)) return "📚";
  if (/meditat|mindful/i.test(name)) return "🧘";
  return "🎯";
}

function arenaTag(name: string): string {
  return "#" + name.replace(/\s+/g, "").slice(0, 20);
}

function countdownMinutes(deadlineTime?: string): number {
  if (!deadlineTime) return 60;
  try {
    const now = new Date();
    const [time, period] = deadlineTime.split(" ");
    const [h, m] = time.split(":").map(Number);
    let hours = h;
    if (period?.toUpperCase() === "PM" && h !== 12) hours += 12;
    if (period?.toUpperCase() === "AM" && h === 12) hours = 0;
    const cutoff = new Date(now);
    cutoff.setHours(hours, m || 0, 0, 0);
    const diff = cutoff.getTime() - now.getTime();
    return diff > 0 ? Math.floor(diff / 60000) : 0;
  } catch {
    return 60;
  }
}

function arenaBannerImage(name: string, proofType?: string): string {
  if (/5am|dawn|morning|wake/i.test(name)) return "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80";
  if (/gym|lift|iron|heavy|workout|fitness/i.test(name)) return "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80";
  if (/leet|code|dev|program/i.test(name)) return "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80";
  if (/read|book|page/i.test(name)) return "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80";
  if (/meditat|mindful/i.test(name)) return "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80";
  return "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80";
}

function mapApiArena(arena: ApiArena): HabitArena {
  return {
    id: String(arena.id),
    rawId: arena.id,
    name: arena.name,
    tag: arenaTag(arena.name),
    emoji: arenaEmoji(arena.name, arena.proof_type),
    description: arena.description || "",
    memberCount: arena.member_count || 0,
    penaltyAmount: Number(arena.penalty_amount || 0),
    deadlineTime: arena.deadline_time || "11:59 PM",
    countdownMinutesLeft: countdownMinutes(arena.deadline_time),
    vaultPoolKudos: 0,
    multiplierActive: false,
    multiplierValue: 1.0,
    bannerImage: arenaBannerImage(arena.name, arena.proof_type),
    proofType: arena.proof_type,
    inviteCode: arena.invite_code || "",
    isPrivate: Boolean(arena.is_private),
  };
}

function mapApiSubmission(sub: ApiSubmission, arena?: HabitArena): ProofPost {
  const upvotes = sub.upvotes || 0;
  const downvotes = sub.downvotes || 0;
  return {
    id: String(sub.id),
    userId: String(sub.user_id),
    userName: sub.user_name || `Member #${sub.user_id}`,
    userHandle: (sub.user_name || "member").toLowerCase().replace(/\s+/g, "_"),
    userAvatar: sub.user_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.user_id}`,
    arenaId: String(sub.arena_id),
    arenaTag: arena?.tag || `#Arena${sub.arena_id}`,
    arenaName: arena?.name,
    verifiedTime: `Verified ${new Date(sub.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    mainImage: sub.proof_url || "",
    selfiePiP: null as any,
    telemetry: sub.text_reflection || (sub.ai_status === "verified" ? "✅ AI Verified" : "Manual Snap"),
    telemetryIcon: "run",
    caption: sub.text_reflection || "Daily habit completed! Consistency is the key. 💪",
    reactions: {
      fire: upvotes,
      electric: 0,
      respect: 0,
      target: downvotes,
    },
    currentUserReaction: sub.user_vote === "up" ? "fire" : sub.user_vote === "down" ? "target" : null,
    commentsCount: 0,
    timeAgo: tribelyService.formatTimeAgo(sub.submitted_at),
    rawSubmissionId: sub.id,
  };
}

function mapApiHeatmapDay(day: ApiHeatmapDay): HeatmapTile {
  const date = new Date(day.date + "T12:00:00Z");
  const statusMap: Record<string, HeatmapTile["status"]> = {
    present: "verified",
    shielded: "shielded",
    absent: "absent",
    today_pending: "today_pending",
  };
  return {
    date: day.date,
    dayOfMonth: date.getDate(),
    status: statusMap[day.status] || "absent",
    proofTitle: day.status === "present" ? "Habit Completed ✅" :
                day.status === "shielded" ? "Streak Shield Used 🛡️" :
                day.status === "today_pending" ? "Today: Awaiting Proof" : "Missed",
    telemetrySnippet: day.proof_type ? `Proof type: ${day.proof_type}` : undefined,
  };
}

function generate30DayFallback(): HeatmapTile[] {
  const result: HeatmapTile[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push({
      date: d.toISOString().split("T")[0],
      dayOfMonth: d.getDate(),
      status: i === 0 ? "today_pending" : Math.random() > 0.2 ? "verified" : "absent",
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface AppContextType {
  user: UserProfile;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  arenas: HabitArena[];
  feedPosts: ProofPost[];
  storyUsers: StoryUser[];
  heatmapTiles: HeatmapTile[];
  notes: TribeNote[];
  tribeMessages: TribeMessage[];
  activeProofForReply: ProofPost | null;
  proofComments: Record<string, ProofComment[]>;
  isCameraModalOpen: boolean;
  activeStoryModal: StoryUser | null;
  isDmDrawerOpen: boolean;
  activeDmArena: { id: string; name: string; tag: string; rawId?: number } | null;
  unreadDmsCount: number;
  isInstagramStoryExportOpen: boolean;
  toast: ToastNotification | null;
  isLoadingFeed: boolean;
  isLoadingArenas: boolean;

  completedArenaIdsToday: string[];
  isArenaCompletedToday: (arenaId: string | number) => boolean;
  activeSuperPropBurst: SuperPropBurst | null;
  triggerSuperProp: (postId: string, type: SuperPropType) => void;

  openCamera: () => void;
  closeCamera: () => void;
  openStory: (user: StoryUser) => void;
  closeStory: () => void;
  openDm: (arenaId?: string, arenaName?: string, arenaTag?: string, rawArenaId?: number) => void;
  openMessagesInbox: () => void;
  closeDm: () => void;
  openInstagramStoryExport: () => void;
  closeInstagramStoryExport: () => void;
  openProofReply: (post: ProofPost) => void;
  closeProofReply: () => void;
  addProofComment: (proofId: string, text: string) => void;
  postDailyNote: (text: string) => void;
  sendTribeMessage: (text?: string, type?: "text" | "audio", audioDuration?: string, audioWaveform?: number[]) => void;
  sendQuickNudge: (targetUserId: string, nudgeText: string) => void;
  reactToMessage: (messageId: string, emoji: string) => void;
  toggleReaction: (postId: string, reactionType: "fire" | "electric" | "respect" | "target") => void;
  toggleLike: (postId: string) => void;
  toggleDislike: (postId: string) => void;
  dropProofOptimistic: (payload: { arenaId: string; image: string; selfie?: string; caption: string; telemetry?: string; keepOpen?: boolean }) => void;
  nudgePeer: (peerUser: StoryUser) => void;
  claimStreakLifeline: () => void;
  triggerHaptic: (pattern?: number[]) => void;
  showToast: (message: string, type?: ToastNotification["type"]) => void;
  refreshFeed: () => Promise<void>;
  refreshArenas: () => void;
  hasMoreFeed: boolean;
  loadMoreFeedPosts: () => Promise<void>;
  joinSquad: (arenaId: number) => Promise<boolean>;
  viewedStoryUserIds: Set<string>;
  markStoryAsViewed: (storyUserId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Default / Guest user profile
// ─────────────────────────────────────────────────────────────────────────────

function buildGuestUser(): UserProfile {
  return {
    id: "guest",
    name: "You",
    username: "member",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=guest",
    bio: "Building daily habits with Tribely 🚀",
    kudosBalance: 0,
    currentStreak: 0,
    longestStreak: 0,
    streakShields: 1,
    multiplier: 1.0,
    tierBadge: "🌱 Day 0 Starter",
    hasSubmittedToday: false,
    followingCount: 0,
    followersCount: 0,
    arenasCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(buildGuestUser());
  const [activeTab, setActiveTab] = useState<NavTab>("feed");
  const [arenas, setArenas] = useState<HabitArena[]>([]);
  const [feedPosts, setFeedPosts] = useState<ProofPost[]>([]);
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [heatmapTiles, setHeatmapTiles] = useState<HeatmapTile[]>(generate30DayFallback());
  const [notes, setNotes] = useState<TribeNote[]>([]);
  const [tribeMessages, setTribeMessages] = useState<TribeMessage[]>([]);
  const [activeProofForReply, setActiveProofForReply] = useState<ProofPost | null>(null);
  const [proofComments, setProofComments] = useState<Record<string, ProofComment[]>>({});
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [activeStoryModal, setActiveStoryModal] = useState<StoryUser | null>(null);
  const [isDmDrawerOpen, setIsDmDrawerOpen] = useState(false);
  const [activeDmArena, setActiveDmArena] = useState<{ id: string; name: string; tag: string; rawId?: number } | null>(null);
  const [unreadDmsCount, setUnreadDmsCount] = useState(0);
  const [isInstagramStoryExportOpen, setIsInstagramStoryExportOpen] = useState(false);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isLoadingMoreFeed, setIsLoadingMoreFeed] = useState(false);
  const [isLoadingArenas, setIsLoadingArenas] = useState(false);
  const [completedArenaIdsToday, setCompletedArenaIdsToday] = useState<string[]>([]);
  const [activeSuperPropBurst, setActiveSuperPropBurst] = useState<SuperPropBurst | null>(null);
  const [viewedStoryUserIds, setViewedStoryUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const todayKey = `tribely_viewed_stories_${new Date().toISOString().slice(0, 10)}`;
      const saved = localStorage.getItem(todayKey);
      if (saved) {
        setViewedStoryUserIds(new Set(JSON.parse(saved)));
      }
    } catch {}
  }, []);

  // Real-time synchronization of peer comments on proof submissions
  useEffect(() => {
    const handleCommentAdded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      if (!data || !data.proof_id || !data.comment) return;

      const proofId = String(data.proof_id);
      const incomingComment = data.comment as ProofComment;

      setProofComments((prev) => {
        const existing = prev[proofId] || [];
        if (existing.some((c) => c.id === incomingComment.id)) {
          return prev;
        }
        return {
          ...prev,
          [proofId]: [...existing, incomingComment],
        };
      });

      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === proofId
            ? { ...p, commentsCount: data.comments_count ?? (p.commentsCount || 0) + 1 }
            : p
        )
      );
    };

    window.addEventListener("tribely:proof_comment_added", handleCommentAdded);
    return () => {
      window.removeEventListener("tribely:proof_comment_added", handleCommentAdded);
    };
  }, []);

  const markStoryAsViewed = useCallback((storyUserId: string) => {
    if (!storyUserId || storyUserId === "self") return;
    setViewedStoryUserIds((prev) => {
      const next = new Set(prev);
      next.add(storyUserId);
      try {
        const todayKey = `tribely_viewed_stories_${new Date().toISOString().slice(0, 10)}`;
        localStorage.setItem(todayKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const arenasRef = useRef<HabitArena[]>([]);
  arenasRef.current = arenas;

  const feedPostsRef = useRef<ProofPost[]>([]);
  feedPostsRef.current = feedPosts;

  // ── Haptic & Toast ──────────────────────────────────────────────────────────

  const triggerHaptic = (pattern: number[] = [15]) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(pattern); } catch {}
    }
  };

  const showToast = useCallback((message: string, type: ToastNotification["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, message, type });
    setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 3200);
  }, []);

  // ── Bootstrap: Load real data from backend ──────────────────────────────────

  const refreshArenas = useCallback(async () => {
    setIsLoadingArenas(true);
    try {
      const apiArenas = await tribelyService.fetchMyArenas();
      const mapped = apiArenas.map(mapApiArena);
      setArenas(mapped);
      return mapped;
    } catch {
      return [];
    } finally {
      setIsLoadingArenas(false);
    }
  }, []);

  const mapApiPostToProofPost = useCallback((p: any): ProofPost => {
    const timeAgoStr = tribelyService.formatTimeAgo(p.submitted_at);
    const rawUrl = p.proof_url || "";
    const isYouTube = rawUrl.includes("youtube.com") || rawUrl.includes("youtu.be");
    const isImg =
      rawUrl.startsWith("data:image/") ||
      rawUrl.startsWith("blob:") ||
      rawUrl.includes("images.unsplash.com") ||
      rawUrl.includes("cloudinary.com") ||
      rawUrl.includes("amazonaws.com") ||
      rawUrl.includes("imgur.com") ||
      rawUrl.includes("cdn.") ||
      Boolean(rawUrl.match(/\.(jpeg|jpg|gif|png|webp|avif|bmp|svg)($|\?|&)/i));

    let computedProofType = "image";
    if (isYouTube) {
      computedProofType = "youtube";
    } else if (p.proof_type?.toLowerCase() === "link" && !isImg) {
      computedProofType = "link";
    } else if (!isImg && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://"))) {
      computedProofType = "link";
    }

    const persistedVotes = getPersistedVotes();
    const subKey = String(p.id);
    const cleanNumericKey = subKey.replace(/\D/g, "");
    const saved = persistedVotes[subKey] || (cleanNumericKey ? persistedVotes[cleanNumericKey] : null) || (p.rawSubmissionId ? persistedVotes[String(p.rawSubmissionId)] : null);

    let activeUserVote: "upvote" | "downvote" | null = (p.user_vote as any) || (p.userVote as any) || (p.current_user_reaction === "target" ? "downvote" : p.current_user_reaction ? "upvote" : null);
    let upvotesCount = p.upvotes || 0;
    let downvotesCount = p.downvotes || 0;

    if (saved) {
      activeUserVote = saved.vote;
      if (saved.vote === "upvote" && p.user_vote !== "upvote" && p.user_vote !== "up") {
        upvotesCount = Math.max(1, upvotesCount);
      } else if (saved.vote === "downvote" && p.user_vote !== "downvote" && p.user_vote !== "down") {
        downvotesCount = Math.max(1, downvotesCount);
      }
    }

    return {
      id: String(p.id),
      rawSubmissionId: p.id,
      userId: String(p.user_id),
      userName: p.user_name,
      userHandle: p.user_handle || `user${p.user_id}`,
      userAvatar: p.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id}`,
      arenaId: String(p.arena_id),
      arenaName: p.arena_name,
      arenaTag: p.arena_tag || "#DailyHabit",
      isJoined: p.is_joined,
      isPrivate: p.is_private,
      isToday: p.is_today,
      penaltyAmount: p.penalty_amount,
      deadlineTime: p.deadline_time,
      submittedAt: p.submitted_at,
      verifiedTime: `Verified ${new Date(p.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      mainImage: rawUrl,
      selfiePiP: null,
      telemetry: p.text_reflection || "Verified Drop",
      telemetryIcon: "code",
      caption: p.text_reflection || "Daily habit completed! Consistency is the key. 💪",
      upvotes: upvotesCount,
      downvotes: downvotesCount,
      userVote: activeUserVote,
      reactions: {
        fire: upvotesCount,
        electric: p.reactions?.electric || 0,
        respect: p.reactions?.respect || 0,
        target: downvotesCount,
      },
      currentUserReaction: activeUserVote === "upvote" ? "fire" : activeUserVote === "downvote" ? "target" : null,
      commentsCount: (p as any).comments_count ?? (p as any).commentsCount ?? 0,
      timeAgo: timeAgoStr,
      proofType: computedProofType,
    };
  }, []);

  const refreshFeed = useCallback(async (currentArenas?: HabitArena[]) => {
    const arenaList = currentArenas || arenasRef.current;
    const userId = tribelyService.getCurrentUserId();

    setIsLoadingFeed(true);
    try {
      // 1. Fetch Instagram-style hybrid feed (joined squads prioritized + public discovery)
      const { posts: apiFeed, has_more } = await tribelyService.fetchFeed(30, 0);
      setHasMoreFeed(has_more);

      const mappedPosts: ProofPost[] = apiFeed.map(mapApiPostToProofPost);

      // Keep hardcoded/fallback test posts for testing as requested by user
      const persistedVotes = getPersistedVotes();
      const hydratedFallback: ProofPost[] = FALLBACK_FEED_POSTS.map((fb) => {
        const saved = persistedVotes[fb.id] || (fb.rawSubmissionId ? persistedVotes[String(fb.rawSubmissionId)] : null);
        const baseUp = fb.upvotes ?? fb.reactions?.fire ?? 0;
        const baseDown = fb.downvotes ?? fb.reactions?.target ?? 0;
        if (saved) {
          const isUp = saved.vote === "upvote";
          const isDown = saved.vote === "downvote";
          const finalUp = isUp ? baseUp + 1 : baseUp;
          const finalDown = isDown ? baseDown + 1 : baseDown;
          return {
            ...fb,
            userVote: saved.vote,
            upvotes: finalUp,
            downvotes: finalDown,
            reactions: {
              ...fb.reactions,
              fire: finalUp,
              target: finalDown,
            },
            currentUserReaction: isUp ? "fire" : isDown ? "target" : null,
          };
        }
        return fb;
      });

      const existingIds = new Set(mappedPosts.map((p) => p.id));
      const combined = [...mappedPosts, ...hydratedFallback.filter((fb) => !existingIds.has(fb.id))];

      // Sort with latest posts strictly on top (newest submittedAt or ID first)
      const sorted = combined.sort((a, b) => {
        const tA = new Date(a.submittedAt || 0).getTime();
        const tB = new Date(b.submittedAt || 0).getTime();
        if (tB !== tA) return tB - tA;
        return (Number(b.rawSubmissionId || b.id) || 0) - (Number(a.rawSubmissionId || a.id) || 0);
      });

      setFeedPosts(sorted);

      // 2. Track completed arenas today for current user
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const userCompletedArenaIds = apiFeed
        .filter((s) => s.user_id === userId && new Date(s.submitted_at) >= todayStart)
        .map((s) => String(s.arena_id));
      const uniqueCompleted = Array.from(new Set(userCompletedArenaIds));
      setCompletedArenaIdsToday(uniqueCompleted);
      if (uniqueCompleted.length > 0) {
        setUser((prev) => ({ ...prev, hasSubmittedToday: true }));
      }

      // 3. Build story tray from today's proofs
      const selfTodayProofs = apiFeed
        .filter((s) => s.user_id === userId && new Date(s.submitted_at) >= todayStart)
        .map((s) => ({
          id: String(s.id),
          imageUrl: s.proof_url,
          selfieUrl: null,
          caption: s.text_reflection || "Daily habit completed!",
          telemetry: "✅ AI Verified",
          timeAgo: tribelyService.formatTimeAgo(s.submitted_at),
          arenaTag: s.arena_tag || "#DailyHabit",
        }));

      const selfStory: StoryUser = {
        id: "self",
        name: "Your Story",
        username: tribelyService.getStoredUserName() || "you",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId || "guest"}`,
        arenaTag: arenaList[0]?.tag || "#DailyHabit",
        status: selfTodayProofs.length > 0 ? "verified" : "self",
        proofs: selfTodayProofs,
        latestProof: selfTodayProofs[0],
      };

      const userProofsMap = new Map<number, any[]>();
      const userMetaMap = new Map<number, any>();
      for (const sub of apiFeed) {
        if (sub.user_id === userId) continue;
        if (new Date(sub.submitted_at) < todayStart) continue;
        if (!userProofsMap.has(sub.user_id)) {
          userProofsMap.set(sub.user_id, []);
          userMetaMap.set(sub.user_id, sub);
        }
        userProofsMap.get(sub.user_id)!.push({
          id: String(sub.id),
          imageUrl: sub.proof_url,
          selfieUrl: null,
          caption: sub.text_reflection || "Daily habit completed!",
          telemetry: "✅ AI Verified",
          timeAgo: tribelyService.formatTimeAgo(sub.submitted_at),
          arenaTag: sub.arena_tag || "#DailyHabit",
        });
      }

      const peerStories: StoryUser[] = [];
      for (const [peerUserId, proofs] of userProofsMap.entries()) {
        const sub = userMetaMap.get(peerUserId)!;
        peerStories.push({
          id: String(peerUserId),
          name: sub.user_name || `Member #${peerUserId}`,
          username: (sub.user_handle || "member").toLowerCase().replace(/\s+/g, "_"),
          avatar: sub.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${peerUserId}`,
          arenaTag: sub.arena_tag || "#DailyHabit",
          arenaId: sub.arena_id,
          status: "verified",
          proofs: proofs,
          latestProof: proofs[0],
        });
      }
      setStoryUsers([selfStory, ...peerStories]);
    } catch {
      /* feed stays at previous value */
    } finally {
      setIsLoadingFeed(false);
    }
  }, [mapApiPostToProofPost]);

  const loadMoreFeedPosts = useCallback(async () => {
    if (isLoadingMoreFeed || !hasMoreFeed) return;
    setIsLoadingMoreFeed(true);
    try {
      const currentOffset = feedPostsRef.current.length;
      const { posts: apiFeed, has_more } = await tribelyService.fetchFeed(20, currentOffset);
      setHasMoreFeed(has_more);
      if (apiFeed.length > 0) {
        const newMapped = apiFeed.map(mapApiPostToProofPost);
        setFeedPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = newMapped.filter((p) => !existingIds.has(p.id));
          return [...prev, ...fresh];
        });
      }
    } catch {
      // silent
    } finally {
      setIsLoadingMoreFeed(false);
    }
  }, [hasMoreFeed, isLoadingMoreFeed, mapApiPostToProofPost]);

  const toggleLike = useCallback((postId: string) => {
    triggerHaptic([30, 40]);
    let targetSubId: string | number | undefined;

    setFeedPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId && String(post.rawSubmissionId) !== postId) return post;
        targetSubId = post.rawSubmissionId || String(post.id).replace(/\D/g, "");
        const isLiked = post.userVote === "upvote";
        const newVote: "upvote" | null = isLiked ? null : "upvote";
        const currentUpvotes = post.upvotes ?? post.reactions.fire;
        const newUpvotes = isLiked ? Math.max(0, currentUpvotes - 1) : currentUpvotes + 1;
        const currentDownvotes = post.downvotes ?? post.reactions.target;
        const newDownvotes = post.userVote === "downvote" ? Math.max(0, currentDownvotes - 1) : currentDownvotes;

        savePersistedVote(post.id, post.rawSubmissionId, newVote);

        return {
          ...post,
          userVote: newVote,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          reactions: {
            ...post.reactions,
            fire: newUpvotes,
            target: newDownvotes,
          },
          currentUserReaction: newVote === "upvote" ? "fire" : null,
        };
      })
    );

    if (targetSubId) {
      tribelyService.voteSubmission(targetSubId, "upvote").catch(() => {});
    }
  }, []);

  const toggleDislike = useCallback((postId: string) => {
    triggerHaptic([20, 30]);
    let targetSubId: string | number | undefined;

    setFeedPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId && String(post.rawSubmissionId) !== postId) return post;
        targetSubId = post.rawSubmissionId || String(post.id).replace(/\D/g, "");
        const isDisliked = post.userVote === "downvote";
        const newVote: "downvote" | null = isDisliked ? null : "downvote";
        const currentDownvotes = post.downvotes ?? post.reactions.target;
        const newDownvotes = isDisliked ? Math.max(0, currentDownvotes - 1) : currentDownvotes + 1;
        const currentUpvotes = post.upvotes ?? post.reactions.fire;
        const newUpvotes = post.userVote === "upvote" ? Math.max(0, currentUpvotes - 1) : currentUpvotes;

        savePersistedVote(post.id, post.rawSubmissionId, newVote);

        return {
          ...post,
          userVote: newVote,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          reactions: {
            ...post.reactions,
            fire: newUpvotes,
            target: newDownvotes,
          },
          currentUserReaction: newVote === "downvote" ? "target" : null,
        };
      })
    );

    if (targetSubId) {
      tribelyService.voteSubmission(targetSubId, "downvote").catch(() => {});
    }
  }, []);

  const joinSquad = useCallback(
    async (arenaId: number) => {
      triggerHaptic([20, 30]);
      const res = await tribelyService.joinArenaById(arenaId);
      if (res.success) {
        showToast(res.message || "Joined squad successfully!", "success");
        await Promise.all([refreshArenas(), refreshFeed()]);
        return true;
      } else {
        showToast(res.message || "Failed to join squad", "info");
        return false;
      }
    },
    [showToast, refreshArenas, refreshFeed]
  );

  // ── Fetch wallet & user profile ─────────────────────────────────────────────

  const bootstrapUser = useCallback(async () => {
    const [profile, wallet] = await Promise.all([
      tribelyService.fetchCurrentUserProfile(),
      tribelyService.fetchWallet(),
    ]);

    if (profile || wallet) {
      setUser((prev) => ({
        ...prev,
        id: profile ? String(profile.id) : prev.id,
        name: profile?.full_name || tribelyService.getStoredUserName() || prev.name,
        username: (profile?.full_name || "member").toLowerCase().replace(/\s+/g, "_"),
        avatar: profile?.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id || "guest"}`,
        kudosBalance: Math.floor(wallet?.kudos_balance ?? 0),
        streakShields: wallet?.streak_shields ?? 1,
        arenasCount: arenasRef.current.length,
      }));
    }
  }, []);

  // ── Heatmap bootstrap ───────────────────────────────────────────────────────

  const bootstrapHeatmap = useCallback(async (currentArenas: HabitArena[]) => {
    const userId = tribelyService.getCurrentUserId();
    if (!userId || !currentArenas.length) return;
    const arenaIds = currentArenas.map((a) => a.rawId);
    const days = await tribelyService.fetchAggregatedHeatmap(arenaIds, userId);
    if (days.length) {
      setHeatmapTiles(days.map(mapApiHeatmapDay));
    }
  }, []);

  // ── Full bootstrap on mount ─────────────────────────────────────────────────

  useEffect(() => {
    const userId = tribelyService.getCurrentUserId();
    if (!userId) return; // Not logged in, stay with defaults

    (async () => {
      const [loadedArenas] = await Promise.all([
        refreshArenas(),
        bootstrapUser(),
      ]);
      if (loadedArenas.length) {
        await Promise.all([
          refreshFeed(loadedArenas),
          bootstrapHeatmap(loadedArenas),
        ]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Modals ──────────────────────────────────────────────────────────────────

  const openCamera = () => { triggerHaptic([25]); setIsCameraModalOpen(true); };
  const closeCamera = () => setIsCameraModalOpen(false);

  const openStory = (storyUser: StoryUser) => {
    if (storyUser.status === "self" && !user.hasSubmittedToday) { openCamera(); return; }
    triggerHaptic([15]);
    setActiveStoryModal(storyUser);
  };
  const closeStory = () => setActiveStoryModal(null);

  const openDm = (arenaId?: string, arenaName?: string, arenaTag?: string, rawArenaId?: number) => {
    triggerHaptic([15]);
    if (arenaId && arenaName) {
      setActiveDmArena({ id: arenaId, name: arenaName, tag: arenaTag || arenaName, rawId: rawArenaId });
    } else {
      setActiveDmArena(null);
    }
    setIsDmDrawerOpen(true);
    setUnreadDmsCount(0);
  };
  const openMessagesInbox = () => {
    triggerHaptic([15]);
    setActiveDmArena(null);
    setIsDmDrawerOpen(true);
    setUnreadDmsCount(0);
  };
  const closeDm = () => setIsDmDrawerOpen(false);

  const openInstagramStoryExport = () => { triggerHaptic([20, 30]); setIsInstagramStoryExportOpen(true); };
  const closeInstagramStoryExport = () => setIsInstagramStoryExportOpen(false);

  const openProofReply = (post: ProofPost) => {
    triggerHaptic([15]);
    setActiveProofForReply(post);
    const subId = post.rawSubmissionId ? String(post.rawSubmissionId) : (String(post.id).replace(/\D/g, "") || post.id);
    if (subId) {
      tribelyService.fetchProofComments(subId).then((comments) => {
        if (comments) {
          setProofComments((prev) => ({
            ...prev,
            [post.id]: comments,
            [subId]: comments,
          }));
          setFeedPosts((prev) =>
            prev.map((p) =>
              p.id === post.id || String(p.rawSubmissionId) === subId
                ? { ...p, commentsCount: comments.length }
                : p
            )
          );
        }
      }).catch(() => {});
    }
  };
  const closeProofReply = () => setActiveProofForReply(null);

  // ── Reactions (optimistic + real) ──────────────────────────────────────────

  const toggleReaction = (postId: string, reactionType: "fire" | "electric" | "respect" | "target") => {
    triggerHaptic([25, 40]);
    setFeedPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const currentChoice = post.currentUserReaction;
        const isRemoving = currentChoice === reactionType;
        const updatedReactions = { ...post.reactions };
        if (isRemoving) {
          updatedReactions[reactionType] = Math.max(0, updatedReactions[reactionType] - 1);
        } else {
          updatedReactions[reactionType] = (updatedReactions[reactionType] || 0) + 1;
          if (currentChoice) updatedReactions[currentChoice] = Math.max(0, updatedReactions[currentChoice] - 1);
        }
        return { ...post, reactions: updatedReactions, currentUserReaction: isRemoving ? null : reactionType };
      })
    );
    // Fire & forget real API vote
    const post = feedPosts.find((p) => p.id === postId);
    if (post?.rawSubmissionId) {
      const voteType = reactionType === "target" ? "down" : "up";
      tribelyService.voteSubmission(post.rawSubmissionId, voteType).catch(() => {});
    }
  };

  // ── Proof Drop (optimistic UI + real API submission) ────────────────────────

  const dropProofOptimistic = (payload: {
    arenaId: string;
    image: string;
    selfie?: string;
    caption: string;
    telemetry?: string;
    keepOpen?: boolean;
  }) => {
    triggerHaptic([40, 80, 50]);

    const targetArena = arenas.find((a) => a.id === payload.arenaId) || arenas[0];

    // 1. Optimistic new post
    const newPost: ProofPost = {
      id: `post_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userHandle: user.username,
      userAvatar: user.avatar,
      arenaId: targetArena?.id || payload.arenaId,
      arenaTag: targetArena?.tag || "#DailyHabit",
      arenaName: targetArena?.name,
      verifiedTime: "Verified Just Now",
      mainImage: payload.image,
      selfiePiP: null as any,
      telemetry: payload.telemetry || "Manual Snap Verified • Daily Goal Met",
      telemetryIcon: "run",
      caption: payload.caption || "Habit verified today! Consistency compound interest 📈",
      reactions: { fire: 1, electric: 0, respect: 0, target: 0 },
      currentUserReaction: "fire",
      commentsCount: 0,
      timeAgo: "Just now",
      proofType:
        targetArena?.proofType?.toLowerCase() === "link" ||
        ((payload.image?.startsWith("http://") || payload.image?.startsWith("https://")) &&
          !payload.image?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i))
          ? "link"
          : "image",
    };

    setFeedPosts((prev) => [newPost, ...prev]);
    setCompletedArenaIdsToday((prev) => Array.from(new Set([...prev, String(targetArena?.id || payload.arenaId)])));

    // 2. Advance streak & kudos locally
    setUser((prev) => ({
      ...prev,
      hasSubmittedToday: true,
      currentStreak: prev.currentStreak + 1,
      kudosBalance: prev.kudosBalance + 50,
    }));

    // 3. Update heatmap: turn today green
    setHeatmapTiles((prev) =>
      prev.map((tile, idx) => {
        if (idx === prev.length - 1) {
          return {
            ...tile,
            status: "verified",
            proofTitle: `Verified in ${targetArena?.name || "Arena"}`,
            telemetrySnippet: payload.telemetry || "Daily habit accomplished",
          };
        }
        return tile;
      })
    );

    // 4. Update self story to verified
    setStoryUsers((prev) =>
      prev.map((s) => {
        if (s.id !== "self") return s;
        return {
          ...s,
          status: "verified",
          latestProof: {
            imageUrl: payload.image,
            selfieUrl: payload.selfie || user.avatar,
            caption: payload.caption,
            telemetry: payload.telemetry || "Goal achieved",
            timeAgo: "Just now",
          },
        };
      })
    );

    if (!payload.keepOpen) {
      setIsCameraModalOpen(false);
    }
    showToast("🔥 Proof verified! +1 Day Streak & 1/7th stake unlocked.", "fire");

    // 5. Real API submission (non-blocking)
    if (targetArena?.rawId) {
      tribelyService
        .uploadAndSubmitProof(targetArena.rawId, payload.image)
        .then((result) => {
          if (!result.success) {
            console.warn("Background proof submission warning:", result.message);
          }
        })
        .catch(() => {});
    }
  };

  // ── Other Actions ───────────────────────────────────────────────────────────

  const nudgePeer = (peerUser: StoryUser) => {
    triggerHaptic([30, 40]);
    showToast(`⚡ Nudged @${peerUser.username} to protect the cohort's multiplier!`, "nudge");
  };

  const claimStreakLifeline = async () => {
    triggerHaptic([30, 50]);
    if (user.streakShields >= 3) {
      showToast("Shield inventory maxed out (3/3 Shields). Use one first!", "info");
      return;
    }
    const arena = arenas[0];
    if (arena) {
      const result = await tribelyService.useStreakShield(arena.rawId);
      if (result.success) {
        setUser((prev) => ({ ...prev, streakShields: prev.streakShields + 1 }));
        showToast("🛡️ Emergency Streak Lifeline credited! Your streak is protected.", "success");
      } else {
        showToast(result.message || "Could not use shield.", "info");
      }
    } else {
      setUser((prev) => ({ ...prev, streakShields: prev.streakShields + 1 }));
      showToast("🛡️ Emergency Streak Lifeline credited! Your streak is protected.", "success");
    }
  };

  const addProofComment = async (proofId: string, text: string) => {
    if (!text.trim()) return;
    triggerHaptic([20]);
    const cleanText = text.trim();
    const tempId = `c_temp_${Date.now()}`;
    const cleanNumericId = String(proofId).replace(/\D/g, "") || proofId;
    const optimisticComment: ProofComment = {
      id: tempId,
      proofId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      text: cleanText,
      timeAgo: "Just now",
      likes: 0,
    };
    setProofComments((prev) => {
      const list = prev[proofId] || prev[cleanNumericId] || [];
      return {
        ...prev,
        [proofId]: [...list, optimisticComment],
        [cleanNumericId]: [...list, optimisticComment],
      };
    });
    setFeedPosts((prev) =>
      prev.map((p) =>
        p.id === proofId || p.id === cleanNumericId
          ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
          : p
      )
    );
    showToast("💬 Comment posted to habit thread!", "success");

    try {
      const serverComment = await tribelyService.postProofComment(cleanNumericId, cleanText);
      if (serverComment) {
        setProofComments((prev) => {
          const list = prev[proofId] || prev[cleanNumericId] || [];
          const updated = list.map((c) => (c.id === tempId ? serverComment : c));
          return {
            ...prev,
            [proofId]: updated,
            [cleanNumericId]: updated,
          };
        });
      }
    } catch (e) {
      console.error("Error posting proof comment:", e);
    }
  };

  const postDailyNote = (text: string) => {
    triggerHaptic([25]);
    const cleanText = text.trim().slice(0, 60);
    if (!cleanText) return;
    const existingSelfIndex = notes.findIndex((n) => n.isSelf);
    const updatedNote: TribeNote = {
      id: `note_self_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      isSelf: true,
      noteText: cleanText,
      timeAgo: "Just now",
      expiresAt: "Midnight",
      arenaTag: arenas[0]?.tag || "#DailyDiscipline",
    };
    if (existingSelfIndex >= 0) {
      setNotes((prev) => { const copy = [...prev]; copy[existingSelfIndex] = updatedNote; return copy; });
    } else {
      setNotes((prev) => [updatedNote, ...prev]);
    }
    showToast("✨ Mindset note posted! Disappears at midnight.", "success");
  };

  const sendTribeMessage = (
    text?: string,
    type: "text" | "audio" = "text",
    audioDuration?: string,
    audioWaveform?: number[]
  ) => {
    triggerHaptic([20]);
    const newMsg: TribeMessage = {
      id: `msg_${Date.now()}`,
      arenaId: activeDmArena?.id || arenas[0]?.id || "0",
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      isSelf: true,
      type,
      text: text || (type === "audio" ? "Voice Note" : ""),
      audioDuration,
      audioWaveform: audioWaveform || [40, 70, 95, 60, 85, 100, 70, 50, 80, 90],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      reactions: {},
      currentUserReactions: [],
    };
    setTribeMessages((prev) => [...prev, newMsg]);

    // Real API message (non-blocking)
    if (activeDmArena?.rawId && text) {
      tribelyService.sendMessage(activeDmArena.rawId, text, type).catch(() => {});
    }
  };

  const sendQuickNudge = (targetUserId: string, nudgeText: string) => {
    triggerHaptic([30, 40]);
    sendTribeMessage(nudgeText, "text");
    showToast(`⚡ Sent accountability poke: "${nudgeText}"`, "nudge");
  };

  const reactToMessage = (messageId: string, emoji: string) => {
    triggerHaptic([15]);
    setTribeMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const currentReactions = { ...msg.reactions };
        const userReactions = msg.currentUserReactions || [];
        const hasReacted = userReactions.includes(emoji);
        if (hasReacted) {
          currentReactions[emoji] = Math.max(0, (currentReactions[emoji] || 1) - 1);
          return { ...msg, reactions: currentReactions, currentUserReactions: userReactions.filter((e) => e !== emoji) };
        } else {
          currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
          return { ...msg, reactions: currentReactions, currentUserReactions: [...userReactions, emoji] };
        }
      })
    );
  };

  const isArenaCompletedToday = useCallback(
    (arenaId: string | number) => completedArenaIdsToday.includes(String(arenaId)),
    [completedArenaIdsToday]
  );

  const triggerSuperProp = useCallback(
    (postId: string, type: SuperPropType) => {
      triggerHaptic([40, 60, 40]);
      const config = {
        lightning: { emoji: "⚡", title: "Lightning Boost!" },
        crown: { emoji: "👑", title: "Crown Respect Drop!" },
        diamond: { emoji: "💎", title: "Diamond Focus Drop!" },
      }[type];

      const burst: SuperPropBurst = {
        id: Math.random().toString(36).substring(2, 9),
        postId,
        type,
        emoji: config.emoji,
        title: config.title,
      };

      setActiveSuperPropBurst(burst);
      showToast(`Sent ${config.emoji} ${config.title} to peer!`, "fire");
      setTimeout(() => {
        setActiveSuperPropBurst((cur) => (cur?.id === burst.id ? null : cur));
      }, 2500);
    },
    [showToast]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        activeTab,
        setActiveTab,
        arenas,
        feedPosts,
        storyUsers,
        heatmapTiles,
        notes,
        tribeMessages,
        activeProofForReply,
        proofComments,
        isCameraModalOpen,
        activeStoryModal,
        isDmDrawerOpen,
        activeDmArena,
        unreadDmsCount,
        isInstagramStoryExportOpen,
        toast,
        isLoadingFeed,
        isLoadingArenas,
        completedArenaIdsToday,
        isArenaCompletedToday,
        activeSuperPropBurst,
        triggerSuperProp,
        openCamera,
        closeCamera,
        openStory,
        closeStory,
        openDm,
        openMessagesInbox,
        closeDm,
        openInstagramStoryExport,
        closeInstagramStoryExport,
        openProofReply,
        closeProofReply,
        addProofComment,
        postDailyNote,
        sendTribeMessage,
        sendQuickNudge,
        reactToMessage,
        toggleReaction,
        toggleLike,
        toggleDislike,
        dropProofOptimistic,
        nudgePeer,
        claimStreakLifeline,
        triggerHaptic,
        showToast,
        refreshFeed: () => refreshFeed(),
        refreshArenas,
        hasMoreFeed,
        loadMoreFeedPosts,
        joinSquad,
        viewedStoryUserIds,
        markStoryAsViewed,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
};
