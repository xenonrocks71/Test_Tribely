"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../utils/api";
import { API_BASE_URL } from "../../utils/config";

interface Submission {
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

interface Message {
  id: number;
  user_id: number;
  sender_name: string;
  sender_avatar_url?: string | null;
  content: string;
  message_type: string;
  created_at: string;
}

interface PendingRequest {
  id: number;
  user_id: number;
  user_name?: string;
  arena_id: number;
  status: string;
}

interface InviteAssets {
  invite_code: string;
  invite_link: string;
  qr_payload_string: string;
}

interface ArenaMember {
  user_id: number;
  full_name: string;
  email: string;
  common_arenas_count: number;
}

type ArenaProofType = "text" | "image" | "link";

export default function ArenaRoomPage() {
  const { id } = useParams();
  const router = useRouter();

  const [userId, setUserId] = useState<number | null>(null);
  const [arenaName, setArenaName] = useState<string>("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [inviteAssets, setInviteAssets] = useState<InviteAssets | null>(null);
  const [arenaProofType, setArenaProofType] = useState<ArenaProofType>("text");
  const [arenaDeadlineTime, setArenaDeadlineTime] = useState("10:00 PM");

  const [proofUrl, setProofUrl] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [selectedProofPreviewUrl, setSelectedProofPreviewUrl] = useState<
    string | null
  >(null);
  const [chatInput, setChatInput] = useState("");
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [viewerZoom, setViewerZoom] = useState(1);

  // Modal / Sidebar Controls
  const [arenaMembers, setArenaMembers] = useState<ArenaMember[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showMobileLedger, setShowMobileLedger] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement | null>(null);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const renderAvatar = (
    name: string,
    imageUrl?: string | null,
    className: string = "w-8 h-8 rounded-full text-xs font-bold shrink-0",
  ) => {
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={name}
          className={`${className} object-cover border border-slate-200 dark:border-slate-800`}
        />
      );
    }
    return (
      <div
        className={`${className} bg-gradient-to-tr from-[#0095F6] to-[#A855F7] text-white flex items-center justify-center shadow-xs`}
      >
        {getInitials(name || "User")}
      </div>
    );
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/api/activity/arena/${id}/history`);
      const payload = res.data?.data;

      if (payload) {
        if (Array.isArray(payload.submissions))
          setSubmissions(payload.submissions);
        if (Array.isArray(payload.messages)) setMessages(payload.messages);
      }
    } catch (err: any) {
      console.error("Failed to load historical telemetry:", err);
      if (err?.response?.status === 403) {
        setError("Membership approval required to access this arena.");
      }
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await api.get(`/api/admin/arenas/${id}/requests`);
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setPendingRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch pending requests", err);
    }
  };

  const fetchInviteAssets = async () => {
    try {
      const res = await api.get(`/api/admin/arenas/${id}/invite-assets`);
      if (res.data?.data) {
        setInviteAssets(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch invite assets", err);
    }
  };

  const fetchMembersList = async () => {
    try {
      const res = await api.get(`/api/arenas/${id}/members`);
      if (Array.isArray(res.data?.data)) {
        setArenaMembers(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load arena members list", err);
    }
  };

  useEffect(() => {
    const localUserId = localStorage.getItem("tribely_user_id");
    if (localUserId) setUserId(Number(localUserId));

    fetchHistory();
    fetchMembersList();

    const checkAdminPrivileges = async () => {
      try {
        const arenasRes = await api.get("/api/arenas/");
        const userArenas = arenasRes.data?.data || [];
        const currentArena = userArenas.find((a: any) => a.id === Number(id));

        if (currentArena) {
          setArenaName(currentArena.name);
          setArenaProofType(
            (currentArena.proof_type as ArenaProofType) || "text",
          );
          setArenaDeadlineTime(currentArena.deadline_time || "10:00 PM");

          if (currentArena.user_role === "admin") {
            setIsAdmin(true);
            fetchPendingRequests();
            fetchInviteAssets();
          }
        }
      } catch (err) {
        console.error("Arena initialization error:", err);
        setArenaName(`Chamber #${id}`);
      }
    };
    checkAdminPrivileges();

    // Setup Live WebSocket Channel for Chat AND Real-time Ledger Sync
    const wsBase = API_BASE_URL.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/ws/arena/${id}`;
    const wsToken = localStorage.getItem("tribely_token");
    const ws = new WebSocket(
      wsToken ? `${wsUrl}?token=${encodeURIComponent(wsToken)}` : wsUrl,
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const liveData = JSON.parse(event.data);

        // Real-Time Ledger Sync
        if (liveData?.event_type === "ledger_update") {
          if (liveData.action === "submission_created" && liveData.submission) {
            setSubmissions((prev) => [
              liveData.submission,
              ...prev.filter((s) => s.id !== liveData.submission.id),
            ]);
          } else if (liveData.action === "vote_updated") {
            setSubmissions((prev) =>
              prev.map((sub) =>
                sub.id === liveData.submission_id
                  ? {
                      ...sub,
                      upvotes: liveData.upvotes,
                      downvotes: liveData.downvotes,
                      is_absent: liveData.is_absent,
                    }
                  : sub,
              ),
            );
          } else {
            fetchHistory();
          }
          return;
        }

        // Live Chat Sync
        setMessages((prev) => [liveData, ...prev]);
      } catch (e) {
        console.error("Failed to parse socket payload:", e);
      }
    };

    ws.onerror = () => {};

    return () => {
      ws.close();
    };
  }, [id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const parseDeadlineDate = (deadlineTime: string) => {
    const [timePart, periodPart] = deadlineTime.trim().split(" ");
    const [hourPart, minutePart] = timePart.split(":");
    let hour = Number(hourPart);
    const minute = Number(minutePart);
    const period = (periodPart || "AM").toUpperCase();

    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0,
    );
  };

  const getActiveProofWindowStart = () => {
    const cutoff = parseDeadlineDate(arenaDeadlineTime);
    return new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);
  };

  const hasUserSubmittedInActiveWindow = () => {
    if (!userId) return false;
    const windowStart = getActiveProofWindowStart();

    return submissions.some((sub) => {
      if (sub.user_id !== userId) return false;
      const submittedAtDate = new Date(sub.submitted_at);
      return submittedAtDate >= windowStart;
    });
  };

  const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSelectedProofPreviewUrl(dataUrl);
      setProofUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSendProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (hasUserSubmittedInActiveWindow()) {
      setError("Proof already verified for the current active window.");
      return;
    }

    if (!proofUrl.trim()) {
      setError("Proof payload cannot be empty.");
      return;
    }

    if (arenaProofType === "link") {
      if (!proofUrl.startsWith("http://") && !proofUrl.startsWith("https://")) {
        setError("This arena requires a valid http:// or https:// URL link.");
        return;
      }
    }

    const payload = {
      arena_id: Number(id),
      proof_url: proofUrl,
      client_submitted_at: new Date().toISOString(),
    };

    try {
      await api.post("/api/activity/submit", payload);
      setProofUrl("");
      setProofFileName("");
      setSelectedProofPreviewUrl(null);
      fetchHistory();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = "Proof submission failed.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (detail?.message) {
        msg = detail.message;
      }
      setError(msg);
    }
  };

  const handleVoteSubmission = async (
    submissionId: number,
    voteType: "upvote" | "downvote",
  ) => {
    try {
      await api.post(`/api/activity/submission/${submissionId}/vote`, {
        vote_type: voteType,
      });
      fetchHistory();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === "string" ? detail : detail?.message || "Vote failed.";
      alert(msg);
    }
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;

    wsRef.current.send(
      JSON.stringify({
        content: chatInput,
        message_type: "text",
      }),
    );
    setChatInput("");
  };

  // --- NEW: Handle Proof Type Change (Admin) ---
  const handleUpdateProofType = async (newType: string) => {
    try {
      await api.patch(`/api/admin/arenas/${id}/proof-type`, {
        proof_type: newType,
      });
      setArenaProofType(newType as ArenaProofType);

      // Clear out any in-progress proof if the type changed
      setProofUrl("");
      setSelectedProofPreviewUrl(null);
      setProofFileName("");

      alert(`Arena verification rule updated to strictly accept: ${newType}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to update proof type.";
      alert(msg);
    }
  };

  // --- NEW: Handle Leaving the Arena (Any Member) ---
  const handleLeaveArena = async () => {
    const confirmLeave = window.confirm(
      "Are you sure you want to leave this arena? Your history will remain, but you will lose access.",
    );
    if (!confirmLeave) return;

    try {
      await api.post(`/api/arenas/${id}/leave`);
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to leave the arena.";
      alert(msg);
    }
  };

  const handleApprove = async (reqUserId: number) => {
    try {
      await api.post("/api/admin/arenas/approve", {
        arena_id: Number(id),
        user_id: reqUserId,
      });
      fetchPendingRequests();
      fetchMembersList();
    } catch (err: any) {
      setError("Failed to approve membership.");
    }
  };

  const handleReject = async (reqUserId: number) => {
    try {
      await api.post("/api/admin/arenas/reject", {
        arena_id: Number(id),
        user_id: reqUserId,
      });
      fetchPendingRequests();
    } catch (err: any) {
      setError("Failed to reject membership.");
    }
  };

  const openImageViewer = (imageUrl: string) => {
    setViewerImageUrl(imageUrl);
    setViewerZoom(1);
  };

  const closeImageViewer = () => {
    setViewerImageUrl(null);
    setViewerZoom(1);
  };

  const getProofComposerLabel = () => {
    if (arenaProofType === "image") return "Image Proof Required";
    if (arenaProofType === "link") return "External Link Required";
    return "Text Proof Required";
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-md px-4 py-3 shrink-0 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <Link
            href="/dashboard"
            className="text-slate-600 dark:text-slate-300 hover:text-[#0095F6] transition font-bold text-base p-1 rounded-full"
            title="Back to Dashboard"
          >
            ←
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            {renderAvatar(
              arenaName || `Arena #${id}`,
              null,
              "w-9 h-9 rounded-full shrink-0",
            )}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold text-slate-900 dark:text-white tracking-tight capitalize">
                {arenaName || `Chamber #${id}`}
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Arena Sync</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowMobileLedger(!showMobileLedger)}
            className="lg:hidden text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full active:bg-slate-200 dark:active:bg-slate-700 transition font-bold flex items-center gap-1.5 shadow-xs"
          >
            <span>📋 Ledger</span>
          </button>

          <button
            onClick={() => setShowMembersModal(true)}
            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full active:bg-slate-200 dark:active:bg-slate-700 transition font-medium"
          >
            👥 Info ({arenaMembers.length})
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="text-xs bg-[#0095F6] hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-full transition shadow-xs"
            >
              ⚙️ Admin
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 p-2 text-xs text-center shrink-0">
          {error}
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* REAL-TIME CHAT STREAM */}
        <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] relative border-r border-slate-200/60 dark:border-slate-800/60">
          <div className="flex-1 px-3 sm:px-4 py-4 overflow-y-auto flex flex-col-reverse gap-3 pb-24">
            <div ref={chatBottomRef} />

            {messages.length === 0 ? (
              <div className="my-auto text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-slate-900 text-[#0095F6] text-2xl flex items-center justify-center mx-auto mb-3">
                  💬
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Messages Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Start the conversation! Dispatch messages to your battle room.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.user_id === userId;
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex max-w-[88%] sm:max-w-[75%] items-end gap-2 ${
                      isMe ? "self-end flex-row-reverse" : "self-start"
                    }`}
                  >
                    {!isMe &&
                      renderAvatar(
                        msg.sender_name,
                        msg.sender_avatar_url,
                        "w-7 h-7 rounded-full shrink-0 mb-1",
                      )}

                    <div className="flex min-w-0 max-w-full flex-col">
                      {!isMe && (
                        <span className="mb-1 ml-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {msg.sender_name}
                        </span>
                      )}
                      <div
                        className={`w-fit max-w-[78vw] sm:max-w-md px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap wrap-break-word shadow-xs transition ${
                          isMe
                            ? "bg-gradient-to-r from-[#0095F6] via-indigo-600 to-[#A855F7] text-white rounded-[22px] rounded-br-[4px]"
                            : "bg-white dark:bg-[#262626] border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white rounded-[22px] rounded-bl-[4px]"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleSendChatMessage}
            className="absolute bottom-0 inset-x-0 p-3 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex gap-2 items-center shrink-0 z-20"
          >
            <button
              type="button"
              onClick={() => setShowMobileLedger(true)}
              className="p-2.5 rounded-full bg-[#0095F6] text-white hover:bg-blue-600 active:scale-95 transition shrink-0 shadow-xs"
              title="Submit Proof / Open Ledger"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            <input
              type="text"
              required
              placeholder="Message..."
              className="flex-1 px-4 py-2.5 bg-[#F1F5F9] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700/80 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0095F6] transition"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />

            <button
              type="submit"
              className="px-3.5 py-2 font-bold text-sm text-[#0095F6] dark:text-[#3897F0] hover:opacity-80 transition shrink-0 active:scale-95"
            >
              Send
            </button>
          </form>
        </div>

        {/* REAL-TIME LEDGER STREAM ROOM */}
        {showMobileLedger && (
          <div
            onClick={() => setShowMobileLedger(false)}
            className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40"
          />
        )}

        <div
          className={`fixed lg:relative inset-y-0 right-0 z-40 w-full sm:w-[420px] lg:w-[380px] xl:w-[440px] shrink-0 bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none ${
            showMobileLedger
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0F172A]">
            <div>
              <h3 className="text-sm font-extrabold text-slate-950 dark:text-white tracking-wide flex items-center gap-2">
                <span>📋 Live Proof Stream</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time activity & verification votes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Sync
              </span>
              <button
                onClick={() => setShowMobileLedger(false)}
                className="lg:hidden text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-[#F8FAFC] dark:bg-[#090D16]">
            {/* STRICT PROOF COMPOSER FORM BASED ON ADMIN CONFIGURATION */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]/60 p-4 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">
                  Submit Proof
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 font-bold capitalize">
                  {getProofComposerLabel()}
                </span>
              </div>

              <form onSubmit={handleSendProof} className="space-y-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] p-3">
                  {/* TYPE 1: STRICT TEXT SUBMISSION */}
                  {arenaProofType === "text" && (
                    <textarea
                      required
                      disabled={hasUserSubmittedInActiveWindow()}
                      rows={3}
                      placeholder={
                        hasUserSubmittedInActiveWindow()
                          ? "Proof already verified for active window."
                          : "Describe your completed task..."
                      }
                      className="w-full resize-none bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                    />
                  )}

                  {/* TYPE 2: STRICT LINK SUBMISSION */}
                  {arenaProofType === "link" && (
                    <input
                      type="url"
                      required
                      disabled={hasUserSubmittedInActiveWindow()}
                      placeholder={
                        hasUserSubmittedInActiveWindow()
                          ? "Proof already verified for active window."
                          : "https://example.com/proof-link"
                      }
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                    />
                  )}

                  {/* TYPE 3: STRICT IMAGE SUBMISSION */}
                  {arenaProofType === "image" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={hasUserSubmittedInActiveWindow()}
                          onClick={() => proofFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40"
                        >
                          📷 Choose Image File
                        </button>
                        <input
                          ref={proofFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProofFileSelect}
                          disabled={hasUserSubmittedInActiveWindow()}
                        />
                        {proofFileName && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {proofFileName}
                          </span>
                        )}
                      </div>

                      {selectedProofPreviewUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            openImageViewer(selectedProofPreviewUrl)
                          }
                          className="group block w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left"
                        >
                          <img
                            src={selectedProofPreviewUrl}
                            alt="Selected proof preview"
                            className="max-h-36 w-full object-cover transition group-hover:scale-[1.01]"
                          />
                        </button>
                      )}

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                        <input
                          type="text"
                          disabled={hasUserSubmittedInActiveWindow()}
                          placeholder={
                            hasUserSubmittedInActiveWindow()
                              ? "Proof already submitted."
                              : "Or paste direct image URL (https://...)"
                          }
                          className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                          value={
                            proofUrl.startsWith("data:image/") ? "" : proofUrl
                          }
                          onChange={(e) => {
                            setSelectedProofPreviewUrl(null);
                            setProofFileName("");
                            setProofUrl(e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={hasUserSubmittedInActiveWindow()}
                  className="w-full py-2.5 bg-[#0095F6] hover:bg-blue-600 active:bg-blue-700 text-white font-bold text-xs rounded-full transition shadow-xs disabled:opacity-40"
                >
                  {hasUserSubmittedInActiveWindow()
                    ? "✓ Proof Submitted"
                    : "Submit Daily Proof"}
                </button>
              </form>
            </div>

            {/* REAL-TIME SUBMISSION LEDGER */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-1">
                Submissions Stream ({submissions.length})
              </h4>

              {submissions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No submissions recorded yet for this active cycle.
                </div>
              ) : (
                submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs transition animate-fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderAvatar(
                          sub.user_name,
                          sub.user_avatar_url,
                          "w-6 h-6 rounded-full shrink-0",
                        )}
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {sub.user_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(sub.submitted_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      {sub.proof_url.startsWith("data:image/") ||
                      sub.proof_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <button
                          type="button"
                          onClick={() => openImageViewer(sub.proof_url)}
                          className="block w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                        >
                          <img
                            src={sub.proof_url}
                            alt="Submitted proof"
                            className="max-h-40 w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : sub.proof_url.startsWith("http://") ||
                        sub.proof_url.startsWith("https://") ? (
                        <a
                          href={sub.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-[#0095F6] underline truncate"
                        >
                          🔗 {sub.proof_url}
                        </a>
                      ) : (
                        <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                          {sub.proof_url}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVoteSubmission(sub.id, "upvote")}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-900/50 hover:scale-105 active:scale-95 transition"
                        >
                          <span>👍</span> {sub.upvotes || 0}
                        </button>
                        <button
                          onClick={() =>
                            handleVoteSubmission(sub.id, "downvote")
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-900/50 hover:scale-105 active:scale-95 transition"
                        >
                          <span>👎</span> {sub.downvotes || 0}
                        </button>
                      </div>
                      {sub.is_absent ? (
                        <span className="text-[10px] font-bold text-rose-500">
                          ❌ Failed
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Arena Members ({arenaMembers.length})
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {arenaMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60"
                >
                  <div className="flex items-center gap-2.5">
                    {renderAvatar(
                      member.full_name,
                      null,
                      "w-8 h-8 rounded-full",
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {member.full_name}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
                    {member.common_arenas_count} Common
                  </span>
                </div>
              ))}
            </div>

            {/* LEAVE ARENA BUTTON ESCAPE HATCH */}
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleLeaveArena}
                className="w-full py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-2xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition active:scale-[0.98]"
              >
                Exit Arena Room
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Admin Console
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            {/* DYNAMIC PROOF TYPE CONTROL */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Arena Rules
              </h4>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">
                    Validation Type
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    Allowed submission format
                  </span>
                </div>
                <select
                  value={arenaProofType}
                  onChange={(e) => handleUpdateProofType(e.target.value)}
                  className="text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#0095F6] cursor-pointer"
                >
                  <option value="text">Text Only</option>
                  <option value="link">Link (URL)</option>
                  <option value="image">Image Upload</option>
                </select>
              </div>
            </div>

            {inviteAssets && (
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 space-y-2 mt-2">
                <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                  Invite Code
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-extrabold text-slate-900 dark:text-white">
                    {inviteAssets.invite_code}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteAssets.invite_code);
                      alert("Invite code copied to clipboard!");
                    }}
                    className="text-xs px-3 py-1 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition"
                  >
                    Copy Key
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Pending Requests ({pendingRequests.length})
              </h4>

              {pendingRequests.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-200 dark:border-slate-800">
                  No pending access requests.
                </p>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {req.user_name || `User #${req.user_id}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(req.user_id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full transition"
                      >
                        Admit
                      </button>
                      <button
                        onClick={() => handleReject(req.user_id)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {viewerImageUrl && (
        <div
          onClick={closeImageViewer}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
          >
            <img
              src={viewerImageUrl}
              alt="Full view proof"
              style={{ transform: `scale(${viewerZoom})` }}
              className="max-h-[80vh] max-w-full object-contain rounded-2xl transition-transform duration-200"
            />
            <div className="mt-4 flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800 text-white text-xs font-bold">
              <button
                onClick={() => setViewerZoom((z) => Math.max(z - 0.2, 0.5))}
                className="px-2 py-0.5 hover:bg-slate-800 rounded"
              >
                -
              </button>
              <span>{Math.round(viewerZoom * 100)}%</span>
              <button
                onClick={() => setViewerZoom((z) => Math.min(z + 0.2, 3))}
                className="px-2 py-0.5 hover:bg-slate-800 rounded"
              >
                +
              </button>
              <button
                onClick={closeImageViewer}
                className="ml-4 px-3 py-1 bg-rose-600 text-white rounded-full text-xs hover:bg-rose-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
