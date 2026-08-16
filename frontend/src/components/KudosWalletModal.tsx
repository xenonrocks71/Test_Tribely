"use client";

import React, { useState, useEffect } from "react";
import { Coins, ShieldCheck, RefreshCw, X, AlertCircle, CheckCircle, Gift, UserPlus, Flame, Sparkles } from "lucide-react";
import api from "@/app/utils/api";

interface KudosWalletData {
  kudos_balance?: number;
  tribes_balance?: number;
  inr_value?: number;
  is_frozen?: boolean;
  referral_count?: number;
  streak_shields?: number;
  recent_transactions?: Array<{
    id: number;
    transaction_type: string;
    amount_kudos?: number;
    amount_tribes?: number;
    description: string;
    created_at: string;
  }>;
}

interface KudosWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  arenaVaultKudos?: number;
  kudosDaysRemaining?: number;
  arenaVaultTransactions?: Array<{
    id: number;
    transaction_type: string;
    amount_kudos?: number;
    amount_tribes?: number;
    description: string;
    created_at: string;
  }>;
  arenaLeaderboard?: Array<{
    user_id: number;
    user_name: string;
    verified_days: number;
    cycle_days: number;
    consistency_percentage: number;
  }>;
  onDistributeRewards?: () => Promise<void>;
  isAdmin?: boolean;
}

