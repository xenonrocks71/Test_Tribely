"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { getWsBaseUrl } from "@/app/utils/config";
import { Arena, ArenaMember } from "@/types/tribely";

export interface UseArenaDetailsResult {
  arena: Arena | null;
  members: ArenaMember[];
  userMembership: ArenaMember | null;
  isLoading: boolean;
  error: string | null;
  joinArena: (inviteCode?: string) => Promise<boolean>;
  leaveArena: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useArenaDetails(arenaId: number): UseArenaDetailsResult {
  const [arena, setArena] = useState<Arena | null>(null);
  const [members, setMembers] = useState<ArenaMember[]>([]);
  const [userMembership, setUserMembership] = useState<ArenaMember | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const fetchArena = useCallback(async () => {
    if (!arenaId || isNaN(arenaId)) return;
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch arena metadata
      const res = await apiClient.get<any>(`/api/arenas/${arenaId}`);
      const raw = res.data?.arena || res.data;

      if (!raw) {
        throw new Error("Arena not found");
      }

      const normalizedArena: Arena = {
        id: raw.id,
        title: raw.title || raw.name || "Habit Squad",
        name: raw.name || raw.title || "Habit Squad",
        description: raw.description || "",
        category: raw.category || "General",
        proofType: (raw.proof_type || "image").toLowerCase(),
        isPrivate: Boolean(raw.is_private),
        inviteCode: raw.invite_code || "",
        entryDeposit: Number(raw.entry_deposit || raw.penalty_amount || 0),
        dailyPenalty: Number(raw.daily_penalty || raw.penalty_amount || 0),
        penaltyAmount: Number(raw.penalty_amount || raw.daily_penalty || 0),
        dailyCutoffTime: raw.daily_cutoff_time || raw.deadline_time || "23:59",
        deadlineTime: raw.deadline_time || raw.daily_cutoff_time || "23:59",
        timezone: raw.timezone || "UTC",
        memberCount: raw.member_count || 0,
        vaultPool: Number(raw.vault_pool || 0),
        isJoined: Boolean(raw.is_joined || raw.membership_status === "approved" || raw.user_role),
        userRole: raw.user_role || (raw.membership_status === "approved" ? "member" : undefined),
      };

      setArena(normalizedArena);

      // 2. Fetch squad members if available
      try {
        const squadRes = await apiClient.get<any>(`/api/arenas/${arenaId}/members`);
        const rawMembers = Array.isArray(squadRes.data) ? squadRes.data : squadRes.data?.members || [];
        const normalizedMembers: ArenaMember[] = rawMembers.map((m: any) => ({
          id: m.id || m.user_id,
          arenaId: arenaId,
          userId: m.user_id,
          role: m.role || "member",
          currentStreak: m.current_streak || m.streak_days || 0,
          isActive: m.is_active ?? true,
          joinedAt: m.joined_at || new Date().toISOString(),
          user: {
            id: m.user_id,
            username: m.user_handle?.replace(/^@/, "") || m.user_name || `user${m.user_id}`,
            email: m.email || "",
            fullName: m.user_name || "Tribe Member",
            avatarUrl: m.user_avatar || m.user_avatar_url || null,
            isActive: true,
          },
        }));
        setMembers(normalizedMembers);

        // Find current user's membership
        const myUserId = localStorage.getItem("tribely_user_id");
        if (myUserId) {
          const mine = normalizedMembers.find((m) => m.userId === Number(myUserId));
          if (mine) setUserMembership(mine);
        }
      } catch {
        // Non-fatal if squad endpoint is restricted
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load arena details.");
    } finally {
      setIsLoading(false);
    }
  }, [arenaId]);

  // Real-time WebSocket connection to keep arena state synchronized without page refresh
  useEffect(() => {
    if (!arenaId || isNaN(arenaId)) return;

    fetchArena();

    const token = localStorage.getItem("tribely_token") || localStorage.getItem("token");
    const wsUrl = `${getWsBaseUrl()}/ws/arena/${arenaId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.event_type) {
          case "member_joined":
          case "USER_JOINED":
            setArena((prev) => (prev ? { ...prev, memberCount: (prev.memberCount || 0) + 1 } : prev));
            if (data.member) {
              setMembers((prev) => [...prev, data.member]);
            }
            break;

          case "member_kicked":
          case "USER_LEFT":
            setArena((prev) => (prev ? { ...prev, memberCount: Math.max(0, (prev.memberCount || 1) - 1) } : prev));
            if (data.user_id) {
              setMembers((prev) => prev.filter((m) => m.userId !== data.user_id));
            }
            break;

          case "deadline_updated":
            if (data.deadline_time) {
              setArena((prev) => (prev ? { ...prev, deadlineTime: data.deadline_time, dailyCutoffTime: data.deadline_time } : prev));
            }
            break;

          case "proof_submitted":
            if (data.user_id) {
              setMembers((prev) =>
                prev.map((m) =>
                  m.userId === data.user_id
                    ? { ...m, currentStreak: (m.currentStreak || 0) + 1 }
                    : m
                )
              );
            }
            break;

          case "proof_comment_added":
            window.dispatchEvent(
              new CustomEvent("tribely:proof_comment_added", { detail: data })
            );
            break;

          default:
            break;
        }
      } catch (e) {
        console.error("[useArenaDetails] WS message parse error:", e);
      }
    };

    return () => {
      ws.onclose = null;
      ws.onerror = () => {};
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, "Component unmounted");
        }
      } catch {}
    };
  }, [arenaId, fetchArena]);

  const joinArena = useCallback(
    async (inviteCode?: string): Promise<boolean> => {
      try {
        const payload = inviteCode ? { invite_code: inviteCode } : {};
        await apiClient.post(`/api/arenas/${arenaId}/join`, payload);
        await fetchArena();
        return true;
      } catch (err: any) {
        setError(err?.message || "Failed to join arena.");
        return false;
      }
    },
    [arenaId, fetchArena]
  );

  const leaveArena = useCallback(async (): Promise<boolean> => {
    try {
      await apiClient.post(`/api/arenas/${arenaId}/leave`);
      await fetchArena();
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to leave arena.");
      return false;
    }
  }, [arenaId, fetchArena]);

  return {
    arena,
    members,
    userMembership,
    isLoading,
    error,
    joinArena,
    leaveArena,
    refresh: fetchArena,
  };
}
