"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { tribelyService, ApiArena, ApiSubmission, ApiHeatmapDay, ApiMessage } from "@/services/tribely.service";
import { resolveBackendUrl } from "@/lib/api-client";
import { parseSafeUtcDate } from "@/lib/utils";

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
  multiplier: number;
  tierBadge: string;
  hasSubmittedToday: boolean;
  followingCount: number;
  followersCount: number;
  arenasCount: number;
  email?: string;
  phone?: string;
  proofsCount?: number;
  isVerified?: boolean;
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
  status: "verified" | "absent" | "today_pending" | "future";
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
    type: "proof_drop" | "multiplier_boost";
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

export const FALLBACK_FEED_POSTS: ProofPost[] = [];

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
    userAvatar: sub.user_avatar_url ? resolveBackendUrl(sub.user_avatar_url) : "",
    arenaId: String(sub.arena_id),
    arenaTag: arena?.tag || `#Arena${sub.arena_id}`,
    arenaName: arena?.name,
    submittedAt: sub.submitted_at,
    verifiedTime: `Verified ${parseSafeUtcDate(sub.submitted_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}`,
    mainImage: sub.proof_url || "",
    selfiePiP: null as any,
    telemetry: sub.text_reflection || "Verified Proof",
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
    absent: "absent",
    today_pending: "today_pending",
  };
  return {
    date: day.date,
    dayOfMonth: date.getDate(),
    status: statusMap[day.status] || "absent",
    proofTitle: day.status === "present" ? "Habit Completed ✅" :
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
      status: i === 0 ? "today_pending" : "absent",
      proofTitle: i === 0 ? "Today: Awaiting Proof" : "Missed / No Proof",
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

  openCamera: (arenaId?: string | number | unknown) => void;
  closeCamera: () => void;
  initialCameraArenaId: string | null;
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
  triggerHaptic: (pattern?: number[]) => void;
  showToast: (message: string, type?: ToastNotification["type"]) => void;
  refreshFeed: () => Promise<void>;
  refreshArenas: () => void;
  hasMoreFeed: boolean;
  loadMoreFeedPosts: () => Promise<void>;
  joinSquad: (arenaId: number) => Promise<boolean>;
  viewedStoryUserIds: Set<string>;
  markStoryAsViewed: (storyUserId: string) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Default / Guest user profile & Device Storage Hydration
// ─────────────────────────────────────────────────────────────────────────────

function buildGuestUser(): UserProfile {
  return {
    id: "guest",
    name: "Spotter",
    username: "member",
    avatar: "",
    bio: "Building daily habits with Tribely 🚀",
    kudosBalance: 0,
    currentStreak: 0,
    longestStreak: 0,
    multiplier: 1.0,
    tierBadge: "🌱 Day 0 Starter",
    hasSubmittedToday: false,
    followingCount: 0,
    followersCount: 0,
    arenasCount: 0,
    proofsCount: 0,
    isVerified: false,
  };
}

export function getStoredInitialUser(): UserProfile {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("user");
      const storedId = localStorage.getItem("tribely_user_id");
      const storedName = localStorage.getItem("tribely_user_name");
      const token =
        localStorage.getItem("tribely_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token");

      if (token && (stored || storedId || storedName)) {
        const parsed = stored ? JSON.parse(stored) : {};
        const id = String(parsed.id || storedId || "user");
        const name = parsed.full_name || storedName || parsed.name || "Spotter";
        const username = parsed.username || (name || "member").toLowerCase().replace(/\s+/g, "_");
        const storedAvatar = localStorage.getItem("tribely_user_avatar");
        const rawAvatar = parsed.avatar_url || parsed.avatar || parsed.profile_image_url || storedAvatar || "";
        const avatar = rawAvatar && !rawAvatar.includes("dicebear.com") ? resolveBackendUrl(rawAvatar) : "";

        return {
          id,
          name,
          username,
          avatar,
          bio: parsed.bio || "Building daily habits with Tribely 🚀",
          kudosBalance: Number(parsed.kudos_balance ?? parsed.kudosBalance ?? 0),
          currentStreak: Number(parsed.current_streak ?? parsed.currentStreak ?? 0),
          longestStreak: Number(parsed.longest_streak ?? parsed.longestStreak ?? 0),
          multiplier: 1.0,
          tierBadge:
            (parsed.current_streak || 0) >= 30
              ? "👑 Habit Legend"
              : (parsed.current_streak || 0) >= 14
              ? "⚡ Unstoppable"
              : (parsed.current_streak || 0) >= 7
              ? "🔥 Momentum"
              : "🌱 Day 0 Starter",
          hasSubmittedToday: Boolean(parsed.hasSubmittedToday),
          followingCount: parsed.followingCount || 0,
          followersCount: parsed.followersCount || 0,
          arenasCount: parsed.arenas_count || 0,
          proofsCount: parsed.proofs_count || 0,
          isVerified: Boolean(parsed.is_verified || parsed.isVerified),
          email: parsed.email,
          phone: parsed.phone_number || parsed.phone,
        };
      }
    } catch {}
  }
  return buildGuestUser();
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: React.ReactNode; initialTab?: NavTab }> = ({ children, initialTab = "feed" }) => {
  const [user, setUser] = useState<UserProfile>(buildGuestUser);

  // Synchronously hydrate stored user on mount to eliminate any guest flash
  useEffect(() => {
    try {
      const initial = getStoredInitialUser();
      if (initial.id !== "guest") {
        setUser((prev) => (prev.id === "guest" ? initial : prev));
      }
    } catch {}
  }, []);
  const [activeTab, setActiveTab] = useState<NavTab>(initialTab);
  const [arenas, setArenas] = useState<HabitArena[]>([]);
  const [feedPosts, setFeedPosts] = useState<ProofPost[]>([]);
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [heatmapTiles, setHeatmapTiles] = useState<HeatmapTile[]>(generate30DayFallback());
  const [notes, setNotes] = useState<TribeNote[]>([]);
  const [tribeMessages, setTribeMessages] = useState<TribeMessage[]>([]);
  const [activeProofForReply, setActiveProofForReply] = useState<ProofPost | null>(null);
  const [proofComments, setProofComments] = useState<Record<string, ProofComment[]>>({});
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [initialCameraArenaId, setInitialCameraArenaId] = useState<string | null>(null);
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
    const rawUrl = resolveBackendUrl(p.proof_url || p.media_url || "");
    const isYouTube = rawUrl.includes("youtube.com") || rawUrl.includes("youtu.be");
    const isVideo =
      p.proof_type === "video" ||
      Boolean(rawUrl.match(/\.(mp4|webm|mov|ogg)($|\?|&)/i)) ||
      rawUrl.startsWith("data:video/");

    const isImg =
      !isVideo &&
      !isYouTube &&
      (rawUrl.startsWith("data:image/") ||
        rawUrl.startsWith("blob:") ||
        rawUrl.includes("images.unsplash.com") ||
        rawUrl.includes("cloudinary.com") ||
        rawUrl.includes("amazonaws.com") ||
        rawUrl.includes("imgur.com") ||
        rawUrl.includes("cdn.") ||
        Boolean(rawUrl.match(/\.(jpeg|jpg|gif|png|webp|avif|bmp|svg)($|\?|&)/i)));

    let computedProofType = "image";
    if (isYouTube) {
      computedProofType = "youtube";
    } else if (isVideo) {
      computedProofType = "video";
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

      const subDate = parseSafeUtcDate(p.submitted_at);
      const verifiedFormattedTime = subDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

      const rawCaption = (p.caption || p.text_reflection || "").trim();
      const isAiCaption = !rawCaption || /ai auto-audit|confidence|\bauto-audit\b|invalid image proof format/i.test(rawCaption);
      let resolvedCaption = rawCaption;
      if (isAiCaption) {
        resolvedCaption = subDate.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
      }

      return {
        id: String(p.id),
        rawSubmissionId: p.id,
        userId: String(p.user_id),
        userName: p.user_name,
        userHandle: p.user_handle || `user${p.user_id}`,
        userAvatar: p.user_avatar ? resolveBackendUrl(p.user_avatar) : "",
        arenaId: String(p.arena_id),
        arenaName: p.arena_name,
        arenaTag: p.arena_tag || "#DailyHabit",
        isJoined: p.is_joined,
        isPrivate: p.is_private,
        isToday: p.is_today,
        penaltyAmount: p.penalty_amount,
        deadlineTime: p.deadline_time,
        submittedAt: p.submitted_at,
        verifiedTime: `Verified ${verifiedFormattedTime}`,
        mainImage: rawUrl,
        selfiePiP: null,
        telemetry: isAiCaption ? "Verified Drop" : (p.text_reflection || "Verified Drop"),
        telemetryIcon: "code",
        caption: resolvedCaption,
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

      const isTestEntity = (name?: string, handle?: string, arenaName?: string) => {
        const n = (name || "").toLowerCase();
        const h = (handle || "").toLowerCase();
        const a = (arenaName || "").toLowerCase();
        return (
          n.includes("test") || n.includes("phase") || n.includes("smoke") ||
          h.includes("test") || h.includes("phase") || h.includes("smoke") ||
          h.startsWith("member_") || h.startsWith("sub_") || h.startsWith("creator_") ||
          a.includes("test") || a.includes("phase") || a.includes("keyset") || a.includes("smoke")
        );
      };

      const mappedPosts: ProofPost[] = apiFeed
        .filter((p) => !isTestEntity(p.user_name, p.user_handle, p.arena_name))
        .map(mapApiPostToProofPost);

      // Priority sorting algorithm:
      // Tier 0: Joined arena proofs (isJoined = true) sorted latest first
      // Tier 1: Public discovery proofs (isJoined = false) sorted latest first
      const sorted = mappedPosts.sort((a, b) => {
        const rankA = a.isJoined ? 0 : 1;
        const rankB = b.isJoined ? 0 : 1;
        if (rankA !== rankB) return rankA - rankB;

        const tA = new Date(a.submittedAt || 0).getTime();
        const tB = new Date(b.submittedAt || 0).getTime();
        if (tB !== tA) return tB - tA;

        return (Number(b.rawSubmissionId || b.id) || 0) - (Number(a.rawSubmissionId || a.id) || 0);
      });

      setFeedPosts(sorted);

      // 2. Track completed arenas today for current user
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const userCompletedArenaIds = apiFeed
        .filter((s) => s.user_id === userId && parseSafeUtcDate(s.submitted_at).getTime() >= todayStart.getTime())
        .map((s) => String(s.arena_id));
      const uniqueCompleted = Array.from(new Set(userCompletedArenaIds));
      setCompletedArenaIdsToday(uniqueCompleted);
      if (uniqueCompleted.length > 0) {
        setUser((prev) => ({ ...prev, hasSubmittedToday: true }));
      }

      // 3. Build story tray from today's proofs
      const selfTodayProofs = apiFeed
        .filter((s) => s.user_id === userId && parseSafeUtcDate(s.submitted_at).getTime() >= todayStart.getTime())
        .map((s) => ({
          id: String(s.id),
          imageUrl: resolveBackendUrl(s.proof_url),
          selfieUrl: null,
          caption: s.text_reflection || "Daily habit completed!",
          telemetry: "Verified Proof",
          timeAgo: tribelyService.formatTimeAgo(s.submitted_at),
          arenaTag: s.arena_tag || "#DailyHabit",
        }));

      const resolvedSelfAvatar = (() => {
        if (user.avatar) return resolveBackendUrl(user.avatar);
        if (typeof window !== "undefined") {
          try {
            const rawStored = localStorage.getItem("user");
            if (rawStored) {
              const parsed = JSON.parse(rawStored);
              const a = parsed.avatar_url || parsed.avatar || parsed.profile_image_url;
              if (a) return resolveBackendUrl(a);
            }
          } catch {}
        }
        return "";
      })();

      const selfStory: StoryUser = {
        id: "self",
        name: "Your Story",
        username: user.username || tribelyService.getStoredUserName() || "you",
        avatar: resolvedSelfAvatar,
        arenaTag: arenaList[0]?.tag || "#DailyHabit",
        status: selfTodayProofs.length > 0 ? "verified" : "self",
        proofs: selfTodayProofs,
        latestProof: selfTodayProofs[0],
      };

      const userProofsMap = new Map<number, any[]>();
      const userMetaMap = new Map<number, any>();
      for (const sub of apiFeed) {
        if (sub.user_id === userId) continue;
        if (parseSafeUtcDate(sub.submitted_at).getTime() < todayStart.getTime()) continue;
        if (!userProofsMap.has(sub.user_id)) {
          userProofsMap.set(sub.user_id, []);
          userMetaMap.set(sub.user_id, sub);
        }
        userProofsMap.get(sub.user_id)!.push({
          id: String(sub.id),
          imageUrl: resolveBackendUrl(sub.proof_url),
          selfieUrl: null,
          caption: sub.text_reflection || "Daily habit completed!",
          telemetry: "Verified Proof",
          timeAgo: tribelyService.formatTimeAgo(sub.submitted_at),
          arenaTag: sub.arena_tag || "#DailyHabit",
        });
      }

      const peerStories: StoryUser[] = [];
      for (const [peerUserId, proofs] of userProofsMap.entries()) {
        const sub = userMetaMap.get(peerUserId)!;
        if (isTestEntity(sub.user_name, sub.user_handle, sub.arena_name)) continue;
        peerStories.push({
          id: String(peerUserId),
          name: sub.user_name || `Member #${peerUserId}`,
          username: (sub.user_handle || "member").toLowerCase().replace(/\s+/g, "_"),
          avatar: sub.user_avatar ? resolveBackendUrl(sub.user_avatar) : "",
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
          const combined = [...prev, ...fresh];
          return combined.sort((a, b) => {
            const rankA = a.isJoined ? 0 : 1;
            const rankB = b.isJoined ? 0 : 1;
            if (rankA !== rankB) return rankA - rankB;
            const tA = new Date(a.submittedAt || 0).getTime();
            const tB = new Date(b.submittedAt || 0).getTime();
            if (tB !== tA) return tB - tA;
            return (Number(b.rawSubmissionId || b.id) || 0) - (Number(a.rawSubmissionId || a.id) || 0);
          });
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
    try {
      const [profile, wallet] = await Promise.all([
        tribelyService.fetchCurrentUserProfile(),
        tribelyService.fetchWallet(),
      ]);

      if (profile || wallet) {
        let confirmedAvatar = "";
        setUser((prev) => {
          const kudos = wallet?.kudos_balance !== undefined
            ? Math.floor(wallet.kudos_balance)
            : (profile?.kudos_balance ?? prev.kudosBalance);
          const currStreak = profile?.current_streak ?? prev.currentStreak;
          const longStreak = profile?.longest_streak ?? prev.longestStreak;
          const badge = currStreak >= 30 ? "👑 Habit Legend" : currStreak >= 14 ? "⚡ Unstoppable" : currStreak >= 7 ? "🔥 Momentum" : "🌱 Day 0 Starter";

          const raw = profile?.profile_image_url || profile?.avatar_url || "";
          if (raw && !raw.includes("dicebear.com")) {
            confirmedAvatar = resolveBackendUrl(raw);
          } else if (prev.avatar && !prev.avatar.includes("dicebear.com")) {
            confirmedAvatar = prev.avatar;
          }

          const nextUser: UserProfile = {
            ...prev,
            id: profile ? String(profile.id) : prev.id,
            name: profile?.full_name || tribelyService.getStoredUserName() || prev.name,
            username: profile?.username || (profile?.full_name || "member").toLowerCase().replace(/\s+/g, "_"),
            avatar: confirmedAvatar,
            email: profile?.email || prev.email,
            phone: profile?.phone_number || prev.phone,
            kudosBalance: kudos,
            currentStreak: currStreak,
            longestStreak: longStreak,
            tierBadge: badge,
            arenasCount: profile?.arenas_count ?? arenasRef.current.length,
            proofsCount: profile?.proofs_count ?? prev.proofsCount ?? 0,
            isVerified: Boolean(profile?.is_verified),
          };

          // Persist full profile to device storage
          if (typeof window !== "undefined") {
            try {
              const stored = localStorage.getItem("user");
              const parsed = stored ? JSON.parse(stored) : {};
              localStorage.setItem(
                "user",
                JSON.stringify({
                  ...parsed,
                  id: nextUser.id,
                  full_name: nextUser.name,
                  name: nextUser.name,
                  username: nextUser.username,
                  avatar_url: nextUser.avatar,
                  profile_image_url: nextUser.avatar,
                  avatar: nextUser.avatar,
                  bio: nextUser.bio,
                  phone_number: nextUser.phone,
                  email: nextUser.email,
                  kudos_balance: nextUser.kudosBalance,
                  current_streak: nextUser.currentStreak,
                  longest_streak: nextUser.longestStreak,
                  arenas_count: nextUser.arenasCount,
                  proofs_count: nextUser.proofsCount,
                  is_verified: nextUser.isVerified,
                })
              );
              if (nextUser.name) localStorage.setItem("tribely_user_name", nextUser.name);
              if (nextUser.id && nextUser.id !== "guest") localStorage.setItem("tribely_user_id", nextUser.id);
            } catch {}
          }

          return nextUser;
        });

        if (confirmedAvatar) {
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("tribely_user_avatar", confirmedAvatar);
            } catch {}
          }
          setStoryUsers((prev) =>
            prev.map((s) => (s.id === "self" ? { ...s, avatar: confirmedAvatar } : s))
          );
        }
      }
    } catch {}
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
    const hasToken = typeof window !== "undefined" && Boolean(
      localStorage.getItem("tribely_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("access_token")
    );
    const userId = tribelyService.getCurrentUserId();
    if (!userId && !hasToken) return; // Not logged in, stay with defaults

    let isSubscribed = true;
    (async () => {
      const [loadedArenas] = await Promise.all([
        refreshArenas(),
        bootstrapUser(),
      ]);
      if (!isSubscribed) return;
      if (loadedArenas.length) {
        await Promise.all([
          refreshFeed(loadedArenas),
          bootstrapHeatmap(loadedArenas),
        ]);
      } else {
        await refreshFeed([]);
        // If initial load was empty (e.g. backend cold start waking up on Render), retry once silently after 3.5s
        setTimeout(async () => {
          if (!isSubscribed) return;
          const [retriedArenas] = await Promise.all([
            refreshArenas(),
            bootstrapUser(),
          ]);
          if (retriedArenas.length) {
            refreshFeed(retriedArenas);
          }
        }, 3500);
      }
    })();

    return () => {
      isSubscribed = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time synchronization for Kudos balance updates
  useEffect(() => {
    const handleKudosUpdate = (event: any) => {
      if (typeof event.detail?.kudos_balance === "number") {
        setUser((prev) => ({ ...prev, kudosBalance: Math.floor(event.detail.kudos_balance) }));
      } else {
        bootstrapUser();
      }
    };
    const handleRefreshWallet = () => {
      bootstrapUser();
    };
    window.addEventListener("kudos_balance_updated", handleKudosUpdate);
    window.addEventListener("refresh_wallet", handleRefreshWallet);
    return () => {
      window.removeEventListener("kudos_balance_updated", handleKudosUpdate);
      window.removeEventListener("refresh_wallet", handleRefreshWallet);
    };
  }, [bootstrapUser]);

  // ── Modals ──────────────────────────────────────────────────────────────────

  const openCamera = (arenaId?: string | number | unknown) => {
    triggerHaptic([25]);
    const validArenaId =
      typeof arenaId === "string" && arenaId.trim().length > 0
        ? arenaId.trim()
        : typeof arenaId === "number"
        ? String(arenaId)
        : null;
    setInitialCameraArenaId(validArenaId);
    setIsCameraModalOpen(true);
  };
  const closeCamera = () => {
    setIsCameraModalOpen(false);
    setInitialCameraArenaId(null);
  };

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
      submittedAt: new Date().toISOString(),
      verifiedTime: "Just now",
      mainImage: payload.image,
      selfiePiP: null as any,
      telemetry: payload.telemetry || "Manual Snap Verified • Daily Goal Met",
      telemetryIcon: "run",
      caption: (payload.caption || "").trim() || new Date().toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }),
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
        .uploadAndSubmitProof(targetArena.rawId, payload.image, payload.caption)
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

  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== "undefined") {
        if (updates.name) localStorage.setItem("tribely_user_name", updates.name);
        try {
          const storedUser = localStorage.getItem("user");
          const parsed = storedUser ? JSON.parse(storedUser) : {};
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...parsed,
              id: next.id,
              full_name: next.name,
              name: next.name,
              username: next.username,
              avatar_url: next.avatar,
              profile_image_url: next.avatar,
              avatar: next.avatar,
              bio: next.bio,
              phone_number: next.phone,
              kudos_balance: next.kudosBalance,
              current_streak: next.currentStreak,
              longest_streak: next.longestStreak,
            })
          );
        } catch {}
      }
      return next;
    });

    if (updates.avatar) {
      const newAvatar = updates.avatar;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("tribely_user_avatar", newAvatar);
        } catch {}
      }
      setStoryUsers((prev) =>
        prev.map((s) =>
          s.id === "self" ? { ...s, avatar: newAvatar } : s
        )
      );
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.userId === user.id || p.userId === String(user.id) ? { ...p, userAvatar: newAvatar } : p
        )
      );
      setNotes((prev) =>
        prev.map((n) =>
          n.userId === user.id || n.userId === String(user.id) || n.isSelf ? { ...n, userAvatar: newAvatar } : n
        )
      );
    }
  }, [user.id]);

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
        initialCameraArenaId,
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
        triggerHaptic,
        showToast,
        refreshFeed: () => refreshFeed(),
        refreshArenas,
        hasMoreFeed,
        loadMoreFeedPosts,
        joinSquad,
        viewedStoryUserIds,
        markStoryAsViewed,
        updateUserProfile,
        refreshUser: bootstrapUser,
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
