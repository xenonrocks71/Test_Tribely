"use client";

import { useState, useCallback } from "react";
import api from "@/app/utils/api";

export interface Submission {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar_url?: string | null;
  proof_url: string;
  submitted_at: string;
  upvotes?: number;
  downvotes?: number;
  is_absent?: boolean;
}

export function useArenaFeed(arenaId: number | string) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    if (!arenaId) return;
    try {
      const res = await api.get(`/api/activity/arena/${arenaId}/history`);
      const payload = res.data?.data;
      if (payload && Array.isArray(payload.submissions)) {
        setSubmissions(payload.submissions);
      }
    } catch (err: any) {
      setFeedError(err.response?.data?.detail || "Failed to load feed history.");
    }
  }, [arenaId]);

  const submitProof = useCallback(
    async (proofUrl: string) => {
      if (!arenaId || !proofUrl.trim()) return false;
      setIsSubmitting(true);
      setFeedError(null);
      try {
        const res = await api.post(`/api/activity/arena/${arenaId}/submit`, {
          proof_url: proofUrl.trim(),
        });
        if (res.data?.data) {
          const newSubmission = res.data.data;
          setSubmissions((prev) => [newSubmission, ...prev]);
        }
        return true;
      } catch (err: any) {
        setFeedError(err.response?.data?.detail || "Submission failed.");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [arenaId]
  );

  const voteSubmission = useCallback(
    async (submissionId: number, voteType: "upvote" | "downvote") => {
      try {
        const endpoint =
          voteType === "upvote"
            ? `/api/activity/submission/${submissionId}/upvote`
            : `/api/activity/submission/${submissionId}/downvote`;

        const res = await api.post(endpoint);
        if (res.data?.data) {
          const updated = res.data.data;
          setSubmissions((prev) =>
            prev.map((sub) => (sub.id === submissionId ? { ...sub, ...updated } : sub))
          );
        }
      } catch (err: any) {
        console.error("Failed to register vote", err);
      }
    },
    []
  );

  return {
    submissions,
    setSubmissions,
    isSubmitting,
    feedError,
    fetchFeed,
    submitProof,
    voteSubmission,
  };
}
