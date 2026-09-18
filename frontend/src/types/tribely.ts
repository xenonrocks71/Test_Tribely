/**
 * Tribely Core Domain & UI Type Definitions.
 * High-signal domain models for SDE-1 interview-grade architecture.
 */

export type ProofType = "image" | "link" | "text";

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface Wallet {
  userId: number;
  balance: number;
  tribesBalance: number;
  kudosBalance: number;
  inrValue: number;
  isFrozen: boolean;
  version: number;
  referralCount: number;
  updatedAt?: string;
}

export interface Arena {
  id: number;
  title: string;
  name: string;
  description?: string;
  category: string;
  proofType: ProofType;
  isPrivate: boolean;
  inviteCode: string;
  entryDeposit: number;
  dailyPenalty: number;
  penaltyAmount: number;
  dailyCutoffTime: string;
  deadlineTime: string;
  timezone: string;
  memberCount?: number;
  vaultPool?: number;
  entry_stake?: number;
  pool_balance?: number;
  isJoined?: boolean;
  userRole?: string;
}

export interface ArenaMember {
  id: number;
  arenaId: number;
  userId: number;
  role: string;
  currentStreak: number;
  isActive: boolean;
  joinedAt: string;
  user?: User;
}

export interface ProofReactionsMap {
  fire: number;
  electric: number;
  respect: number;
  target: number;
}

export interface ProofItem {
  id: number;
  arenaId: number;
  arenaName: string;
  arenaTag: string;
  isJoined?: boolean;
  isPrivate?: boolean;
  userId: number;
  userName: string;
  userHandle: string;
  userAvatar?: string | null;
  mediaUrl: string;
  selfieUrl?: string | null;
  proofType: ProofType;
  caption?: string;
  telemetryData?: Record<string, any>;
  submissionDate: string;
  createdAt: string;
  reactions: ProofReactionsMap;
  currentUserReactions?: string[];
  hasUserReacted?: boolean;
  aiStatus?: string;
  aiConfidenceScore?: number;
  aiAuditNotes?: string;
}

export interface KeysetFeedResponse {
  items: ProofItem[];
  nextCursor?: string | null;
  hasMore: boolean;
  count: number;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  fields?: Record<string, string>;
}

export interface ProofComment {
  id: string;
  rawId?: number;
  proofId: string;
  submissionId?: number;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  createdAt?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kudos Virtual Currency & Gamified Staking Economy Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type KudosTransactionType =
  | "SIGNUP_BONUS"
  | "ARENA_STAKE"
  | "DEADLINE_PENALTY"
  | "WEEKLY_PAYOUT";

export interface KudosTransaction {
  id: number;
  user_id: number;
  arena_id?: number | null;
  amount: number;
  type: KudosTransactionType | string;
  description?: string | null;
  created_at: string;
}

export interface KudosWallet {
  user_id: number;
  kudos_balance: number;
  recent_transactions: KudosTransaction[];
}

export interface WeeklyDistributionWinner {
  user_id: number;
  user_name: string;
  avatar_url?: string | null;
  rank: number;
  streak_count: number;
  reward_kudos: number;
}

export interface WeeklyDistributionResponse {
  status: string;
  message: string;
  arena_id: number;
  total_pool_before: number;
  payout_pool: number;
  pool_balance_remaining: number;
  winners: WeeklyDistributionWinner[];
}

export interface LeaderboardMember {
  user_id: number;
  user_name: string;
  user_handle: string;
  avatar_url?: string | null;
  rank: number;
  badge: string;
  streak_count: number;
  verified_submissions: number;
  projected_weekly_kudos: number;
}

export interface ArenaPoolDetails {
  arena_id: number;
  title: string;
  pool_balance: number;
  entry_stake: number;
  penalty_amount: number;
  weekly_prize_pool: number;
  active_members_count: number;
  cached_from_redis: boolean;
  recent_winners: WeeklyDistributionWinner[];
}

export interface ArenaJoinStakeResponse {
  status: string;
  message: string;
  arena_id: number;
  entry_stake_deducted: number;
  user_kudos_balance: number;
  pool_balance: number;
}

export interface PenaltyMissedResponse {
  status: string;
  message: string;
  arena_id: number;
  user_id: number;
  penalty_deducted: number;
  user_kudos_balance: number;
  pool_balance: number;
  streak_reset_to: number;
}
