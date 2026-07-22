"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../utils/api";

interface Arena {
  id: number;
  name: string;
  description: string;
  invite_code: string;
  proof_type: string;
  penalty_amount: number;
  deadline_time: string;
  is_private: boolean;
  membership_status?: "approved" | "pending";
  user_role?: "admin" | "member";
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center text-slate-500">
          Loading...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userName, setUserName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isProcessingJoin = useRef(false);

  // Creation State Management
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProofType, setNewProofType] = useState("image");
  const [newPenalty, setNewPenalty] = useState(500);
  const [isPrivate, setIsPrivate] = useState(false);

  // 12-Hour State Management
  const [deadlineHour, setDeadlineHour] = useState("10");
  const [deadlineMinute, setDeadlineMinute] = useState("00");
  const [deadlinePeriod, setDeadlinePeriod] = useState("PM");

  // Joining State Management
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("tribely_token");
    const storedUserId = localStorage.getItem("tribely_user_id");
    const storedName = localStorage.getItem("tribely_user_name");

    if (!token) {
      router.push("/login");
      return;
    }

    setUserName(storedName || "Tribe Member");

    const fetchProfileSummary = async () => {
      if (!storedUserId) {
        return;
      }

      try {
        const response = await api.get(`/users/profile/${storedUserId}`);
        setProfileImageUrl(response.data?.data?.profile_image_url || "");
      } catch {
        setProfileImageUrl("");
      }
    };

    const initializeDashboardState = async () => {
      await fetchProfileSummary();
      await fetchArenas();
      await checkAndProcessDeferredArenaJoin();
    };

    initializeDashboardState();
  }, []);

  useEffect(() => {
    if (searchParams?.get("create") === "1") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const fetchArenas = async () => {
    try {
      const response = await api.get("/api/arenas/");
      setArenas(response.data?.data || []);
    } catch (err: any) {
      setError("Could not retrieve your habit Arenas.");
    } finally {
      setLoading(false);
    }
  };

  const checkAndProcessDeferredArenaJoin = async () => {
    const pendingArenaId = sessionStorage.getItem("pending_join_arena_id");
    const isPrivateStr = sessionStorage.getItem("pending_join_is_private");

    if (!pendingArenaId || isProcessingJoin.current) return;
    isProcessingJoin.current = true;

    const clearPendingJoin = () => {
      sessionStorage.removeItem("pending_join_arena_id");
      sessionStorage.removeItem("pending_join_is_private");
    };

    const arenaId = parseInt(pendingArenaId, 10);
    if (Number.isNaN(arenaId)) {
      clearPendingJoin();
      isProcessingJoin.current = false;
      return;
    }

    try {
      const response = await api.post("/api/arenas/discovery/join", {
        arena_id: arenaId,
      });

      clearPendingJoin();

      const joinData = response.data?.data;

      if (joinData?.room_state === "pending" || isPrivateStr === "true") {
        setError(
          "Join request sent. The arena admin will review your request.",
        );
      } else {
        router.push(`/arena/${arenaId}`);
      }

      fetchArenas();
    } catch (err: any) {
      clearPendingJoin();

      const detail = err.response?.data?.detail;
      const errorCode =
        typeof detail === "object" && detail !== null
          ? detail.error_code
          : undefined;
      const message =
        typeof detail === "object" && detail !== null
          ? detail.message
          : typeof detail === "string"
            ? detail
            : undefined;

      if (err.response?.status === 404) {
        // Stale or sample arena id — ignore silently.
        fetchArenas();
      } else if (errorCode === "ARENA_MEMBERSHIP_ALREADY_APPROVED") {
        router.push(`/arena/${arenaId}`);
        fetchArenas();
      } else if (errorCode === "ARENA_MEMBERSHIP_PENDING") {
        setError(
          message ||
            "Your request to join that arena is already pending approval.",
        );
        fetchArenas();
      } else {
        setError(message || "Could not join the selected arena.");
        fetchArenas();
      }
    } finally {
      isProcessingJoin.current = false;
    }
  };

  const handleCreateArena = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const formattedDeadline = `${deadlineHour}:${deadlineMinute} ${deadlinePeriod}`;

    try {
      await api.post("/api/arenas/", {
        name: newName,
        description: newDesc,
        proof_type: newProofType,
        penalty_amount: Number(newPenalty),
        deadline_time: formattedDeadline,
        is_private: isPrivate,
      });

      setShowCreateModal(false);
      setNewName("");
      setNewDesc("");
      setIsPrivate(false);
      fetchArenas();
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to establish your accountability Arena.",
      );
    }
  };

  const handleJoinArena = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanCode = inviteCode.trim().toUpperCase();

    try {
      const response = await api.post("/api/arenas/join-by-code", {
        invite_code: cleanCode,
      });
      alert(
        response.data?.data?.detail || "Join response evaluated successfully.",
      );
      setShowJoinModal(false);
      setInviteCode("");
      fetchArenas();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to join via invite key.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 md:px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-lg md:text-xl font-bold bg-linear-to-r from-[#5B4DFF] to-[#2F80ED] bg-clip-text text-transparent">
          TRIBELY<span className="hidden sm:inline"> WORKSPACE</span>
        </h1>
        <div className="flex items-center gap-2 md:gap-4">
          {/* Profile Link - Full on desktop, icon-only on mobile */}
          <Link
            href="/profile"
            className="hidden md:flex items-center gap-3 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 transition hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{(userName || "T").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Profile
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Welcome, {userName}
              </span>
            </div>
          </Link>

          {/* Mobile Profile Icon Only */}
          <Link
            href="/profile"
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{(userName || "T").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
          </Link>

          {/* Logout - Text on desktop, Icon on mobile */}
          <button
            onClick={() => {
              localStorage.clear();
              router.push("/login");
            }}
            title="Log Out"
            className="hidden md:block text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-full transition active:scale-95"
          >
            Log Out
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              router.push("/login");
            }}
            title="Log Out"
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition active:scale-95 text-lg"
          >
            ↪️
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 p-4 rounded-2xl text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Your Accountability Arenas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Conquer your skin-in-the-game habit challenges with local stakes.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 text-sm font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-full transition shadow-sm"
            >
              Join via Code
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-semibold bg-[#5B4DFF] hover:bg-[#4B3EEB] text-white rounded-full transition shadow-lg shadow-indigo-600/20"
            >
              + Create Arena
            </button>
          </div>
        </div>

        {arenas.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[28px] p-12 text-center max-w-md mx-auto mt-12 shadow-sm">
            <div className="text-4xl mb-4">🥋</div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">
              No active Arenas found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
              Create an accountability structure and set custom stakes to back
              your discipline.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-semibold bg-[#5B4DFF]/10 text-[#5B4DFF] hover:bg-[#5B4DFF] hover:text-white rounded-full transition"
            >
              Instantiate Your First Arena
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {arenas.map((arena) => {
              const isPending = arena.membership_status === "pending";
              return (
                <div
                  key={arena.id}
                  className={`border rounded-[28px] p-6 flex flex-col justify-between transition duration-300 shadow-sm ${
                    isPending
                      ? "bg-slate-50/80 dark:bg-slate-950/60 border-amber-300/80 dark:border-amber-900/60 opacity-85"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight line-clamp-1">
                        {arena.name}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isPending ? (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <span>🔒</span> Pending Approval
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                              arena.is_private
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                            }`}
                          >
                            {arena.is_private ? "Private" : "Public"}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold bg-[#F1F5F9] dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                          {arena.invite_code}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 h-10">
                      {arena.description || "No description set."}
                    </p>

                    <div className="mt-4 space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Proof Action Required:</span>
                        <span className="text-slate-900 dark:text-slate-100 capitalize font-semibold">
                          {arena.proof_type} Only
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Cutoff Deadline:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono font-semibold">
                          {arena.deadline_time}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Stakes / Penalty:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ₹ {arena.penalty_amount} INR
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => !isPending && router.push(`/arena/${arena.id}`)}
                    disabled={isPending}
                    className={`w-full mt-6 py-2.5 text-xs font-bold text-center rounded-full transition shadow-md ${
                      isPending
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60 cursor-not-allowed"
                        : "bg-slate-950 dark:bg-indigo-600 hover:bg-[#5B4DFF] text-white border border-transparent active:scale-95"
                    }`}
                  >
                    {isPending ? "🔒 Pending Admin Approval" : "Enter Battle Arena"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CREATE ARENA MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-1">
              Create Accountability Arena
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Architect custom rules bounds for habit validation tracking
              matrices.
            </p>

            <form onSubmit={handleCreateArena} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Arena Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 5AM Lean Dev Club"
                  className="w-full px-3 py-3 bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-300"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  placeholder="What is the daily mandate?"
                  rows={2}
                  className="w-full px-3 py-3 bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-300 resize-none"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Arena Privacy Visibility Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`py-2 px-3 text-xs font-bold rounded-full border text-center transition ${!isPrivate ? "bg-[#5B4DFF]/10 border-[#5B4DFF]/20 text-[#5B4DFF]" : "bg-[#F8FAFC] dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"}`}
                  >
                    🔓 Public (Open Click)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`py-2 px-3 text-xs font-bold rounded-full border text-center transition ${isPrivate ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300" : "bg-[#F8FAFC] dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"}`}
                  >
                    🔒 Private (Admin Review)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Validation Proof
                  </label>
                  <select
                    className="w-full px-3 py-3 bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-300"
                    value={newProofType}
                    onChange={(e) => setNewProofType(e.target.value)}
                  >
                    <option value="image" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">📸 Screenshot / Image</option>
                    <option value="text" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">✍️ Text Confirmation</option>
                    <option value="link" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🔗 Hyperlink URL</option>
                  </select>
                </div>

                {/* THE FIXED DROP-DOWN BLOCK */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Daily Deadline
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 h-9.5 items-center">
                    <select
                      value={deadlineHour}
                      onChange={(e) => setDeadlineHour(e.target.value)}
                      className="bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none w-full text-center cursor-pointer border-none"
                    >
                      {Array.from({ length: 12 }, (_, i) =>
                        String(i + 1).padStart(2, "0"),
                      ).map((h) => (
                        <option
                          key={h}
                          value={h}
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {h}
                        </option>
                      ))}
                    </select>

                    <select
                      value={deadlineMinute}
                      onChange={(e) => setDeadlineMinute(e.target.value)}
                      className="bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none w-full text-center cursor-pointer border-none"
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {m}
                        </option>
                      ))}
                    </select>

                    <select
                      value={deadlinePeriod}
                      onChange={(e) => setDeadlinePeriod(e.target.value)}
                      className="bg-[#5B4DFF]/10 text-xs font-bold text-[#5B4DFF] rounded-2xl h-full text-center cursor-pointer border border-[#5B4DFF]/20"
                    >
                      <option value="AM" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        AM
                      </option>
                      <option value="PM" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        PM
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Penalty Stake Amount (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm font-bold text-gray-500 dark:text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    required
                    className="w-full pl-7 pr-3 py-3 bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-300"
                    value={newPenalty}
                    onChange={(e) => setNewPenalty(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm font-semibold bg-[#5B4DFF] hover:bg-[#4B3EEB] text-white rounded-full transition shadow-lg shadow-indigo-600/20"
                >
                  Launch Arena
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ARENA MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] w-full max-w-sm p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-1">
              Join via Invitation Key
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Enter a 6-character alpha-numeric room code.
            </p>
            <form onSubmit={handleJoinArena} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                required
                placeholder="A7B9X2"
                className="w-full px-4 py-3 bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-lg font-mono font-bold uppercase text-[#5B4DFF] placeholder-slate-400 dark:placeholder-slate-600 tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-300"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition active:scale-95"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-sm font-semibold bg-[#5B4DFF] hover:bg-[#4B3EEB] text-white rounded-xl transition shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  Verify & Enter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
