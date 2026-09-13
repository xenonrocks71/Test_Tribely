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
  streakShields: number;
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
  streakShields: number;
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
