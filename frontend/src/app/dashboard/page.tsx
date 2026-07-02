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
    <div className="min-h-screen bg-[#F3F4F6] text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold bg-linear-to-r from-[#5B4DFF] to-[#2F80ED] bg-clip-text text-transparent">
          TRIBELY WORKSPACE
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 transition hover:border-indigo-300 hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
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
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Profile
              </span>
              <span className="text-sm font-medium text-slate-700">
                Welcome, {userName}
              </span>
            </div>
          </Link>
          <button
            onClick={() => {
              localStorage.clear();
              router.push("/login");
            }}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-full transition"
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
              Your Accountability Arenas
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Conquer your skin-in-the-game habit challenges with local stakes.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 text-sm font-semibold bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition shadow-sm"
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
          <div className="border border-dashed border-slate-200 bg-white rounded-[28px] p-12 text-center max-w-md mx-auto mt-12 shadow-sm">
            <div className="text-4xl mb-4">🥋</div>
            <h3 className="text-lg font-bold text-slate-950">
              No active Arenas found
            </h3>
            <p className="text-sm text-slate-500 mt-1 mb-6">
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
            {arenas.map((arena) => (
              <div
                key={arena.id}
                className="bg-white border border-slate-200 rounded-[28px] p-6 flex flex-col justify-between hover:border-indigo-300 transition duration-300 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-950 tracking-tight line-clamp-1">
                      {arena.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${arena.is_private ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}
                      >
                        {arena.is_private ? "Private" : "Public"}
                      </span>
                      <span className="text-xs font-mono font-bold bg-[#F1F5F9] text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        {arena.invite_code}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2 h-10">
                    {arena.description || "No description set."}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-xs font-medium text-slate-500">
                    <div className="flex justify-between">
                      <span>Proof Action Required:</span>
                      <span className="text-slate-900 capitalize font-semibold">
                        {arena.proof_type} Only
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily Cutoff Deadline:</span>
                      <span className="text-slate-900 font-mono font-semibold">
                        {arena.deadline_time}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stakes / Penalty:</span>
                      <span className="text-emerald-600 font-bold">
                        ₹ {arena.penalty_amount} INR
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/arena/${arena.id}`)}
                  className="w-full mt-6 py-2.5 text-xs font-bold text-center bg-slate-950 hover:bg-[#5B4DFF] text-white rounded-full border border-transparent transition"
                >
                  Enter Battle Arena
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE ARENA MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-[28px] w-full max-w-md p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] relative">
            <h3 className="text-xl font-bold text-slate-950 mb-1">
              Create Accountability Arena
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Architect custom rules bounds for habit validation tracking
              matrices.
            </p>

            <form onSubmit={handleCreateArena} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Arena Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 5AM Lean Dev Club"
                  className="w-full px-3 py-3 bg-[#F8FAFC] border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  placeholder="What is the daily mandate?"
                  rows={2}
                  className="w-full px-3 py-3 bg-[#F8FAFC] border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 resize-none"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Arena Privacy Visibility Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`py-2 px-3 text-xs font-bold rounded-full border text-center transition ${!isPrivate ? "bg-[#5B4DFF]/10 border-[#5B4DFF]/20 text-[#5B4DFF]" : "bg-[#F8FAFC] border-slate-200 text-slate-500"}`}
                  >
                    🔓 Public (Open Click)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`py-2 px-3 text-xs font-bold rounded-full border text-center transition ${isPrivate ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-[#F8FAFC] border-slate-200 text-slate-500"}`}
                  >
                    🔒 Private (Admin Review)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Validation Proof
                  </label>
                  <select
                    className="w-full px-3 py-3 bg-[#F8FAFC] border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                    value={newProofType}
                    onChange={(e) => setNewProofType(e.target.value)}
                  >
                    <option value="image">📸 Screenshot / Image</option>
                    <option value="text">✍️ Text Confirmation</option>
                    <option value="link">🔗 Hyperlink URL</option>
                  </select>
                </div>

                {/* THE FIXED DROP-DOWN BLOCK */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Daily Deadline
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#F8FAFC] border border-slate-200 rounded-2xl p-1 h-9.5 items-center">
                    <select
                      value={deadlineHour}
                      onChange={(e) => setDeadlineHour(e.target.value)}
                      className="bg-transparent text-sm text-slate-900 focus:outline-none w-full text-center cursor-pointer border-none"
                    >
                      {Array.from({ length: 12 }, (_, i) =>
                        String(i + 1).padStart(2, "0"),
                      ).map((h) => (
                        <option
                          key={h}
                          value={h}
                          className="bg-white text-slate-900"
                        >
                          {h}
                        </option>
                      ))}
                    </select>

                    <select
                      value={deadlineMinute}
                      onChange={(e) => setDeadlineMinute(e.target.value)}
                      className="bg-transparent text-sm text-slate-900 focus:outline-none w-full text-center cursor-pointer border-none"
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-white text-slate-900"
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
                      <option value="AM" className="bg-white text-slate-900">
                        AM
                      </option>
                      <option value="PM" className="bg-white text-slate-900">
                        PM
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Penalty Stake Amount (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm font-bold text-gray-500">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    required
                    className="w-full pl-7 pr-3 py-3 bg-[#F8FAFC] border border-slate-200 rounded-2xl text-sm text-slate-900 font-mono focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                    value={newPenalty}
                    onChange={(e) => setNewPenalty(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-[28px] w-full max-w-sm p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] relative">
            <h3 className="text-xl font-bold text-slate-950 mb-1">
              Join via Invitation Key
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Enter a 6-character alpha-numeric room code.
            </p>
            <form onSubmit={handleJoinArena} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                required
                placeholder="A7B9X2"
                className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-2xl text-center text-lg font-mono font-bold uppercase text-[#5B4DFF] placeholder-slate-400 tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2 text-sm font-semibold bg-gray-800 hover:bg-gray-700 rounded-xl transition"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
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
