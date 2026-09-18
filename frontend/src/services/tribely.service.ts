/**
 * Tribely Unified Data Service Layer
 * Centralizes all authenticated API calls for the frontend.
 */

import { apiClient } from "@/lib/api-client";
import { parseSafeUtcDate } from "@/lib/utils";
import {
  ProofComment,
  KudosWallet,
  KudosTransaction,
  ArenaPoolDetails,
  LeaderboardMember,
  WeeklyDistributionResponse,
  ArenaJoinStakeResponse,
  PenaltyMissedResponse
} from "@/types/tribely";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface ApiUser {
  id: number;
  full_name: string;
  email: string;
  username?: string;
  phone_number?: string | null;
  profile_image_url?: string | null;
  avatar_url?: string | null;
  contextual_role?: string;
  is_verified?: boolean;
  kudos_balance?: number;
  current_streak?: number;
  longest_streak?: number;
  arenas_count?: number;
  proofs_count?: number;
  created_at?: string;
}

export interface ApiWallet {
  user_id: number;
  tribes_balance: number;
  kudos_balance: number;
  inr_value: number;
  is_frozen: boolean;
  referral_count: number;
  recent_transactions: ApiTransaction[];
}

export interface ApiTransaction {
  id: number;
  transaction_type: string;
  amount_tribes: number;
  amount_kudos: number;
  debit_account?: string;
  credit_account?: string;
  description?: string;
  created_at?: string;
}

export interface ApiArena {
  id: number;
  name: string;
  description?: string;
  proof_type?: string;
  deadline_time?: string;
  penalty_amount?: number;
  invite_code?: string;
  is_private?: boolean;
  member_count?: number;
  membership_status?: string;
  user_role?: string;
  last_activity_at?: string;
  last_activity_snippet?: string;
}

export interface ApiSubmission {
  id: number;
  user_id: number;
  arena_id: number;
  proof_url: string;
  submitted_at: string;
  user_name: string;
  user_avatar_url?: string | null;
  upvotes: number;
  downvotes: number;
  is_absent: boolean;
  user_vote?: string | null;
  voters?: { user_id: number; user_name: string; user_avatar_url?: string }[];
  ai_confidence_score?: number;
  ai_status?: string;
  ai_audit_notes?: string | null;
  text_reflection?: string;
}

export interface ApiArenaHistory {
  submissions: ApiSubmission[];
  messages: ApiMessage[];
  active_call?: unknown;
  twenty_one_day_stats?: unknown;
  user_is_seized: boolean;
  user_kudos_balance: number;
}

export interface ApiMessage {
  id: number;
  user_id: number;
  content: string;
  message_type: string;
  created_at: string;
  sender_name: string;
  sender_avatar_url?: string | null;
}