export default function KudosWalletModal({
  isOpen,
  onClose,
  arenaVaultKudos,
  kudosDaysRemaining,
  arenaVaultTransactions,
  arenaLeaderboard,
  onDistributeRewards,
  isAdmin
}: KudosWalletModalProps) {
  const [distributing, setDistributing] = useState(false);
  const [activeTab, setActiveTab] = useState<"wallet" | "referral">("wallet");
  const [data, setData] = useState<KudosWalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleTriggerDistribution = async () => {
    if (!onDistributeRewards) return;
    setDistributing(true);
    try {
      await onDistributeRewards();
      setMessage({ type: "success", text: "🏆 21-Day Vault Rewards audited and distributed successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Distribution failed." });
    } finally {
      setDistributing(false);
    }
  };

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/kudos/wallet");
      if (res.data?.status === "success" || res.data?.data) {
        setData(res.data.data || res.data);
      }
    } catch (err) {
      console.error("Failed to fetch Tribes wallet data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReferral = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await api.post("/api/kudos/referral");
      if (res.data?.status === "success") {
        const refData = res.data.data;
        setMessage({
          type: "success",
          text: refData.reward_given
            ? "🎉 3 Referrals Completed! Your account is unfrozen & +200 Tribes bonus credited!"
            : `✅ Referral recorded! Progress: ${refData.referral_count}/3 referrals.`
        });
        await fetchWalletData();
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to process referral." });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWalletData();
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentBalance = data?.tribes_balance ?? data?.kudos_balance ?? 1000;
  const isFrozen = data?.is_frozen ?? false;
  const referralCount = data?.referral_count ?? 0;
  const streakShields = data?.streak_shields ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto styled-scroll animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[88vh] flex flex-col overflow-y-auto styled-scroll rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-black p-5 sm:p-6 shadow-2xl shadow-amber-500/10 text-white my-auto">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <Coins className="h-7 w-7 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-amber-400">Tribely Digital Currency Economy</h2>
            <p className="text-xs text-slate-400">Virtual Tribes Currency & Consistency Reward Ecosystem</p>
          </div>
        </div>

        {/* Account Frozen Alert Banner */}
        {isFrozen && (
          <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-rose-200">⚠️ Account Frozen (Negative Balance)</strong>
              <p className="mt-1 text-[11px] text-rose-300/90 leading-relaxed">
                Your Tribes balance dropped below zero due to missed daily proof cutoffs. Invite 3 friends using your referral link to unfreeze your account and claim a <strong>+200 Tribes bonus</strong>!
              </p>
            </div>
          </div>
        )}

        {/* Arena Locked Vault Banner (When opened inside an Arena) */}
        {arenaVaultKudos !== undefined && (
          <div className="mb-6 rounded-2xl p-4 border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-black space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Arena Locked Reserve Vault</h4>
                  <p className="text-[10px] text-slate-400">Distributed to consistent members every 21 days</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-300">
                🔒 Locked
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2.5 rounded-xl border border-amber-500/20 bg-slate-900/60">
                <span className="text-[10px] block font-semibold text-slate-400">Accumulated Vault</span>
                <span className="font-mono font-black text-amber-400 text-sm">{(arenaVaultKudos ?? 0).toLocaleString()} Tribes</span>
              </div>
              <div className="p-2.5 rounded-xl border border-amber-500/20 bg-slate-900/60">
                <span className="text-[10px] block font-semibold text-slate-400">21-Day Cycle Remaining</span>
                <span className="font-mono font-black text-emerald-400 text-sm">{kudosDaysRemaining ?? 21} Days</span>
              </div>
            </div>

            {/* Member 21-Day Consistency Leaderboard Matrix */}
            {arenaLeaderboard && arenaLeaderboard.length > 0 && (
              <div className="pt-2 space-y-2 border-t border-amber-500/20">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center justify-between">
                  <span>Member Consistency Standings</span>
                  <span className="text-[9px] font-medium text-slate-400">21-Day Audit</span>
                </h5>
                <div className="space-y-2 max-h-40 overflow-y-auto styled-scroll pr-1">
                  {arenaLeaderboard.map((lb) => {
                    const totalWeight = arenaLeaderboard.reduce((acc, curr) => acc + (curr.consistency_percentage || 1), 0) || 1;
                    const estimatedShare = Math.round(((lb.consistency_percentage || 1) / totalWeight) * (arenaVaultKudos || 0));

                    return (
                      <div
                        key={lb.user_id}
                        className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-[11px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-slate-200 truncate">{lb.user_name}</span>
                            <span className="text-[10px] font-mono text-emerald-400 shrink-0 font-extrabold">
                              {lb.verified_days}/21 Days ({lb.consistency_percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(5, lb.consistency_percentage)}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[9px] block text-slate-400">Vault Share</span>
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            +{estimatedShare.toLocaleString()} Tribes
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Distribute Rewards Action Button */}
            {onDistributeRewards && (
              <div className="pt-2 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={handleTriggerDistribution}
                  disabled={distributing || (arenaVaultKudos || 0) === 0}
                  className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 active:scale-95 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  {distributing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Auditing & Distributing Vault...</span>
                    </>
                  ) : (
                    <>
                      <span>🏆 Distribute Vault Rewards to Consistent Members</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Personal Wallet Balance Banner (Only shown when NOT viewing Arena Vault) */}
        {arenaVaultKudos === undefined && (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 p-5 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">Available Balance</span>
                <div className="mt-1 flex items-baseline space-x-2">
                  <span className="text-3xl font-black text-amber-400">
                    {loading ? "..." : currentBalance.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-amber-200/90">Tribes</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="inline-flex items-center space-x-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                    <span>Streak Shields: <strong className="text-amber-200">{streakShields} Active</strong></span>
                  </div>

                  <div className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300">
                    <Gift className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Welcome Bonus: <strong className="text-emerald-200">+1,000 Tribes</strong></span>
                  </div>
                </div>
              </div>

              <button
                onClick={fetchWalletData}
                disabled={loading}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                title="Refresh Wallet Balance"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-800 pb-3 mb-5">
          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "wallet"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Overview & Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab("referral")}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "referral"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>Referrals & Rewards ({referralCount}/3)</span>
          </button>
        </div>

        {/* Alert Messages */}
        {message && (
          <div
            className={`mb-4 flex items-center space-x-2 rounded-lg p-3 text-xs ${
              message.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {message.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Content 1: Overview & Ledger */}
        {activeTab === "wallet" && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
              <span>{arenaVaultKudos !== undefined ? "Recent Arena Vault Ledger Logs" : "Recent Double-Entry Transactions"}</span>
              <span className="text-[10px] text-slate-400 font-normal">ACID Immutable Ledger</span>
            </h3>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 styled-scroll">
              {(arenaVaultTransactions && arenaVaultTransactions.length > 0
                ? arenaVaultTransactions
                : data?.recent_transactions && data.recent_transactions.length > 0
                ? data.recent_transactions
                : []
              ).length > 0 ? (
                (arenaVaultTransactions && arenaVaultTransactions.length > 0
                  ? arenaVaultTransactions
                  : data?.recent_transactions || []
                ).map((tx, idx) => {
                  const amountVal = (tx as any).amount_tribes ?? tx.amount_kudos ?? 0;
                  return (
                    <div
                      key={tx.id || idx}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">{tx.description || tx.transaction_type}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{tx.created_at || "Recent"}</p>
                      </div>
                      <span className="font-mono font-bold text-amber-400">
                        +{amountVal.toLocaleString()} Tribes
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-6 text-xs text-slate-500">No transaction logs recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Earn Tribes & Referrals */}
        {activeTab === "referral" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2">
              <div className="flex items-center space-x-2">
                <UserPlus className="h-5 w-5 text-amber-400 shrink-0" />
                <strong className="font-bold text-amber-200 text-sm">3-Referral Unfreeze Engine</strong>
              </div>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Invite friends to join Tribely! Every 3 completed referrals unfreeze negative balances and award an instant <strong className="text-amber-200">+200 Tribes bonus</strong>.
              </p>

              {/* Progress Indicator */}
              <div className="pt-2">
                <div className="flex justify-between text-xs font-bold text-slate-200 mb-1">
                  <span>Referral Progress</span>
                  <span className="font-mono text-amber-400">{referralCount}/3 Completed</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (referralCount / 3) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleProcessReferral}
              disabled={actionLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 hover:from-amber-400 hover:to-emerald-400 disabled:opacity-50 active:scale-95 transition cursor-pointer shadow-lg flex items-center justify-center space-x-2"
            >
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Simulate / Record Friend Referral (+200 Tribes)</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
