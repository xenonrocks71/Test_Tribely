"use client";

import React, { useState, useEffect } from "react";
import { Coins, ArrowUpRight, ArrowDownLeft, ShieldCheck, Zap, RefreshCw, X, AlertCircle, CheckCircle } from "lucide-react";

interface KudosWalletData {
  kudos_balance: number;
  inr_value: number;
  upi_vpa: string | null;
  min_withdrawal_kudos: number;
  min_purchase_inr: number;
  recent_transactions: Array<{
    id: number;
    transaction_type: string;
    amount_kudos: number;
    description: string;
    created_at: string;
  }>;
}

interface KudosWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KudosWalletModal({ isOpen, onClose }: KudosWalletModalProps) {
  const [activeTab, setActiveTab] = useState<"wallet" | "buy" | "withdraw">("wallet");
  const [data, setData] = useState<KudosWalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [inrAmount, setInrAmount] = useState(50);
  const [withdrawKudos, setWithdrawKudos] = useState(20000);
  const [upiVpa, setUpiVpa] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/kudos/wallet", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (result.status === "success") {
        setData(result.data);
        if (result.data.upi_vpa) {
          setUpiVpa(result.data.upi_vpa);
        }
      }
    } catch (err) {
      console.error("Failed to fetch Kudos wallet data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWalletData();
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBuyKudos = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token");
      const buyRes = await fetch("http://localhost:8000/api/kudos/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inr_amount: inrAmount }),
      });
      const buyData = await buyRes.json();

      if (buyData.status !== "success") {
        throw new Error(buyData.detail || "Failed to initiate Kudos purchase.");
      }

      // Simulate payment verification (or Razorpay Checkout integration)
      const verifyRes = await fetch("http://localhost:8000/api/kudos/buy/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          razorpay_order_id: buyData.data.order_id,
          razorpay_payment_id: `pay_rzp_${Date.now()}`,
          razorpay_signature: "verified_sig",
          inr_amount: inrAmount,
        }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status === "success") {
        setMessage({
          type: "success",
          text: `🎉 Successfully purchased ${verifyData.data.kudos_credited.toLocaleString()} Kudos for ₹${inrAmount}!`,
        });
        fetchWalletData();
        setActiveTab("wallet");
      } else {
        throw new Error(verifyData.detail || "Payment verification failed.");
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Kudos purchase failed." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setActionLoading(true);
    setMessage(null);

    if (withdrawKudos < 20000) {
      setMessage({ type: "error", text: "Minimum withdrawal threshold is 20,000 Kudos (₹200 INR)." });
      setActionLoading(false);
      return;
    }

    if (!upiVpa || !upiVpa.includes("@")) {
      setMessage({ type: "error", text: "Please enter a valid UPI ID (e.g., name@upi)." });
      setActionLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/kudos/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          kudos_amount: withdrawKudos,
          upi_vpa: upiVpa,
        }),
      });
      const result = await res.json();

      if (result.status === "success") {
        setMessage({
          type: "success",
          text: `✅ ${result.data.message}`,
        });
        fetchWalletData();
        setActiveTab("wallet");
      } else {
        throw new Error(result.detail || "Withdrawal failed.");
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Withdrawal failed." });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto styled-scroll animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[88vh] flex flex-col overflow-y-auto styled-scroll rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-black p-5 sm:p-6 shadow-2xl shadow-amber-500/10 text-white my-auto">

        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <Coins className="h-7 w-7 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-amber-400">Tribely Kudos Economy</h2>
            <p className="text-xs text-slate-400">Digital Currency & Consistency Reward Ecosystem</p>
          </div>
        </div>

        {/* Balance Card Banner */}
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 p-5 shadow-inner">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">Available Balance</span>
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-amber-400">
                  {data ? data.kudos_balance.toLocaleString() : "..."}
                </span>
                <span className="text-sm font-bold text-amber-200/90">Kudos</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                ≈ ₹{data ? data.inr_value.toFixed(2) : "0.00"} INR Real Value
              </p>
            </div>
            <button
              onClick={fetchWalletData}
              disabled={loading}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-800 pb-3 mb-5">
          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "wallet"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Overview & Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab("buy")}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "buy"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>Buy Kudos (₹50)</span>
          </button>
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "withdraw"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Withdraw to UPI</span>
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Double-Entry Transactions</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {data?.recent_transactions && data.recent_transactions.length > 0 ? (
                data.recent_transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{tx.description || tx.transaction_type}</span>
                      <p className="text-[10px] text-slate-500">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <span
                      className={`font-mono font-bold ${
                        tx.amount_kudos > 0 ? "text-amber-400" : "text-rose-400"
                      }`}
                    >
                      +{tx.amount_kudos.toLocaleString()} Kudos
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-xs text-slate-500">No transaction logs recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Buy Kudos */}
        {activeTab === "buy" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start space-x-2.5">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-200">🔒 Online Top-ups Disabled for MVP</strong>
                <p className="mt-0.5 text-[11px] text-amber-300/90 leading-relaxed">
                  Direct Razorpay payment gateway top-ups are temporarily locked for MVP release. Every newly registered user automatically receives a <strong className="text-amber-200">1,000 Kudos welcome bonus</strong>!
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 opacity-60">
              <span className="text-xs font-semibold text-slate-300">Select Purchase Package (Preview)</span>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[50, 100, 500].map((amt) => (
                  <div
                    key={amt}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      inrAmount === amt
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                        : "border-slate-800 bg-slate-900 text-slate-400"
                    }`}
                  >
                    <div className="text-base font-black">₹{amt}</div>
                    <div className="text-[10px] font-bold text-amber-400 mt-1">+{(amt * 100).toLocaleString()} Kudos</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled={true}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 py-3 text-xs font-bold text-slate-400 cursor-not-allowed shadow-none"
            >
              🔒 Payment Gateway Top-ups Disabled for MVP (Coming Soon)
            </button>
          </div>
        )}

        {/* Tab Content 3: Withdraw to UPI */}
        {activeTab === "withdraw" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start space-x-2.5">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-200">🔒 UPI Cashouts Disabled for MVP</strong>
                <p className="mt-0.5 text-[11px] text-amber-300/90 leading-relaxed">
                  Real-money UPI payouts via RazorpayX are temporarily locked for MVP release. Minimum cashout threshold is 20,000 Kudos (₹200 INR).
                </p>
              </div>
            </div>

            <div className="space-y-3 opacity-60">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Kudos Amount to Withdraw</label>
                <input
                  type="number"
                  disabled={true}
                  value={20000}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-mono text-slate-400 cursor-not-allowed"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Equivalent: ₹200.00 INR Real Money
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">UPI VPA Address (Google Pay / PhonePe)</label>
                <input
                  type="text"
                  disabled={true}
                  value="user@upi"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-mono text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            <button
              disabled={true}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 py-3 text-xs font-bold text-slate-400 cursor-not-allowed shadow-none"
            >
              🔒 UPI Cashouts Temporarily Disabled for MVP
            </button>
          </div>
        )}



      </div>
    </div>
  );
}