export interface ApiNotification {
  id: number | string;
  arena_id?: number | null;
  arena_name?: string | null;
  event_type: "proof_submission" | "join_request" | "member_joined" | "join_approved" | "chat_message" | "call_invite" | "streak" | string;
  title: string;
  body: string;
  is_read?: boolean;
  created_at?: string;
  target_user_id?: number;
  target_user_name?: string;
  target_user_avatar?: string | null;
  status?: "pending" | "approved" | "rejected" | string;
  is_admin_actionable?: boolean;
  data?: {
    arena_id?: number;
    arena_name?: string;
    user_id?: number;
    user_name?: string;
    action_type?: string;
    status?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface ApiStreak {
  current_streak: number;
  max_streak: number;
  badge_tier: string;
  rule: string;
}

export interface ApiFeedPost {
  id: number;
  arena_id: number;
  arena_name: string;
  arena_tag: string;
  is_private: boolean;
  is_joined: boolean;
  proof_type?: string;
  penalty_amount: number;
  deadline_time: string;
  user_id: number;
  user_name: string;
  user_handle: string;
  user_avatar?: string | null;
  proof_url: string;
  submitted_at: string;
  upvotes: number;
  downvotes: number;
  user_vote?: string | null;
  is_today?: boolean;
  reactions: Record<string, number>;
  current_user_reaction?: string | null;
  text_reflection?: string;
  comments_count?: number;
  commentsCount?: number;
}

export interface ApiSquadMember {
  user_id: number;
  user_name: string;
  user_handle: string;
  user_avatar?: string | null;
  role: string;
  has_submitted_today: boolean;
  is_current_user: boolean;
  consistency_rate?: number;
  streak_days?: number;
}

export interface ApiEscrowTransaction {
  id: string | number;
  type: "deposit" | "penalty" | "reward" | "stake";
  user_id?: number | null;
  user_name: string;
  user_avatar?: string | null;
  amount: number;
  description: string;
  created_at: string;
  formatted_time?: string;
  tx_hash?: string;
}

export interface ApiEscrowSummary {
  total_vault_amount: number;
  member_stakes_pool: number;
  penalty_pool: number;
  reward_pool: number;
  cycle_days_remaining: number;
  cycle_days_total: number;
  currency_symbol?: string;
}

export interface ApiArenaDetail {
  id: number;
  name: string;
  tag: string;
  category?: string;
  icon_url?: string;
  description: string;
  invite_code: string;
  proof_type: string;
  penalty_amount: number;
  deadline_time: string;
  is_private: boolean;
  creator_id: number;
  is_joined: boolean;
  membership_status?: string | null;
  user_role?: string | null;
  member_count: number;
  sprint_vault: number;
  escrow_summary?: ApiEscrowSummary;
  ledger_transactions?: ApiEscrowTransaction[];
  multiplier: number;
  user_submitted_today: boolean;
  is_locked?: boolean;
  unlock_time?: string | null;
  cycle_cutoff_time?: string | null;
  cycle_date?: string | null;
  timezone?: string;
  members: ApiSquadMember[];
}

export interface ApiHeatmapDay {
  date: string;
  day_of_week: string;
  status: "present" | "absent" | "today_pending";
  proof_type?: string | null;
  ai_confidence?: number | null;
}

export interface ApiHeatmapData {
  arena_id: number;
  user_id: number;
  days_count: number;
  matrix: ApiHeatmapDay[];
  present_count: number;
  absent_count: number;
  consistency_percentage: number;
}

export interface SubmitProofPayload {
  arena_id: number;
  proof_url: string;
  caption?: string;
  client_submitted_at?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getStoredUserId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("tribely_user_id");
  const parsed = parseInt(raw || "", 10);
  return isNaN(parsed) ? null : parsed;
}

function getStoredUserName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("tribely_user_name") || "";
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

class TribelyService {
  getCurrentUserId(): number | null {
    return getStoredUserId();
  }

  getStoredUserName(): string {
    return getStoredUserName();
  }

  async fetchCurrentUserProfile(): Promise<ApiUser | null> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiUser }>(
        "/api/users/profile/me"
      );
      const user = res.data ?? null;
      if (user && typeof window !== "undefined") {
        if (user.id) localStorage.setItem("tribely_user_id", String(user.id));
        if (user.full_name) localStorage.setItem("tribely_user_name", user.full_name);
      }
      return user;
    } catch {
      const userId = getStoredUserId();
      if (!userId) return null;
      try {
        const res = await apiClient.get<{ status: string; data: ApiUser }>(
          `/users/profile/${userId}`
        );
        return res.data ?? null;
      } catch {
        return null;
      }
    }
  }

  async updateProfileDetails(payload: {
    full_name?: string;
    username?: string;
    phone_number?: string;
    profile_image_url?: string;
    bio?: string;
  }): Promise<{ success: boolean; data?: ApiUser; message?: string }> {
    try {
      const res = await apiClient.patch<{ status: string; data: ApiUser }>(
        "/api/users/profile/details",
        payload
      );
      const user = res.data;
      if (user && typeof window !== "undefined") {
        if (user.full_name) localStorage.setItem("tribely_user_name", user.full_name);
      }
      return { success: true, data: user };
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || err?.message || "Failed to update profile";
      return { success: false, message: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }
  }

  async updateProfileImage(profile_image_url: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await apiClient.put<{ status: string; data: any }>(
        "/api/users/profile/image",
        { profile_image_url }
      );
      return { success: true, data: res.data };
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || err?.message || "Failed to update avatar";
      return { success: false, message: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }
  }

  async changePassword(current_password: string, new_password: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiClient.post<{ status: string; data: any }>(
        "/api/users/profile/change-password",
        { current_password, new_password }
      );
      return { success: true, message: res?.data?.message || "Password updated successfully!" };
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || err?.message || "Failed to change password";
      return { success: false, message: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }
  }

  async fetchWallet(): Promise<ApiWallet | null> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiWallet }>(
        "/api/kudos/wallet"
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  async fetchMyArenas(): Promise<ApiArena[]> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiArena[] }>(
        "/api/arenas/"
      );
      return res.data ?? [];
    } catch {
      return [];
    }
  }

  async fetchDiscoveryArenas(): Promise<ApiArena[]> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiArena[] }>(
        "/api/arenas/discovery/list"
      );
      return res.data ?? [];
    } catch {
      return [];
    }
  }

  async joinByInviteCode(invite_code: string): Promise<{ success: boolean; arena_id?: number; message?: string }> {
    const cleanCode = (invite_code || "").trim().toUpperCase();
    try {
      const res = await apiClient.post<any>(
        "/api/arenas/join-by-code",
        { invite_code: cleanCode, code: cleanCode }
      );
      const payload = res?.data || res;
      return {
        success: true,
        arena_id: payload?.arena_id || payload?.id,
        message: payload?.detail || payload?.message || "Joined Habit Tribe successfully!"
      };
    } catch (err: any) {
      try {
        const res = await apiClient.post<any>(
          "/api/arenas/join",
          { invite_code: cleanCode, code: cleanCode }
        );
        const payload = res?.data || res;
        return {
          success: true,
          arena_id: payload?.arena_id || payload?.id,
          message: payload?.detail || payload?.message || "Joined Habit Tribe successfully!"
        };
      } catch (err2: any) {
        const rawError =
          err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to join Habit Tribe";
        const message = typeof rawError === "string" ? rawError : JSON.stringify(rawError);
        return { success: false, message };
      }
    }
  }

  async nudgeMember(arena_id: number, target_user_id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.post<any>(
        `/api/activity/arenas/${arena_id}/nudge/${target_user_id}`,
        { nudge_type: "standard" }
      );
      return {
        success: true,
        message: res?.data?.message || "Nudge sent successfully!",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.detail || "Failed to send nudge",
      };
    }
  }

  async fetchFeed(limit: number = 30, offset: number = 0): Promise<{ posts: ApiFeedPost[]; has_more: boolean }> {
    try {
      const res = await apiClient.get<{ status: string; data: { posts: ApiFeedPost[]; has_more?: boolean } }>(
        `/api/activity/feed?limit=${limit}&offset=${offset}`
      );
      return {
        posts: res.data?.posts || [],
        has_more: Boolean(res.data?.has_more),
      };
    } catch {
      return { posts: [], has_more: false };
    }
  }

  async fetchArenaDetail(arenaId: number): Promise<ApiArenaDetail | null> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiArenaDetail }>(
        `/api/arenas/${arenaId}`
      );
      return res.data || null;
    } catch {
      return null;
    }
  }

  async fetchLedgerRoom(arenaId: number): Promise<any | null> {
    try {
      const res = await apiClient.get<{ status: string; data: any }>(
        `/api/arenas/${arenaId}/ledger-room`
      );
      return res.data || null;
    } catch {
      return null;
    }
  }

  async fetchArenaProofFeed(arenaId: number, limit: number = 20): Promise<any[]> {
    try {
      const res = await apiClient.get<{ status: string; data: { feed: any[] } }>(
        `/api/activity/arenas/${arenaId}/feed?limit=${limit}`
      );
      return res.data?.feed || [];
    } catch {
      return [];
    }
  }

  async joinArenaById(arenaId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.post<{ status: string; data: { room_state?: string; message?: string } }>(
        "/api/arenas/discovery/join",
        { arena_id: arenaId }
      );
      return { success: true, message: res.data?.message || "Successfully joined squad!" };
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : detail?.message || err?.response?.data?.message || "Failed to join squad";
      return { success: false, message: msg };
    }
  }

  async fetchArenaHistory(arenaId: number): Promise<ApiArenaHistory | null> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiArenaHistory }>(
        `/api/activity/arena/${arenaId}/history`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  async fetchMultiArenaFeed(arenaIds: number[]): Promise<ApiSubmission[]> {
    if (!arenaIds.length) return [];
    const results: ApiSubmission[] = [];
    await Promise.allSettled(
      arenaIds.map(async (arenaId) => {
        const history = await this.fetchArenaHistory(arenaId);
        if (history?.submissions) {
          const mapped = history.submissions.map((s) => ({ ...s, arena_id: arenaId }));
          results.push(...mapped);
        }
      })
    );
    results.sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );
    return results;
  }

  async fetchTodayStories(arenaIds: number[]): Promise<{ arenaId: number; submissions: ApiSubmission[] }[]> {
    if (!arenaIds.length) return [];
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const results: { arenaId: number; submissions: ApiSubmission[] }[] = [];
    await Promise.allSettled(
      arenaIds.map(async (arenaId) => {
        const history = await this.fetchArenaHistory(arenaId);
        if (history?.submissions) {
          const todaySubmissions = history.submissions.filter(
            (s) => new Date(s.submitted_at) >= todayStart
          );
          results.push({ arenaId, submissions: todaySubmissions });
        }
      })
    );
    return results;
  }

  async fetchStreak(arenaId: number): Promise<ApiStreak | null> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiStreak }>(
        `/api/activity/streak/${arenaId}`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  async fetchHeatmap(arenaId: number, userId: number, days: number = 30): Promise<ApiHeatmapData | null> {
    try {
      const res = await apiClient.get<{ status: string; data: ApiHeatmapData }>(
        `/api/activity/arenas/${arenaId}/heatmap/${userId}?days=${days}`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  async fetchAggregatedHeatmap(arenaIds: number[], userId: number): Promise<ApiHeatmapDay[]> {
    if (!arenaIds.length || !userId) return [];
    const dateStatusMap: Record<string, "present" | "absent" | "today_pending"> = {};
    await Promise.allSettled(
      arenaIds.map(async (arenaId) => {
        const data = await this.fetchHeatmap(arenaId, userId);
        if (data?.matrix) {
          for (const day of data.matrix) {
            const existing = dateStatusMap[day.date];
            if (!existing || day.status === "present") {
              dateStatusMap[day.date] = day.status;
            }
          }
        }
      })
    );
    return Object.entries(dateStatusMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, status]) => ({
        date,
        day_of_week: new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short" }),
        status,
      }));
  }

  async submitProof(payload: SubmitProofPayload): Promise<{ success: boolean; id?: number; message?: string }> {
    try {
      const res = await apiClient.post<{ status: string; data: { id: number; message: string } }>(
        "/api/activity/submit",
        {
          arena_id: payload.arena_id,
          proof_url: payload.proof_url,
          caption: payload.caption,
          client_submitted_at: payload.client_submitted_at || new Date().toISOString(),
        }
      );
      return { success: true, id: res.data?.id, message: res.data?.message };
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        (typeof detail === "object" ? detail?.message : detail) ||
        err?.message ||
        "Proof submission failed.";
      return { success: false, message };
    }
  }

  async uploadMediaFile(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<{ status: string; url: string; filename: string }>(
        "/api/upload/file",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return { success: true, url: res.url };
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        (typeof detail === "object" ? detail?.message : detail) ||
        err?.message ||
        "Failed to upload media file.";
      return { success: false, message };
    }
  }

  async uploadAndSubmitProof(
    arenaId: number,
    proofContent: string,
    caption?: string
  ): Promise<{ success: boolean; proofUrl?: string; message?: string }> {
    const result = await this.submitProof({
      arena_id: arenaId,
      proof_url: proofContent,
      caption,
      client_submitted_at: new Date().toISOString(),
    });
    return { ...result, proofUrl: proofContent };
  }

  async voteSubmission(
    submissionId: string | number,
    voteType: "up" | "down" | "upvote" | "downvote"
  ): Promise<any> {
    const cleanId = String(submissionId).replace(/\D/g, "");
    if (!cleanId) return false;
    const normVote = voteType === "up" || voteType === "upvote" ? "upvote" : "downvote";
    try {
      const res = await apiClient.post(`/api/activity/submission/${cleanId}/vote`, { vote_type: normVote });
      return (res as any)?.data ?? true;
    } catch {
      try {
        const reactRes = await apiClient.post(`/api/activity/submissions/${cleanId}/react`, {
          reaction_type: normVote === "upvote" ? "fire" : "target",
        });
        return (reactRes as any)?.data ?? true;
      } catch {
        return false;
      }
    }
  }

  async fetchProofComments(submissionId: string | number): Promise<ProofComment[]> {
    try {
      const res = await apiClient.get<{
        status: string;
        data: {
          comments: ProofComment[];
          total: number;
        };
      }>(`/api/activity/submissions/${submissionId}/comments`);
      return res.data?.comments || [];
    } catch {
      return [];
    }
  }

  async postProofComment(
    submissionId: string | number,
    text: string
  ): Promise<ProofComment | null> {
    try {
      const res = await apiClient.post<{
        status: string;
        data: {
          comment: ProofComment;
          comments_count: number;
        };
      }>(`/api/activity/submissions/${submissionId}/comments`, {
        content: text,
      });
      return res.data?.comment || null;
    } catch {
      return null;
    }
  }

  async sendMessage(arenaId: number, content: string, messageType: string = "text"): Promise<boolean> {
    try {
      await apiClient.post(`/api/activity/arenas/${arenaId}/messages`, { content, message_type: messageType });
      return true;
    } catch {
      return false;
    }
  }



  async createArena(payload: {
    name: string;
    description?: string;
    category?: string;
    proof_type?: "image" | "link" | "text" | string;
    deadline_time?: string;
    penalty_amount?: number;
    is_private?: boolean;
    icon_url?: string;
    timezone?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await apiClient.post<any>("/api/arenas/", payload);
      return { success: true, data: res.data || res };
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to create arena";
      return { success: false, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }
  }

  formatTimeAgo(isoString: string): string {
    const date = parseSafeUtcDate(isoString);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  }

  hasSubmittedToday(submissions: ApiSubmission[], userId: number): boolean {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    return submissions.some(
      (s) => s.user_id === userId && new Date(s.submitted_at) >= todayStart
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Kudos Virtual Currency & Gamified Staking Economy Client Methods (v1)
  // ─────────────────────────────────────────────────────────────────────────

  async getKudosWallet(): Promise<KudosWallet> {
    return await apiClient.get<KudosWallet>("/api/v1/kudos/wallet");
  }

  async getKudosTransactions(limit: number = 50, offset: number = 0): Promise<KudosTransaction[]> {
    return await apiClient.get<KudosTransaction[]>(
      `/api/v1/kudos/transactions?limit=${limit}&offset=${offset}`
    );
  }

  async joinArenaWithStake(arenaId: number, inviteCode?: string): Promise<ArenaJoinStakeResponse> {
    return await apiClient.post<ArenaJoinStakeResponse>(
      `/api/v1/arenas/${arenaId}/join`,
      inviteCode ? { invite_code: inviteCode } : {}
    );
  }

  async getArenaPoolDetails(arenaId: number): Promise<ArenaPoolDetails> {
    return await apiClient.get<ArenaPoolDetails>(`/api/v1/arenas/${arenaId}/pool`);
  }

  async getArenaLeaderboard(arenaId: number): Promise<LeaderboardMember[]> {
    return await apiClient.get<LeaderboardMember[]>(`/api/v1/arenas/${arenaId}/leaderboard`);
  }

  async distributeWeeklyRewards(arenaId: number): Promise<WeeklyDistributionResponse> {
    return await apiClient.post<WeeklyDistributionResponse>(
      `/api/v1/arenas/${arenaId}/distribute-weekly`
    );
  }

  async penalizeMissedDeadline(arenaId: number, userId: number): Promise<PenaltyMissedResponse> {
    return await apiClient.post<PenaltyMissedResponse>(
      `/api/v1/arenas/${arenaId}/penalize-missed`,
      { user_id: userId }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Real-Time Notifications & Admin Moderation Methods
  // ─────────────────────────────────────────────────────────────────────────

  async fetchNotifications(limit: number = 50): Promise<{ notifications: ApiNotification[]; unread_count: number }> {
    try {
      const res = await apiClient.get<any>(`/api/notifications/history?limit=${limit}`);
      const data = res.data || res;
      return {
        notifications: data.notifications || [],
        unread_count: data.unread_count ?? 0,
      };
    } catch {
      return { notifications: [], unread_count: 0 };
    }
  }

  async approveJoinRequest(arenaId: number, userId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.post<any>("/api/admin/arenas/approve", {
        arena_id: arenaId,
        user_id: userId,
      });
      return { success: true, message: res.data?.detail || "Member approved successfully." };
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || "Failed to approve request";
      return { success: false, message: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }
  }

  async rejectJoinRequest(arenaId: number, userId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.post<any>("/api/admin/arenas/reject", {
        arena_id: arenaId,
        user_id: userId,
      });
      return { success: true, message: res.data?.detail || "Request rejected successfully." };
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || "Failed to reject request";
      return { success: false, message: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }
  }

  async markAllNotificationsRead(): Promise<boolean> {
    try {
      await apiClient.post("/api/notifications/mark-all-read");
      return true;
    } catch {
      return false;
    }
  }
}

export const tribelyService = new TribelyService();
