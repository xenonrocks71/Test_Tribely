"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { ProofItem } from "@/types/tribely";

interface UseFeedOptions {
  limit?: number;
  initialCursor?: string | null;
  autoFetch?: boolean;
}

function sanitizeFeedCaption(caption?: string, textReflection?: string, submittedAt?: string): string {
  const raw = (caption || textReflection || "").trim();
  if (!raw || /ai auto-audit|confidence|\bauto-audit\b|invalid image proof format/i.test(raw)) {
    try {
      const d = new Date(submittedAt || "");
      return !isNaN(d.getTime())
        ? d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
        : new Date().toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return new Date().toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return raw;
}

export function useFeed(options: UseFeedOptions = {}) {
  const { limit = 15, initialCursor = null, autoFetch = true } = options;

  const [items, setItems] = useState<ProofItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Snapshot ref for optimistic rollback
  const itemsSnapshotRef = useRef<ProofItem[]>([]);

  // Fetch initial feed page
  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get<any>(`/api/activity/feed?use_cursor=true&limit=${limit}`);
      const payload = res?.data || res || {};
      const rawItems = payload.items || payload.posts || [];

      const normalized: ProofItem[] = rawItems.map((item: any) => ({
        id: item.id,
        arenaId: item.arena_id,
        arenaName: item.arena_name || "Arena",
        arenaTag: item.arena_tag || "#arena",
        isJoined: item.is_joined ?? false,
        isPrivate: item.is_private ?? false,
        userId: item.user_id,
        userName: item.user_name || "Tribe Member",
        userHandle: item.user_handle || `@user${item.user_id}`,
        userAvatar: item.user_avatar || null,
        mediaUrl: item.media_url || item.proof_url || "",
        selfieUrl: item.selfie_url || null,
        proofType: item.proof_type || "image",
        caption: sanitizeFeedCaption(item.caption, item.text_reflection, item.submitted_at || item.created_at),
        telemetryData: item.telemetry_data || {},
        submissionDate: item.submission_date || item.submitted_at || new Date().toISOString().split("T")[0],
        createdAt: item.created_at || item.submitted_at || new Date().toISOString(),
        reactions: {
          fire: item.reactions?.fire || item.upvotes || 0,
          electric: item.reactions?.electric || 0,
          respect: item.reactions?.respect || 0,
          target: item.reactions?.target || 0,
        },
        currentUserReactions: item.current_user_reactions || (item.current_user_reaction ? [item.current_user_reaction] : []),
        hasUserReacted: item.has_user_reacted || Boolean(item.current_user_reaction || item.user_vote),
        aiStatus: item.ai_status,
        aiConfidenceScore: item.ai_confidence_score,
        aiAuditNotes: item.ai_audit_notes,
      }));

      setItems(normalized);
      itemsSnapshotRef.current = normalized;
      setCursor(payload.next_cursor || null);
      setHasMore(payload.has_more ?? (normalized.length === limit));
    } catch (err: any) {
      setError(err?.message || "Failed to load habit feed.");
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Keyset infinite scrolling: Load next page using cursor
  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || isFetchingNextPage) return;

    setIsFetchingNextPage(true);
    try {
      const res = await apiClient.get<any>(`/api/activity/feed?use_cursor=true&cursor=${encodeURIComponent(cursor)}&limit=${limit}`);
      const payload = res?.data || res || {};
      const rawItems = payload.items || payload.posts || [];

      const newItems: ProofItem[] = rawItems.map((item: any) => ({
        id: item.id,
        arenaId: item.arena_id,
        arenaName: item.arena_name || "Arena",
        arenaTag: item.arena_tag || "#arena",
        isJoined: item.is_joined ?? false,
        isPrivate: item.is_private ?? false,
        userId: item.user_id,
        userName: item.user_name || "Tribe Member",
        userHandle: item.user_handle || `@user${item.user_id}`,
        userAvatar: item.user_avatar || null,
        mediaUrl: item.media_url || item.proof_url || "",
        selfieUrl: item.selfie_url || null,
        proofType: item.proof_type || "image",
        caption: sanitizeFeedCaption(item.caption, item.text_reflection, item.submitted_at || item.created_at),
        telemetryData: item.telemetry_data || {},
        submissionDate: item.submission_date || item.submitted_at || new Date().toISOString().split("T")[0],
        createdAt: item.created_at || item.submitted_at || new Date().toISOString(),
        reactions: {
          fire: item.reactions?.fire || item.upvotes || 0,
          electric: item.reactions?.electric || 0,
          respect: item.reactions?.respect || 0,
          target: item.reactions?.target || 0,
        },
        currentUserReactions: item.current_user_reactions || (item.current_user_reaction ? [item.current_user_reaction] : []),
        hasUserReacted: item.has_user_reacted || Boolean(item.current_user_reaction || item.user_vote),
        aiStatus: item.ai_status,
        aiConfidenceScore: item.ai_confidence_score,
        aiAuditNotes: item.ai_audit_notes,
      }));

      setItems((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const filteredNew = newItems.filter((p) => !existingIds.has(p.id));
        const combined = [...prev, ...filteredNew];
        itemsSnapshotRef.current = combined;
        return combined;
      });

      setCursor(payload.next_cursor || null);
      setHasMore(payload.has_more ?? (newItems.length === limit));
    } catch (err: any) {
      console.error("[useFeed] Error loading next page:", err);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [cursor, hasMore, isFetchingNextPage, limit]);

  // Optimistic micro-reaction toggling with rollback on failure
  const toggleReaction = useCallback(async (proofId: number, reactionType: "fire" | "electric" | "respect" | "target") => {
    const previousItems = [...itemsSnapshotRef.current];

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== proofId) return item;

        const alreadyReacted = item.currentUserReactions?.includes(reactionType);
        const nextUserReactions = alreadyReacted
          ? (item.currentUserReactions || []).filter((r) => r !== reactionType)
          : [...(item.currentUserReactions || []), reactionType];

        const currentCount = item.reactions[reactionType] || 0;
        const nextCount = alreadyReacted ? Math.max(0, currentCount - 1) : currentCount + 1;

        return {
          ...item,
          currentUserReactions: nextUserReactions,
          hasUserReacted: nextUserReactions.length > 0,
          reactions: {
            ...item.reactions,
            [reactionType]: nextCount,
          },
        };
      })
    );

    try {
      await apiClient.post(`/api/activity/proofs/${proofId}/react`, {
        reaction_type: reactionType,
      });
      itemsSnapshotRef.current = items;
    } catch (err) {
      console.error("[useFeed] Reaction failed, rolling back optimistic update:", err);
      setItems(previousItems);
      itemsSnapshotRef.current = previousItems;
    }
  }, [items]);

  useEffect(() => {
    if (autoFetch) {
      fetchFeed();
    }
  }, [autoFetch, fetchFeed]);

  return {
    items,
    cursor,
    hasMore,
    isLoading,
    isFetchingNextPage,
    error,
    refresh: fetchFeed,
    loadMore,
    toggleReaction,
  };
}
