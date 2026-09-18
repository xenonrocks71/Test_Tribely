"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Share2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Zap,
  Trophy,
  Camera,
  MessageCircle,
  Sparkles,
  Users,
  Shield,
  Loader2,
  Copy,
  Check,
  TrendingUp,
  X,
  ExternalLink,
  MessageSquare,
  Globe,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useApp, AppProvider } from "@/context/AppContext";
import {
  tribelyService,
  ApiArenaDetail,
  ApiSquadMember,
  ApiEscrowTransaction,
  ApiEscrowSummary,
} from "@/services/tribely.service";
import { CameraModal } from "@/components/capture/CameraModal";
import { ArenaPoolCard } from "@/components/arenas/ArenaPoolCard";
import { StakingModal } from "@/components/arenas/StakingModal";
import { ConsistencyLeaderboard } from "@/components/arenas/ConsistencyLeaderboard";
import { TribeChatDrawer } from "@/components/chat/TribeChatDrawer";
import { ProofReplyModal } from "@/components/feed/ProofReplyModal";

interface ArenaFeedItem {
  id: number;
  arena_id: number;
  user_id: number;
  user_name: string;
  user_avatar?: string | null;
  proof_url: string;
  submitted_at: string;
  is_absent?: boolean;
  upvotes?: number;
  downvotes?: number;
  reactions?: Record<string, number>;
  ai_status?: string;
  ai_audit_notes?: string | null;
  comments_count?: number;
  proof_type?: string;
}

/**
 * ArenaShareModal
 * 
 * Google Workspace-style dialog for sharing arena pass-key, direct invite link,
 * and pre-formatted invite messages with peers.
 */
