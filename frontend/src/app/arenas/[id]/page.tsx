"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
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
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Award,
  ChevronRight,
  Info,
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
  ai_audit_notes?: string;
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
  const [activeSection, setActiveSection] = useState<"all" | "members" | "escrow" | "proofs">("all");

  // Load arena details, specific proof feed & ledger room roster
  const loadSquadData = useCallback(async () => {
    if (!arenaId) return;
    setIsLoading(true);
    try {
      const [detail, feed, room] = await Promise.all([
        tribelyService.fetchArenaDetail(arenaId),
        tribelyService.fetchArenaProofFeed(arenaId, 30),
        tribelyService.fetchLedgerRoom(arenaId),
      ]);
      setArenaDetail(detail);
      setProofFeed(feed || []);
      setLedgerRoom(room);
    } catch {
      showToast("Failed to load squad details.", "info");
    } finally {
      setIsLoading(false);
    }
  }, [arenaId, showToast]);

  useEffect(() => {
    loadSquadData();
  }, [loadSquadData]);

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

  const handleShareSquad = () => {
    triggerHaptic([15]);
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast("📋 Squad invite link copied to clipboard!", "success");
    }
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
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <p className="text-xs text-neutral-400 font-medium">Syncing squad escrow ledger...</p>
      </div>
    );
  }

  const squadName = arenaDetail?.name || "Habit Squad";
  const squadTag = arenaDetail?.tag || `#Squad${arenaId}`;
  const isLockedIn = Boolean(
    arenaDetail?.is_locked ??
    arenaDetail?.user_submitted_today ??
    ledgerRoom?.current_user_status?.is_locked
  );
  const unlockTimeStr = arenaDetail?.unlock_time
    ? new Date(arenaDetail.unlock_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : arenaDetail?.deadline_time || "10:00 PM";
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
    currency_symbol: "₹",
  };

  // Transactions ledger list
  const transactions: ApiEscrowTransaction[] = arenaDetail?.ledger_transactions || [];

  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter === "all") return true;
    return tx.type === txFilter;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-28 selection:bg-emerald-500/30">
      {/* ── 1. STICKY INSTAGRAM-STYLE HEADER ── */}
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard?tab=explore")}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-neutral-900 text-neutral-300 hover:text-white transition cursor-pointer"
            title="Back to Arenas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight leading-tight flex items-center gap-1.5">
              <span>{squadName}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </h1>
            <span className="text-[11px] text-neutral-400 font-mono font-medium">{squadTag}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShareSquad}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
            title="Share Invite Link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => openDm(String(arenaId), squadName, squadTag, arenaId)}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer relative"
            title="Open Tribe Huddle"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
          </button>
        </div>
      </header>

      {/* ── 2. HERO SQUAD CARD ── */}
      <section className="p-4">
        <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-neutral-950 p-5 shadow-2xl space-y-4">
          {/* Subtle glowing ambient accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Row: Category + Vault Pill */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{arenaDetail?.proof_type || "Daily Proof"} Cohort</span>
            </span>

            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-[11px] font-black text-amber-300 flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{escrow.total_vault_amount.toLocaleString()} Kudos Pool</span>
            </span>
          </div>

          {/* Title & Description */}
          <div className="relative z-10 space-y-1">
            <h2 className="text-xl font-black text-white tracking-tight leading-tight">
              {squadName}
            </h2>
            <p className="text-xs text-neutral-300 leading-relaxed max-w-sm">
              {arenaDetail?.description ||
                "High-accountability habit cohort. Check in daily before cutoff to protect your streak and earn consistency Kudos."}
            </p>
          </div>

          {/* Daily Status & Cutoff Matrix */}
          <div className="relative z-10 grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800/90 space-y-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>24-Hour Cycle Cutoff</span>
              </span>
              <div className="text-xs font-black text-cyan-300">
                {getCutoffCountdown(arenaDetail?.deadline_time)}
              </div>
              <span className="text-[10px] text-neutral-400 block">
                Valid till {arenaDetail?.cycle_cutoff_time || "09:59:59 PM"} • Resets at {arenaDetail?.deadline_time || "10:00 PM"}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800/90 space-y-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>Your Daily State</span>
              </span>
              {isLockedIn ? (
                <div className="flex items-center gap-1 text-xs font-black text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Locked In ✓</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs font-black text-amber-400">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Pending Proof</span>
                </div>
              )}
              <span className="text-[10px] text-neutral-400 block">
                {isLockedIn ? `Locked until ${unlockTimeStr}` : `₹${arenaDetail?.penalty_amount || 50} Stake at Risk`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. SECTION TABS / QUICK JUMP ── */}
      <div className="px-4 py-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: "all", label: "Overview" },
          { id: "members", label: `Spotters (${members.length})` },
          { id: "escrow", label: "Habit Ledger & Kudos 📋" },
          { id: "proofs", label: `Feed Drops (${proofFeed.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeSection === tab.id
                ? "bg-white text-neutral-950 font-black shadow-md"
                : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 4. JOINED MEMBERS ROSTER ── */}
      {(activeSection === "all" || activeSection === "members") && (
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                Joined Squad Spotters ({members.length})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-400">
              {checkedInCount}/{members.length} Checked In ({momentumPct}%)
            </span>
          </div>

          {/* Horizontal Story Avatar Rings Tray */}
          <div className="p-3.5 rounded-3xl bg-neutral-900/60 border border-neutral-800 space-y-3">
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
                        className={`w-14 h-14 rounded-full p-[2.5px] transition duration-300 ${
                          hasCheckedIn
                            ? "bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                            : "bg-gradient-to-tr from-rose-500 to-amber-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.35)]"
                        }`}
                      >
                        <img
                          src={
                            member.user_avatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`
                          }
                          alt={member.user_name}
                          className="w-full h-full rounded-full object-cover bg-neutral-950 border border-neutral-900"
                        />
                      </div>

                      {/* Pip Status Badge */}
                      <span
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-neutral-950 flex items-center justify-center text-[8px] font-black ${
                          hasCheckedIn ? "bg-emerald-500 text-neutral-950" : "bg-rose-500 text-white"
                        }`}
                      >
                        {hasCheckedIn ? "✓" : "!"}
                      </span>
                    </div>

                    {/* Name & Nudge Hint */}
                    <span className="text-[10px] font-medium text-neutral-300 truncate max-w-[62px] mt-1.5">
                      {member.is_current_user ? "You" : member.user_name.split(" ")[0]}
                    </span>

                    {!hasCheckedIn && !member.is_current_user && (
                      <span className="text-[9px] font-black text-rose-400 mt-0.5">
                        {isNudged ? "Nudged ⚡" : "Nudge ⚡"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detailed Member Cards Grid */}
            <div className="space-y-2 pt-1 border-t border-neutral-800/80">
              {members.map((member, idx) => {
                const hasCheckedIn = member.has_submitted_today;
                const isNudged = !!nudgedMembers[member.user_id];
                const isLead = member.role === "admin" || member.role === "creator" || idx === 0;

                return (
                  <div
                    key={member.user_id}
                    className="p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800/90 flex items-center justify-between hover:border-neutral-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={
                            member.user_avatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`
                          }
                          alt={member.user_name}
                          className="w-10 h-10 rounded-full object-cover border border-neutral-800"
                        />
                        {hasCheckedIn && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-neutral-950" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">
                            {member.user_name}
                          </span>
                          {member.is_current_user && (
                            <span className="px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-bold text-neutral-300">
                              You
                            </span>
                          )}
                          {isLead && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[9px] font-black text-amber-400 border border-amber-500/30">
                              👑 Lead
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-neutral-400">
                            @{member.user_handle}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            {hasCheckedIn ? "Streak Maintained 🔥" : "Streak Pending ⏳"}
                          </span>
                        </div>
                        {rosterMap[member.user_id]?.submitted_at_formatted && (
                          <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                            <span>📸 Submitted {rosterMap[member.user_id].submitted_at_formatted}</span>
                            {rosterMap[member.user_id].is_on_time && (
                              <span className="text-[9px] bg-emerald-500/20 px-1 py-0.2 rounded text-emerald-300 font-bold">
                                On-Time ✓
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 ${
                          hasCheckedIn
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {hasCheckedIn ? "✓ Checked In" : "⏳ Pending"}
                      </span>

                      {!hasCheckedIn && !member.is_current_user && (
                        <button
                          type="button"
                          onClick={() => handleNudgeMember(member)}
                          className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-black transition cursor-pointer"
                        >
                          {isNudged ? "Nudged ⚡" : "Nudge"}
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

      {/* ── 5. THE ESCROW TREASURY & INCOME VAULT ── */}
      {(activeSection === "all" || activeSection === "escrow") && (
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                Habit Activity & Kudos Pool
              </h3>
            </div>
            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
              <Shield className="w-3 h-3 text-amber-400" />
              Consistency Pool
            </span>
          </div>

          {/* Premium Glassmorphism Treasury Card */}
          <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 p-5 shadow-2xl space-y-5">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Whole Income Amount of Arena */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                Arena Kudos & Activity Pool
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
                  {escrow.total_vault_amount.toLocaleString()} Kudos
                </span>
                <span className="text-xs font-bold text-amber-400/80">Total Community Pool</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                All member check-ins and consistency streaks contribute here. Maintain your daily streak to
                climb the leaderboard and unlock squad bonuses.
              </p>
            </div>

            {/* 3 Pillars Breakdown */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-0.5">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight block">
                  Member Stakes
                </span>
                <span className="text-xs font-black text-emerald-400">
                  {escrow.member_stakes_pool.toLocaleString()} Kudos
                </span>
                <span className="text-[9px] text-neutral-500 block">Active Stakes</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-0.5">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight block">
                  Fines Collected
                </span>
                <span className="text-xs font-black text-rose-400">
                  {escrow.penalty_pool.toLocaleString()} Kudos
                </span>
                <span className="text-[9px] text-neutral-500 block">Missed Deadlines</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-0.5">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight block">
                  Bonus Pool
                </span>
                <span className="text-xs font-black text-amber-300">
                  {escrow.reward_pool.toLocaleString()} Kudos
                </span>
                <span className="text-[9px] text-neutral-500 block">Weekly Payout</span>
              </div>
            </div>

            {/* Cycle Timeline Progress */}
            <div className="p-3 rounded-2xl bg-black/50 border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-neutral-300">Weekly Cycle Momentum</span>
                <span className="font-black text-amber-400">
                  {escrow.cycle_days_remaining} Days Remaining
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      15,
                      Math.round(
                        ((escrow.cycle_days_total - escrow.cycle_days_remaining) /
                          escrow.cycle_days_total) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-500">
                <span>Cycle Day {escrow.cycle_days_total - escrow.cycle_days_remaining} of 7</span>
                <span>Settlement on Sunday 11:59 PM</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. REAL TRANSPARENT TRANSACTION LEDGER ── */}
      {(activeSection === "all" || activeSection === "escrow") && (
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                Live Squad Activity & Kudos Ledger
              </h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">Activity Verified</span>
          </div>

          {/* Filter Segment Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { key: "all", label: `All (${transactions.length})` },
              { key: "deposit", label: "Stakes 🟢" },
              { key: "penalty", label: "Fines 🔴" },
              { key: "reward", label: "Rewards 🏆" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTxFilter(f.key as any)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  txFilter === f.key
                    ? "bg-emerald-500 text-neutral-950 font-black shadow-md"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Transaction List Feed */}
          {filteredTransactions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center text-xs text-neutral-400">
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
                    className="p-3.5 rounded-2xl bg-neutral-900/70 border border-neutral-800/80 hover:border-neutral-700/80 transition space-y-2 shadow-md"
                  >
                    {/* Top Row: User & Transaction Type */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isDeposit
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : isPenalty
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {isDeposit && <ArrowDownRight className="w-4 h-4" />}
                          {isPenalty && <AlertCircle className="w-4 h-4" />}
                          {isReward && <Trophy className="w-4 h-4" />}
                        </div>

                        <div>
                          <p className="text-xs font-bold text-white leading-snug">
                            {tx.description}
                          </p>
                          <span className="text-[10px] text-neutral-400 block mt-0.5">
                            {tx.formatted_time || "Recent"}
                          </span>
                        </div>
                      </div>

                      {/* Amount Badge */}
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-black block ${
                            isDeposit
                              ? "text-emerald-400"
                              : isPenalty
                              ? "text-rose-400"
                              : "text-amber-300"
                          }`}
                        >
                          {isDeposit && "+"}
                          {isPenalty && "Penalty: "}
                          {isReward && "Earned: "}{tx.amount.toLocaleString()} Kudos
                        </span>
                        <span className="text-[9px] uppercase font-bold text-neutral-500 block">
                          {isDeposit ? "Stake Locked" : isPenalty ? "Pool Fine" : "Consistency Win"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Hash & Copy Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-neutral-500 font-mono">
                      <span className="truncate max-w-[200px]">{tx.tx_hash || `tx_${tx.id}`}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyTx(tx.id, tx.tx_hash)}
                        className="flex items-center gap-1 text-neutral-400 hover:text-white transition cursor-pointer ml-2"
                        title="Copy Tx Hash"
                      >
                        {copiedTxId === tx.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Verify Hash</span>
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

      {/* ── 7. CHRONOLOGICAL SQUAD PROOFS FEED ── */}
      {(activeSection === "all" || activeSection === "proofs") && (
        <section className="p-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                Chronological Proof Drops ({proofFeed.length})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-neutral-500">Verified Daily Drops</span>
          </div>

          {proofFeed.length === 0 ? (
            <div className="p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No drops recorded yet today</h4>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                Be the first squad member to drop proof and protect your daily stake!
              </p>
              <button
                type="button"
                onClick={openCamera}
                className="mt-2 px-5 py-2.5 rounded-full bg-emerald-500 text-neutral-950 text-xs font-black hover:bg-emerald-400 transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Drop Daily Proof 📸
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {proofFeed.map((item) => (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-xl"
                >
                  {/* Proof Author Bar */}
                  <div className="p-3.5 flex items-center justify-between border-b border-neutral-800/60">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          item.user_avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`
                        }
                        alt={item.user_name}
                        className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                      />
                      <div>
                        <span className="text-xs font-black text-white block leading-none">
                          {item.user_name}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {tribelyService.formatTimeAgo(item.submitted_at)}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified Drop</span>
                    </span>
                  </div>

                  {/* Media Image Preview (4:5 Aspect Ratio) */}
                  <div
                    className="relative aspect-[4/5] bg-black overflow-hidden cursor-pointer"
                    onClick={() => setSelectedProofPreview(item)}
                  >
                    <img
                      src={item.proof_url}
                      alt="Proof drop"
                      className="w-full h-full object-cover hover:scale-102 transition duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-80" />

                    {item.ai_audit_notes && (
                      <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs text-neutral-200">
                        {item.ai_audit_notes}
                      </div>
                    )}
                  </div>

                  {/* Proof Reactions & Props */}
                  <div className="p-3.5 flex items-center justify-between text-xs font-bold text-neutral-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Flame className="w-4 h-4 fill-emerald-400" />
                        {item.upvotes || 0}
                      </span>
                      <span className="flex items-center gap-1 text-cyan-400">
                        <Zap className="w-4 h-4 fill-cyan-400" />
                        1.5x Multiplier
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic([15]);
                        showToast(`🔥 Fire prop sent to ${item.user_name}!`, "fire");
                      }}
                      className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-750 text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      Send Prop 🔥
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 8. FLOATING CHECK-IN BUTTON (STICKY BOTTOM) ── */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent z-20 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          {isLockedIn ? (
            <button
              type="button"
              disabled={true}
              className="w-full py-3.5 px-4 rounded-2xl bg-neutral-900 border border-emerald-500/40 text-emerald-400 font-black text-xs flex items-center justify-center gap-2 shadow-2xl shadow-emerald-500/10 cursor-not-allowed opacity-95"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
              <span>Proof Submitted ✓ Locked Until Cycle Reset ({unlockTimeStr})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openCamera}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 shadow-2xl shadow-emerald-500/30 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
            >
              <Camera className="w-4 h-4 stroke-[2.5]" />
              <span>Drop Daily Proof to Lock In 📸</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 9. FULLSCREEN ZOOM LIGHTBOX ── */}
      <AnimatePresence>
        {selectedProofPreview && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-4"
            onClick={() => setSelectedProofPreview(null)}
          >
            <div
              className="relative w-full max-w-sm bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl"
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
                  <span className="text-xs font-black text-white">
                    {selectedProofPreview.user_name}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">Verified Drop</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {selectedProofPreview.ai_audit_notes || "Daily habit drop verified for this squad."}
                </p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera Modal Mount */}
      <CameraModal />
    </div>
  );
}

export default function ArenaDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center text-xs font-bold text-neutral-400">
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