function ArenaShareModal({
  isOpen,
  onClose,
  arenaName,
  arenaId,
  inviteCode,
  category,
  deadlineTime,
  penaltyAmount,
}: {
  isOpen: boolean;
  onClose: () => void;
  arenaName: string;
  arenaId: number;
  inviteCode: string;
  category?: string;
  deadlineTime?: string;
  penaltyAmount?: number;
}) {
  const { triggerHaptic, showToast } = useApp();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  if (!isOpen) return null;

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || "https://tribely.mayurkpatil.in");
  const joinLink = `${origin}/arenas/${arenaId}?code=${inviteCode}`;
  const shareMessage = `Join my accountability arena "${arenaName}" on Tribely!\n🎯 Focus: ${category || "Daily Discipline"}\n⏰ Daily Cutoff: ${deadlineTime || "11:59 PM"}\n⚡ Miss Stake: ${penaltyAmount || 50} Kudos\n🔑 Pass-Key: ${inviteCode}\n🔗 Direct Join Link: ${joinLink}`;

  const handleCopyCode = () => {
    triggerHaptic([15]);
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      showToast("🔑 Pass-key copied to clipboard!", "success");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    triggerHaptic([15]);
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(joinLink);
      setCopiedLink(true);
      showToast("🔗 Invite link copied to clipboard!", "success");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyMessage = () => {
    triggerHaptic([15]);
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareMessage);
      setCopiedMessage(true);
      showToast("📋 Full invite message copied to clipboard!", "success");
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    triggerHaptic([15]);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${arenaName} on Tribely`,
          text: shareMessage,
          url: joinLink,
        });
        showToast("Shared invite successfully!", "success");
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyMessage();
    }
  };

  const handleWhatsAppShare = () => {
    triggerHaptic([15]);
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-md bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED] dark:border-[#303134]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/20 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white">
                  Share Arena Invite
                </h3>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Invite peers to join {arenaName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* 1. Pass-Key Box */}
            <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Unique Cohort Pass-Key
                </span>
                <span className="text-[11px] font-mono text-neutral-400">6-character code</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 py-2.5 px-3.5 bg-white dark:bg-[#1E1E1E] border border-[#DADCE0] dark:border-[#3C4043] rounded-xl font-mono text-center text-lg font-bold tracking-widest text-[#1A73E8] dark:text-[#8AB4F8] select-all">
                  {inviteCode}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="py-2.5 px-4 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Peers can enter this pass-key into the &quot;Redeem Invite Code&quot; box in the top-right &quot;+&quot; menu.
              </p>
            </div>

            {/* 2. Direct Link Box */}
            <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block">
                Direct Invite Link
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={joinLink}
                  className="flex-1 py-2 px-3 bg-white dark:bg-[#1E1E1E] border border-[#DADCE0] dark:border-[#3C4043] rounded-xl font-mono text-xs text-neutral-700 dark:text-neutral-300 truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2 px-3.5 rounded-xl border border-[#DADCE0] dark:border-[#3C4043] hover:border-[#1A73E8] text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 hover:bg-neutral-100 dark:hover:bg-[#2A2B2E]"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#0F9D58]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* 3. Ready-To-Send Invite Message */}
            <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Ready-to-Send Message
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer flex items-center gap-1"
                >
                  {copiedMessage ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedMessage ? "Copied!" : "Copy Message"}</span>
                </button>
              </div>
              <div className="p-3 bg-white dark:bg-[#1E1E1E] border border-[#DADCE0] dark:border-[#3C4043] rounded-xl text-xs text-neutral-700 dark:text-neutral-300 font-mono whitespace-pre-line leading-relaxed select-all">
                {shareMessage}
              </div>
            </div>

            {/* 4. Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="py-2.5 px-4 rounded-full bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-4 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share via Apps</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ArenaDetailContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const arenaId = parseInt(rawId || "0", 10);

  const {
    user,
    openCamera,
    openDm,
    feedPosts,
    openProofReply,
    triggerHaptic,
    showToast,
    isCameraModalOpen,
  } = useApp();

  const [arenaDetail, setArenaDetail] = useState<ApiArenaDetail | null>(null);
  const [ledgerRoom, setLedgerRoom] = useState<any | null>(null);
  const [proofFeed, setProofFeed] = useState<ArenaFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nudgedMembers, setNudgedMembers] = useState<Record<number, boolean>>({});
  const [selectedProofPreview, setSelectedProofPreview] = useState<ArenaFeedItem | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | number | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "deposit" | "penalty" | "reward">("all");
  const [activeSection, setActiveSection] = useState<"overview" | "members" | "escrow" | "proofs" | "ledger">("overview");
  const [isStakingModalOpen, setIsStakingModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Load arena details, complete chronological proof feed & ledger room roster
  const loadSquadData = useCallback(async () => {
    if (!arenaId) return;
    setIsLoading(true);
    try {
      const [detailRes, feedRes, historyRes, roomRes] = await Promise.allSettled([
        tribelyService.fetchArenaDetail(arenaId),
        tribelyService.fetchArenaProofFeed(arenaId, 50),
        tribelyService.fetchArenaHistory(arenaId),
        tribelyService.fetchLedgerRoom(arenaId),
      ]);

      const detail = detailRes.status === "fulfilled" ? detailRes.value : null;
      const feedItems = feedRes.status === "fulfilled" ? feedRes.value : [];
      const history = historyRes.status === "fulfilled" ? historyRes.value : null;
      const room = roomRes.status === "fulfilled" ? roomRes.value : null;

      // Deduplicate and combine all proofs for this specific arena
      const combinedMap = new Map<string | number, ArenaFeedItem>();

      // 1. From arena proof feed
      if (Array.isArray(feedItems)) {
        feedItems.forEach((item: any) => {
          if (item?.id) {
            combinedMap.set(item.id, {
              id: item.id,
              arena_id: item.arena_id || arenaId,
              user_id: item.user_id,
              user_name: item.user_name || "Squad Member",
              user_avatar: item.user_avatar || null,
              proof_url: item.proof_url || item.media_url || "",
              submitted_at: item.submitted_at || new Date().toISOString(),
              is_absent: item.is_absent,
              upvotes: item.upvotes || 0,
              downvotes: item.downvotes || 0,
              reactions: item.reactions || {},
              ai_status: item.ai_status || "verified",
              ai_audit_notes: item.ai_audit_notes || item.caption || null,
              comments_count: item.comments_count || item.commentsCount || 0,
              proof_type: item.proof_type || detail?.proof_type || "image",
            });
          }
        });
      }

      // 2. From arena history submissions
      if (history?.submissions && Array.isArray(history.submissions)) {
        history.submissions.forEach((sub: any) => {
          if (sub?.id && !combinedMap.has(sub.id)) {
            combinedMap.set(sub.id, {
              id: sub.id,
              arena_id: sub.arena_id || arenaId,
              user_id: sub.user_id,
              user_name: sub.user_name || "Squad Member",
              user_avatar: sub.user_avatar_url || null,
              proof_url: sub.proof_url || "",
              submitted_at: sub.submitted_at || new Date().toISOString(),
              is_absent: sub.is_absent,
              upvotes: sub.upvotes || 0,
              downvotes: sub.downvotes || 0,
              reactions: {},
              ai_status: sub.ai_status || "verified",
              ai_audit_notes: sub.ai_audit_notes || sub.text_reflection || null,
              comments_count: 0,
              proof_type: detail?.proof_type || "image",
            });
          }
        });
      }

      // 3. From global feedPosts in AppContext for this specific arena
      feedPosts.forEach((p) => {
        if (String(p.arenaId) === String(arenaId) && p.mainImage) {
          const numericId = Number(String(p.id).replace(/\D/g, "")) || Math.floor(Math.random() * 100000);
          if (!combinedMap.has(numericId) && !combinedMap.has(p.id)) {
            combinedMap.set(numericId, {
              id: numericId,
              arena_id: arenaId,
              user_id: Number(p.userId) || Number(user.id) || 1,
              user_name: p.userName || user.name || "Squad Member",
              user_avatar: p.userAvatar || user.avatar || null,
              proof_url: p.mainImage,
              submitted_at: new Date().toISOString(),
              is_absent: false,
              upvotes: p.upvotes || p.reactions?.fire || 1,
              downvotes: p.downvotes || 0,
              reactions: p.reactions || {},
              ai_status: "verified",
              ai_audit_notes: p.caption || "Verified Daily Proof",
              comments_count: p.commentsCount || 0,
              proof_type: p.proofType || detail?.proof_type || "image",
            });
          }
        }
      });

      // Strict sorting: reverse chronological order (latest date first)
      const sortedList = Array.from(combinedMap.values()).sort((a, b) => {
        const timeA = new Date(a.submitted_at).getTime() || 0;
        const timeB = new Date(b.submitted_at).getTime() || 0;
        return timeB - timeA;
      });

      setArenaDetail(detail);
      setProofFeed(sortedList);
      setLedgerRoom(room);
    } catch {
      showToast("Failed to load squad details.", "info");
    } finally {
      setIsLoading(false);
    }
  }, [arenaId, feedPosts, user.avatar, user.id, user.name, showToast]);

  useEffect(() => {
    loadSquadData();
  }, [loadSquadData]);

  // Re-sync squad data when camera modal closes after proof drop
  const prevCameraOpen = useRef(isCameraModalOpen);
  useEffect(() => {
    if (prevCameraOpen.current && !isCameraModalOpen) {
      loadSquadData();
    }
    prevCameraOpen.current = isCameraModalOpen;
  }, [isCameraModalOpen, loadSquadData]);

  const rosterMap = useMemo(() => {
    const map: Record<number, any> = {};
    if (ledgerRoom?.roster && Array.isArray(ledgerRoom.roster)) {
      ledgerRoom.roster.forEach((r: any) => {
        map[r.user_id] = r;
      });
    }
    return map;
  }, [ledgerRoom]);

  // Calculate cutoff countdown
  const getCutoffCountdown = (deadlineStr?: string) => {
    if (!deadlineStr) return "Tonight 11:59 PM";
    try {
      const now = new Date();
      const cleanStr = deadlineStr.trim();
      let hours = 23;
      let minutes = 59;

      if (cleanStr.includes("AM") || cleanStr.includes("PM")) {
        const [timePart, period] = cleanStr.split(" ");
        const [h, m] = timePart.split(":").map(Number);
        hours = h;
        if (period?.toUpperCase() === "PM" && h !== 12) hours += 12;
        if (period?.toUpperCase() === "AM" && h === 12) hours = 0;
        minutes = m || 0;
      } else if (cleanStr.includes(":")) {
        const [h, m] = cleanStr.split(":").map(Number);
        hours = h;
        minutes = m || 0;
      }

      const cutoff = new Date(now);
      cutoff.setHours(hours, minutes, 0, 0);
      const diffMs = cutoff.getTime() - now.getTime();
      if (diffMs <= 0) return "Cutoff passed for today";
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      return `Cutoff in ${diffHrs}h ${diffMins}m`;
    } catch {
      return `Cutoff at ${deadlineStr}`;
    }
  };

  const handleNudgeMember = (member: ApiSquadMember) => {
    triggerHaptic([20, 40]);
    setNudgedMembers((prev) => ({ ...prev, [member.user_id]: true }));
    showToast(`⚡ Nudge alert sent to @${member.user_handle}!`, "nudge");
  };

  const handleCopyTx = (txId: string | number, txHash?: string) => {
    triggerHaptic([10]);
    setCopiedTxId(txId);
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(txHash || String(txId));
      showToast("📋 Transaction hash copied to clipboard!", "success");
    }
    setTimeout(() => setCopiedTxId(null), 2000);
  };

  if (isLoading && !arenaDetail) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] text-neutral-900 dark:text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#1A73E8] animate-spin mb-3" />
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Loading cohort arena...
        </p>
      </div>
    );
  }

  const squadName = arenaDetail?.name || "Habit Squad";
  const squadTag = arenaDetail?.tag || `#Squad${arenaId}`;
  const inviteCode =
    arenaDetail?.invite_code ||
    (arenaDetail as any)?.code ||
    squadTag.replace("#", "").toUpperCase() ||
    `TRIB${arenaId}`;

  const isLockedIn = Boolean(
    arenaDetail?.is_locked ??
    arenaDetail?.user_submitted_today ??
    ledgerRoom?.current_user_status?.is_locked
  );
  const unlockTimeStr = arenaDetail?.unlock_time
    ? new Date(arenaDetail.unlock_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : arenaDetail?.deadline_time || "11:59 PM";
  const members = arenaDetail?.members || [];
  const checkedInCount = members.filter((m) => m.has_submitted_today).length;
  const momentumPct = members.length > 0 ? Math.round((checkedInCount / members.length) * 100) : 0;

  // Escrow treasury values
  const escrow: ApiEscrowSummary = arenaDetail?.escrow_summary || {
    total_vault_amount: arenaDetail?.sprint_vault || 1250,
    member_stakes_pool: (members.length || 1) * (arenaDetail?.penalty_amount || 50),
    penalty_pool: 0,
    reward_pool: arenaDetail?.sprint_vault || 1250,
    cycle_days_remaining: 3,
    cycle_days_total: 7,
    currency_symbol: "⚡",
  };

  // Transactions ledger list
  const transactions: ApiEscrowTransaction[] = arenaDetail?.ledger_transactions || [];

  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter === "all") return true;
    return tx.type === txFilter;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] text-neutral-900 dark:text-neutral-100 pb-28">
      {/* ── 1. GOOGLE WORKSPACE APP BAR ── */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-md border-b border-[#E8EAED] dark:border-[#303134] px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/feed")}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
            title="Back to Feed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-neutral-900 dark:text-white tracking-tight leading-tight flex items-center gap-2">
              <span>{squadName}</span>
              <span className="w-2 h-2 rounded-full bg-[#0F9D58]" title="Live Sync Active" />
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono font-medium">
                {squadTag}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#202124] text-neutral-600 dark:text-neutral-400 font-mono">
                🔑 {inviteCode}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Share Arena Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic([15]);
              setIsShareModalOpen(true);
            }}
            className="p-2 rounded-full bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] text-neutral-700 dark:text-neutral-200 transition cursor-pointer"
            title="Share Arena Pass-Key & Link"
          >
            <Share2 className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
          </button>

          {/* Open Squad Chat Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic([15]);
              openDm(String(arenaId), squadName, squadTag, arenaId);
            }}
            className="p-2 rounded-full bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] text-neutral-700 dark:text-neutral-200 transition cursor-pointer relative"
            title="Open Squad Chat Huddle"
          >
            <MessageCircle className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0F9D58] border-2 border-white dark:border-[#1E1E1E]" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-5 space-y-6">
        {/* ── 2. HERO SQUAD CARD ── */}
        <section className="w-full">
          <div className="rounded-2xl sm:rounded-3xl border border-[#E8EAED] dark:border-[#303134] bg-white dark:bg-[#1E1E1E] p-5 sm:p-6 shadow-xs space-y-4">
            {/* Top Row: Category + Vault Pool Pill */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/20 text-[11px] font-medium text-[#1A73E8] dark:text-[#8AB4F8] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#1A73E8] dark:text-[#8AB4F8]" />
                  <span>
                    {arenaDetail?.proof_type === "link"
                      ? "🔗 Link Cohort"
                      : arenaDetail?.proof_type === "text"
                      ? "📝 Daily Log Cohort"
                      : "📸 Photo Cohort"}
                  </span>
                </span>

                {arenaDetail?.is_private ? (
                  <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-[#202124] text-[11px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1 border border-[#E8EAED] dark:border-[#303134]">
                    <Lock className="w-3 h-3" />
                    <span>Private</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-[#202124] text-[11px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1 border border-[#E8EAED] dark:border-[#303134]">
                    <Globe className="w-3 h-3" />
                    <span>Public</span>
                  </span>
                )}
              </div>

              <span className="px-3 py-1 rounded-full bg-[#FEF7E0] dark:bg-[#F9AB00]/15 border border-[#FEEFC3] dark:border-[#F9AB00]/25 text-[11px] font-medium text-[#B06000] dark:text-[#F9AB00] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>{escrow.total_vault_amount.toLocaleString()} Kudos Pool</span>
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight leading-tight">
                {squadName}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl">
                {arenaDetail?.description ||
                  "Daily accountability habit cohort. Submit proof daily before cutoff to protect your streak."}
              </p>
            </div>

            {/* Daily Status & Cutoff Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-1.5">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                  <span>24-Hour Cutoff</span>
                </span>
                <div className="text-sm font-semibold text-[#1A73E8] dark:text-[#8AB4F8]">
                  {getCutoffCountdown(arenaDetail?.deadline_time)}
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">
                  Resets daily at {arenaDetail?.deadline_time || "11:59 PM"}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-1.5">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#0F9D58]" />
                  <span>Your Daily State</span>
                </span>
                {isLockedIn ? (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0F9D58] dark:text-[#81C995]">
                    <CheckCircle2 className="w-4 h-4 text-[#0F9D58]" />
                    <span>Locked In ✓</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Pending Proof</span>
                  </div>
                )}
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">
                  {isLockedIn
                    ? `Locked until ${unlockTimeStr}`
                    : `⚡${arenaDetail?.penalty_amount || 50} Stake at Risk`}
                </span>
                {!isLockedIn && (
                  <button
                    type="button"
                    onClick={() => openCamera(String(arenaId))}
                    className="mt-1 w-full py-2.5 px-4 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Submit Daily Proof</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. GOOGLE MATERIAL SECTION TABS ── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { id: "overview", label: "Overview" },
            { id: "members", label: `Spotters (${members.length})` },
            { id: "proofs", label: `Feed Drops (${proofFeed.length})` },
            { id: "escrow", label: "Staking Pool & Podium 🏆" },
            { id: "ledger", label: `Activity Ledger (${transactions.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveSection(tab.id as any);
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                activeSection === tab.id
                  ? "bg-[#1A73E8] text-white shadow-xs font-semibold"
                  : "bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-[#2A2B2E]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── COMPACT COHORT OVERVIEW (DEDICATED DASHBOARD - NO EXCESSIVE SCROLLING) ── */}
        {activeSection === "overview" && (
          <section className="space-y-4">
            {/* 1. Daily Pulse & Cohort Momentum Card */}
            <div className="p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/20 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Cohort Daily Pulse
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {checkedInCount} of {members.length} spotters locked in today
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#0F9D58] bg-[#E6F4EA] dark:bg-[#0F9D58]/15 border border-[#CEEAD6] dark:border-[#0F9D58]/30 px-2.5 py-1 rounded-full">
                  {momentumPct}% Locked In
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#F1F3F4] dark:bg-[#202124] rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#1A73E8] to-[#0F9D58] h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, momentumPct)}%` }}
                />
              </div>

              {/* Quick stats grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#E8EAED] dark:border-[#303134]">
                <div className="text-center p-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124]">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Spotters</span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">{members.length}</span>
                </div>
                <div className="text-center p-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124]">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Kudos Pool</span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">⚡{escrow.total_vault_amount}</span>
                </div>
                <div className="text-center p-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124]">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Feed Drops</span>
                  <span className="text-xs font-bold text-[#1A73E8] dark:text-[#8AB4F8]">{proofFeed.length}</span>
                </div>
              </div>
            </div>

            {/* 2. Spotters Tray Quick Preview */}
            <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Squad Spotters ({members.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("members")}
                  className="text-[11px] font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>View All ({members.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Horizontal Story Avatar Rings Tray */}
              <div className="flex items-center gap-3.5 overflow-x-auto py-1 no-scrollbar">
                {members.slice(0, 8).map((member) => {
                  const hasCheckedIn = member.has_submitted_today;
                  return (
                    <div
                      key={member.user_id}
                      className="flex flex-col items-center shrink-0 w-14 text-center cursor-pointer"
                      onClick={() => setActiveSection("members")}
                    >
                      <div className="relative">
                        <div
                          className={`w-11 h-11 rounded-full p-0.5 transition duration-200 ${
                            hasCheckedIn
                              ? "border-2 border-[#0F9D58]"
                              : "border border-dashed border-neutral-300 dark:border-neutral-600"
                          }`}
                        >
                          <img
                            src={
                              member.user_avatar ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`
                            }
                            alt={member.user_name}
                            className="w-full h-full rounded-full object-cover bg-neutral-100 dark:bg-neutral-900"
                          />
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#1E1E1E] flex items-center justify-center text-[7px] font-bold ${
                            hasCheckedIn ? "bg-[#0F9D58] text-white" : "bg-neutral-400 text-white"
                          }`}
                        >
                          {hasCheckedIn ? "✓" : "!"}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[56px] mt-1">
                        {member.is_current_user ? "You" : member.user_name.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Latest Drop Snapshot or Prompt */}
            <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Latest Squad Drop
                  </h3>
                </div>
                {proofFeed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSection("proofs")}
                    className="text-[11px] font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>View All ({proofFeed.length})</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {proofFeed.length > 0 ? (
                <div
                  className="rounded-xl overflow-hidden border border-[#E8EAED] dark:border-[#303134] bg-neutral-50 dark:bg-[#202124] p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] transition"
                  onClick={() => setSelectedProofPreview(proofFeed[0])}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {proofFeed[0].proof_url ? (
                      <img
                        src={proofFeed[0].proof_url}
                        alt="Latest drop"
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-black/10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#E8F0FE] dark:bg-[#1A73E8]/20 flex items-center justify-center shrink-0 text-[#1A73E8]">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-white block truncate">
                        {proofFeed[0].user_name}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                        {tribelyService.formatTimeAgo(proofFeed[0].submitted_at)} • Verified Drop
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] text-[10px] font-medium shrink-0">
                    ✓ Verified
                  </span>
                </div>
              ) : (
                <div className="py-4 text-center space-y-2">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    No verified drops yet today for this cohort.
                  </p>
                  <button
                    type="button"
                    onClick={() => openCamera(String(arenaId))}
                    className="px-4 py-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition cursor-pointer shadow-xs"
                  >
                    Drop First Proof 📸
                  </button>
                </div>
              )}
            </div>

            {/* 4. Quick Navigation Cards to Staking & Ledger */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setActiveSection("escrow")}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-left hover:border-[#1A73E8] dark:hover:border-[#8AB4F8] transition cursor-pointer shadow-xs flex items-center justify-between group"
              >
                <div>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Staking & Podium</span>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1 mt-0.5">
                    <span>🏆 Rankings</span>
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#1A73E8] dark:group-hover:text-[#8AB4F8] group-hover:translate-x-0.5 transition" />
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("ledger")}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-left hover:border-[#1A73E8] dark:hover:border-[#8AB4F8] transition cursor-pointer shadow-xs flex items-center justify-between group"
              >
                <div>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Kudos Activity</span>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1 mt-0.5">
                    <span>⚡ Ledger ({transactions.length})</span>
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#1A73E8] dark:group-hover:text-[#8AB4F8] group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </section>
        )}

        {/* ── 4. CHRONOLOGICAL SQUAD PROOFS FEED (FEED DROPS) ── */}
        {activeSection === "proofs" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Squad Feed Drops ({proofFeed.length})
                </h3>
              </div>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Sorted by Latest Date
              </span>
            </div>

            {proofFeed.length === 0 ? (
              <div className="p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  No drops recorded yet for this cohort
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  Be the first cohort member to drop daily verified proof and protect your team&apos;s multiplier!
                </p>
                <button
                  type="button"
                  onClick={() => openCamera(String(arenaId))}
                  className="mt-2 px-5 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition cursor-pointer shadow-xs"
                >
                  Drop Daily Proof 📸
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {proofFeed.map((item) => (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-xs"
                  >
                    {/* Proof Author Bar */}
                    <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-[#E8EAED] dark:border-[#303134]">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            item.user_avatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`
                          }
                          alt={item.user_name}
                          className="w-9 h-9 rounded-full object-cover border border-[#E8EAED] dark:border-[#303134]"
                        />
                        <div>
                          <span className="text-xs font-semibold text-neutral-900 dark:text-white block leading-tight">
                            {item.user_name}
                          </span>
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {tribelyService.formatTimeAgo(item.submitted_at)} •{" "}
                            {new Date(item.submitted_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 border border-[#CEEAD6] dark:border-[#0F9D58]/30 text-[#0F9D58] text-[10px] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Drop</span>
                      </span>
                    </div>

                    {/* Media Container (Image, Link, or Text) */}
                    {item.proof_url ? (
                      <div
                        className="relative aspect-[4/5] sm:aspect-[16/10] bg-neutral-100 dark:bg-black overflow-hidden cursor-pointer group"
                        onClick={() => setSelectedProofPreview(item)}
                      >
                        <img
                          src={item.proof_url}
                          alt="Proof drop"
                          className="w-full h-full object-cover group-hover:scale-[1.01] transition duration-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

                        {item.ai_audit_notes && (
                          <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs text-neutral-200 leading-relaxed">
                            {item.ai_audit_notes}
                          </div>
                        )}
                      </div>
                    ) : item.ai_audit_notes ? (
                      <div className="p-4 bg-[#F8F9FA] dark:bg-[#202124] border-b border-[#E8EAED] dark:border-[#303134]">
                        <p className="text-xs text-neutral-800 dark:text-neutral-200 italic leading-relaxed">
                          &quot;{item.ai_audit_notes}&quot;
                        </p>
                      </div>
                    ) : null}

                    {/* Proof Reactions & Props */}
                    <div className="p-3.5 sm:p-4 flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[#0F9D58] font-semibold">
                          <Flame className="w-4 h-4 fill-[#0F9D58]" />
                          <span>{item.upvotes || 1}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[#1A73E8] dark:text-[#8AB4F8] font-semibold">
                          <Zap className="w-4 h-4 fill-current" />
                          <span>1.5x Multiplier</span>
                        </span>
                        {item.comments_count !== undefined && item.comments_count > 0 && (
                          <span className="flex items-center gap-1 text-neutral-500">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{item.comments_count}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic([15]);
                            showToast(`Fire prop sent to ${item.user_name}!`, "fire");
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] text-neutral-800 dark:text-neutral-200 text-xs font-medium transition cursor-pointer"
                        >
                          Send Prop 🔥
                        </button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 5. JOINED MEMBERS ROSTER ── */}
        {activeSection === "members" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Squad Spotters ({members.length})
                </h3>
              </div>
              <span className="text-[11px] font-medium text-[#0F9D58]">
                {checkedInCount}/{members.length} Checked In ({momentumPct}%)
              </span>
            </div>

            {/* Horizontal Story Avatar Rings Tray */}
            <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] space-y-4 shadow-xs">
              <div className="flex items-center gap-4 overflow-x-auto py-1 no-scrollbar">
                {members.map((member) => {
                  const hasCheckedIn = member.has_submitted_today;
                  const isNudged = !!nudgedMembers[member.user_id];

                  return (
                    <div
                      key={member.user_id}
                      className="flex flex-col items-center shrink-0 w-16 text-center group cursor-pointer"
                      onClick={() => {
                        if (!hasCheckedIn && !member.is_current_user) {
                          handleNudgeMember(member);
                        }
                      }}
                    >
                      {/* Ringed Avatar */}
                      <div className="relative">
                        <div
                          className={`w-12 h-12 rounded-full p-0.5 transition duration-200 ${
                            hasCheckedIn
                              ? "border-2 border-[#0F9D58]"
                              : "border border-dashed border-neutral-300 dark:border-neutral-600"
                          }`}
                        >
                          <img
                            src={
                              member.user_avatar ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`
                            }
                            alt={member.user_name}
                            className="w-full h-full rounded-full object-cover bg-neutral-100 dark:bg-neutral-900"
                          />
                        </div>

                        {/* Pip Status Badge */}
                        <span
                          className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-[#1E1E1E] flex items-center justify-center text-[8px] font-bold ${
                            hasCheckedIn ? "bg-[#0F9D58] text-white" : "bg-neutral-400 text-white"
                          }`}
                        >
                          {hasCheckedIn ? "✓" : "!"}
                        </span>
                      </div>

                      {/* Name & Nudge Hint */}
                      <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[62px] mt-1.5">
                        {member.is_current_user ? "You" : member.user_name.split(" ")[0]}
                      </span>

                      {!hasCheckedIn && !member.is_current_user && (
                        <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                          {isNudged ? "Nudged" : "Nudge ⚡"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Detailed Member Cards Grid */}
              <div className="space-y-2 pt-2 border-t border-[#E8EAED] dark:border-[#303134]">
                {members.map((member, idx) => {
                  const hasCheckedIn = member.has_submitted_today;
                  const isNudged = !!nudgedMembers[member.user_id];
                  const isLead = member.role === "admin" || member.role === "creator" || idx === 0;

                  return (
                    <div
                      key={member.user_id}
                      className="p-3.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={
                              member.user_avatar ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`
                            }
                            alt={member.user_name}
                            className="w-10 h-10 rounded-full object-cover border border-[#E8EAED] dark:border-[#303134]"
                          />
                          {hasCheckedIn && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0F9D58] border-2 border-white dark:border-[#202124]" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              {member.user_name}
                            </span>
                            {member.is_current_user && (
                              <span className="px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 text-[9px] font-medium text-neutral-700 dark:text-neutral-300">
                                You
                              </span>
                            )}
                            {isLead && (
                              <span className="px-1.5 py-0.2 rounded bg-[#FEF7E0] dark:bg-[#F9AB00]/15 text-[9px] font-medium text-amber-700 dark:text-amber-300 border border-[#FEEFC3] dark:border-[#F9AB00]/25">
                                👑 Lead
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              @{member.user_handle}
                            </span>
                            <span className="text-[10px] text-[#0F9D58] font-medium">
                              {hasCheckedIn ? "Streak Maintained" : "Streak Pending"}
                            </span>
                          </div>
                          {rosterMap[member.user_id]?.submitted_at_formatted && (
                            <div className="text-[10px] text-[#0F9D58] font-medium flex items-center gap-1 mt-0.5">
                              <span>📸 Submitted {rosterMap[member.user_id].submitted_at_formatted}</span>
                              {rosterMap[member.user_id].is_on_time && (
                                <span className="text-[9px] bg-[#E6F4EA] dark:bg-[#0F9D58]/15 px-1 py-0.2 rounded text-[#0F9D58] font-medium">
                                  On-Time ✓
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 ${
                            hasCheckedIn
                              ? "bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] border border-[#CEEAD6] dark:border-[#0F9D58]/30"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"
                          }`}
                        >
                          {hasCheckedIn ? "✓ Checked In" : "⏳ Pending"}
                        </span>

                        {!hasCheckedIn && !member.is_current_user && (
                          <button
                            type="button"
                            onClick={() => handleNudgeMember(member)}
                            className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-[10px] font-medium transition cursor-pointer"
                          >
                            {isNudged ? "Nudged" : "Nudge ⚡"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── 6. KUDOS STAKING POOL & GAMIFIED ECONOMY ── */}
        {activeSection === "escrow" && (
          <section className="space-y-4">
            <ArenaPoolCard
              arenaId={arenaId}
              isJoined={Boolean(
                arenaDetail?.is_joined ||
                members.some((m) => m.is_current_user || String(m.user_id) === String(user.id))
              )}
              onOpenStaking={() => setIsStakingModalOpen(true)}
            />

            <ConsistencyLeaderboard arenaId={arenaId} />
          </section>
        )}

        {/* ── 7. REAL TRANSPARENT TRANSACTION LEDGER ── */}
        {activeSection === "ledger" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Squad Activity & Kudos Ledger
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">Verified Ledger</span>
            </div>

            {/* Filter Segment Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { key: "all", label: `All (${transactions.length})` },
                { key: "deposit", label: "Stakes" },
                { key: "penalty", label: "Fines" },
                { key: "reward", label: "Rewards" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTxFilter(f.key as any)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                    txFilter === f.key
                      ? "bg-[#1A73E8] text-white shadow-xs dark:bg-[#8AB4F8] dark:text-[#202124]"
                      : "bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-[#303134] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-[#2A2B2E]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Transaction List Feed */}
            {filteredTransactions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] text-center text-xs text-neutral-500">
                No transactions recorded in this category yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTransactions.map((tx) => {
                  const isDeposit = tx.type === "deposit" || tx.type === "stake";
                  const isPenalty = tx.type === "penalty";
                  const isReward = tx.type === "reward";

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-xs space-y-2"
                    >
                      {/* Top Row: User & Transaction Type */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isDeposit
                                ? "bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58]"
                                : isPenalty
                                ? "bg-[#FCE8E6] dark:bg-[#D93025]/15 text-[#D93025]"
                                : "bg-[#FEF7E0] dark:bg-[#F9AB00]/15 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {isDeposit && <Zap className="w-4 h-4" />}
                            {isPenalty && <AlertCircle className="w-4 h-4" />}
                            {isReward && <Trophy className="w-4 h-4" />}
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-neutral-900 dark:text-white leading-snug">
                              {tx.description}
                            </p>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mt-0.5">
                              {tx.formatted_time || "Recent"}
                            </span>
                          </div>
                        </div>

                        {/* Amount Badge */}
                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-semibold block ${
                              isDeposit
                                ? "text-[#0F9D58]"
                                : isPenalty
                                ? "text-[#D93025]"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {isDeposit && "+"}
                            {isPenalty && "Penalty: "}
                            {isReward && "Earned: "}
                            {tx.amount.toLocaleString()} Kudos
                          </span>
                          <span className="text-[9px] font-medium text-neutral-500 block">
                            {isDeposit ? "Stake Locked" : isPenalty ? "Pool Fine" : "Consistency Win"}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Hash & Copy Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-500 font-mono">
                        <span className="truncate max-w-[200px]">{tx.tx_hash || `tx_${tx.id}`}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyTx(tx.id, tx.tx_hash)}
                          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition cursor-pointer ml-2"
                          title="Copy Tx Hash"
                        >
                          {copiedTxId === tx.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#0F9D58]" />
                              <span className="text-[#0F9D58]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Verify</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── 8. FLOATING CHECK-IN BUTTON (STICKY BOTTOM) ── */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 dark:from-[#121212] dark:via-[#121212]/90 to-transparent z-20 pointer-events-none">
        <div className="max-w-md lg:max-w-lg mx-auto pointer-events-auto">
          {isLockedIn ? (
            <button
              type="button"
              disabled={true}
              className="w-full py-3 px-4 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 border border-[#CEEAD6] dark:border-[#0F9D58]/30 text-[#0F9D58] font-medium text-xs flex items-center justify-center gap-2 shadow-xs cursor-not-allowed opacity-95"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0F9D58]" />
              <span>Proof Submitted ✓ Locked Until Cycle Reset ({unlockTimeStr})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openCamera(String(arenaId))}
              className="w-full py-3 px-4 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Drop Daily Proof to Lock In 📸</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 9. FULLSCREEN ZOOM LIGHTBOX ── */}
      <AnimatePresence>
        {selectedProofPreview && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center p-4"
            onClick={() => setSelectedProofPreview(null)}
          >
            <div
              className="relative w-full max-w-sm bg-white dark:bg-[#1E1E1E] rounded-3xl overflow-hidden border border-[#E8EAED] dark:border-[#303134] shadow-2xl text-neutral-900 dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedProofPreview(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
              <div className="aspect-[4/5] bg-black">
                <img
                  src={selectedProofPreview.proof_url}
                  alt="Proof expanded"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                    {selectedProofPreview.user_name}
                  </span>
                  <span className="text-[10px] text-[#0F9D58] font-semibold bg-[#E6F4EA] dark:bg-[#0F9D58]/15 px-2 py-0.5 rounded-full">
                    Verified Drop
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {selectedProofPreview.ai_audit_notes || "Daily habit drop verified for this squad."}
                </p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal Mount */}
      <ArenaShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        arenaName={squadName}
        arenaId={arenaId}
        inviteCode={inviteCode}
        category={arenaDetail?.category}
        deadlineTime={arenaDetail?.deadline_time}
        penaltyAmount={arenaDetail?.penalty_amount}
      />

      {/* Staking Modal Mount */}
      <StakingModal
        isOpen={isStakingModalOpen}
        onClose={() => setIsStakingModalOpen(false)}
        arenaId={arenaId}
        arenaTitle={squadName}
        entryStake={arenaDetail?.penalty_amount || 50}
        isPrivate={arenaDetail?.is_private}
        onSuccess={loadSquadData}
      />

      {/* Camera Modal Mount */}
      <CameraModal />

      {/* Squad Chat Drawer Mount */}
      <TribeChatDrawer />

      {/* Proof Reply Modal Mount */}
      <ProofReplyModal />
    </div>
  );
}

export default function ArenaDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] text-neutral-500 flex items-center justify-center text-xs font-medium">
          Loading squad...
        </div>
      }
    >
      <AppProvider>
        <ArenaDetailContent />
      </AppProvider>
    </Suspense>
  );
}
