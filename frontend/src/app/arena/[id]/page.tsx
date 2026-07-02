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
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [selectedProofPreviewUrl, setSelectedProofPreviewUrl] = useState<
    string | null
  >(null);
  const [chatInput, setChatInput] = useState("");
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [viewerZoom, setViewerZoom] = useState(1);

  // Mobile Views Toggles
  const [arenaMembers, setArenaMembers] = useState<ArenaMember[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

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
    sizeClass = "h-9 w-9",
  ) => {
    if (imageUrl) {
      return (
        <div
          className={`${sizeClass} shrink-0 overflow-hidden rounded-full border border-gray-700 bg-gray-800`}
        >
          <img
            src={imageUrl}
            alt={`${name} profile`}
            className="h-full w-full object-cover"
          />
        </div>
      );
    }

    return (
      <div
        className={`${sizeClass} shrink-0 overflow-hidden rounded-full border border-gray-700 bg-linear-to-br from-gray-800 to-gray-900 flex items-center justify-center text-[11px] font-bold text-white`}
      >
        {getInitials(name || "Member")}
      </div>
    );
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("tribely_token");
    const storedUserId = localStorage.getItem("tribely_user_id");

    if (!storedToken || !storedUserId) {
      router.push("/login");
      return;
    }

    const parsedUserId = Number(storedUserId);
    setUserId(parsedUserId);

    fetchHistory();
    fetchArenaMembers();

    const checkAdminPrivileges = async () => {
      try {
        const res = await api.get("/api/arenas/");
        const currentArena = res.data?.data?.find(
          (a: any) => a.id === Number(id),
        );

        if (currentArena) {
          setArenaName(currentArena.name || `Chamber #${id}`);
          setArenaProofType(
            (currentArena.proof_type || "text") as ArenaProofType,
          );
          setArenaDeadlineTime(currentArena.deadline_time || "10:00 PM");

          if (currentArena.creator_id === parsedUserId) {
            setIsAdmin(true);
            const reqs = await api.get(
              `/api/admin/arenas/arenas/${id}/requests`,
            );
            setPendingRequests(reqs.data?.data || []);
            const assets = await api.get(
              `/api/admin/arenas/${id}/invite-assets`,
            );
            setInviteAssets(assets.data?.data || null);
          }
        } else {
          setArenaName(`Chamber #${id}`);
        }
      } catch (err) {
        console.error("Admin verification routine error:", err);
        setArenaName(`Chamber #${id}`);
      }
    };
    checkAdminPrivileges();

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
        if (liveData?.event_type === "ledger_update") {
          fetchHistory();
          return;
        }
        setMessages((prev) => [liveData, ...prev]);
      } catch (e) {
        console.error("Failed to parse message packet", e);
      }
    };

    ws.onerror = () => {
      setError("Connection stream dropped. Syncing...");
    };

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
    const targetDeadline = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0,
    );

    return targetDeadline;
  };

  const getActiveSubmissionWindow = () => {
    const now = new Date();
    const todayDeadline = parseDeadlineDate(arenaDeadlineTime);

    if (now <= todayDeadline) {
      const windowStart = new Date(todayDeadline);
      windowStart.setDate(windowStart.getDate() - 1);
      return {
        windowStart,
        windowEnd: todayDeadline,
      };
    }

    const windowEnd = new Date(todayDeadline);
    windowEnd.setDate(windowEnd.getDate() + 1);
    return {
      windowStart: todayDeadline,
      windowEnd,
    };
  };

  const getWindowEndLabel = () => {
    const { windowEnd } = getActiveSubmissionWindow();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const isToday = windowEnd.toDateString() === now.toDateString();
    const isTomorrow = windowEnd.toDateString() === tomorrow.toDateString();

    const dayLabel = isToday
      ? "Today"
      : isTomorrow
        ? "Tomorrow"
        : windowEnd.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

    const timeLabel = windowEnd.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${dayLabel}, ${timeLabel}`;
  };

  const getProofComposerLabel = () => {
    if (arenaProofType === "image") return "Image proof only";
    if (arenaProofType === "link") return "Link proof only";
    return "Text proof only";
  };

  const getProofPlaceholder = () => {
    if (arenaProofType === "image")
      return "Upload an image file or paste a direct image URL";
    if (arenaProofType === "link") return "Paste a valid http(s) link";
    return "Write your proof here, like a short completion note";
  };

  const isImageProof = (proofValue: string) =>
    proofValue.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(proofValue);

  const openImageViewer = (imageUrl: string) => {
    setViewerImageUrl(imageUrl);
    setViewerZoom(1);
  };

  const handleProofFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      alert("Please choose an image file.");
      event.target.value = "";
      return;
    }

    const previewReader = new FileReader();
    previewReader.onload = () => {
      if (typeof previewReader.result === "string") {
        setSelectedProofPreviewUrl(previewReader.result);
      }
    };
    previewReader.readAsDataURL(selectedFile);

    setSelectedProofFile(selectedFile);
    setProofFileName(selectedFile.name);
    setProofUrl("");
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        if (typeof fileReader.result === "string") {
          resolve(fileReader.result);
        } else {
          try {
            reject(new Error("Failed to read selected image."));
          } catch {}
        }
      };
      fileReader.onerror = () =>
        reject(new Error("Failed to read selected image."));
      fileReader.readAsDataURL(file);
    });

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/activity/arena/${id}/history`);
      setSubmissions(response.data?.data?.submissions || []);
      setMessages(response.data?.data?.messages || []);
    } catch (err: any) {
      setError("Access Denied: Sync mismatch.");
    }
  };

  const fetchArenaMembers = async () => {
    try {
      const response = await api.get(`/api/arenas/${id}/members`);
      setArenaMembers(response.data?.data || []);
    } catch (err) {
      console.error("Failed parsing members ledger list.");
    }
  };

  const hasUserSubmittedInActiveWindow = () => {
    const { windowStart, windowEnd } = getActiveSubmissionWindow();

    return submissions.some(
      (sub) =>
        sub.user_id === userId &&
        new Date(sub.submitted_at) >= windowStart &&
        new Date(sub.submitted_at) < windowEnd,
    );
  };

  const formatLedgerGroupDate = (dateString: string) => {
    try {
      const dateTarget = new Date(dateString);
      const today = new Date();

      const targetMidnight = new Date(
        dateTarget.getFullYear(),
        dateTarget.getMonth(),
        dateTarget.getDate(),
      );
      const todayMidnight = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      const differenceInMs = todayMidnight.getTime() - targetMidnight.getTime();
      const differenceInDays = Math.round(
        differenceInMs / (1000 * 60 * 60 * 24),
      );

      if (differenceInDays === 0) return "Today";
      if (differenceInDays === 1) return "Yesterday";

      return dateTarget.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const groupSubmissionsByDate = (submissionsToGroup: Submission[]) => {
    const mappedGroups: { [key: string]: Submission[] } = {};
    const sorted = [...submissionsToGroup].sort(
      (a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );

    sorted.forEach((sub) => {
      const headerLabel = formatLedgerGroupDate(sub.submitted_at);
      if (!mappedGroups[headerLabel]) {
        mappedGroups[headerLabel] = [];
      }
      mappedGroups[headerLabel].push(sub);
    });

    return mappedGroups;
  };

  const handleSendProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    let proofContent = proofUrl.trim();
    if (arenaProofType === "image" && selectedProofFile) {
      proofContent = await readFileAsDataUrl(selectedProofFile);
    }

    if (!proofContent) return;

    if (hasUserSubmittedInActiveWindow()) {
      alert(
        "Submission locked: You have already filed one proof in the current deadline window.",
      );
      return;
    }

    try {
      await api.post("/activity/submit", {
        arena_id: Number(id),
        proof_url: proofContent,
      });
      setProofUrl("");
      setProofFileName("");
      setSelectedProofFile(null);
      setSelectedProofPreviewUrl(null);
      if (proofFileInputRef.current) {
        proofFileInputRef.current.value = "";
      }
      fetchHistory();
      alert("Proof filed successfully inside tracking stream!");
    } catch (err: any) {
      alert(
        err.response?.data?.detail || "Proof processing failure encountered.",
      );
    }
  };

  const handleVoteProof = async (submissionId: number, type: "up" | "down") => {
    try {
      await api.post("/activity/vote", {
        submission_id: submissionId,
        vote_type: type,
      });
      fetchHistory();
    } catch (err: any) {
      alert(
        err.response?.data?.detail ||
          "Could not register feedback response loop.",
      );
    }
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || !userId) return;

    const payload = {
      user_id: userId,
      content: chatInput.trim(),
    };

    wsRef.current.send(JSON.stringify(payload));
    setChatInput("");
  };

  const handleProcessRequest = async (
    targetUserId: number,
    routeAction: "approve" | "reject",
  ) => {
    try {
      await api.post(`/api/admin/arenas/${routeAction}`, {
        user_id: targetUserId,
        arena_id: Number(id),
      });

      const reqs = await api.get(`/api/admin/arenas/arenas/${id}/requests`);
      setPendingRequests(reqs.data?.data || []);
      fetchArenaMembers();
    } catch (err) {
      alert("Could not update membership parameters.");
    }
  };

  const handleRemoveMember = async (targetUserId: number) => {
    if (!confirm("Remove this user from the arena?")) return;
    try {
      await api.post(`/api/admin/arenas/remove`, {
        user_id: targetUserId,
        arena_id: Number(id),
      });
      fetchArenaMembers();
    } catch (err: any) {
      alert(
        err.response?.data?.detail || "Could not execute participant removal.",
      );
    }
  };

  const groupedSubmissions = groupSubmissionsByDate(submissions);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-900 flex flex-col h-screen overflow-hidden relative font-sans select-none">
      {/* APP HEADER */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 flex flex-col space-y-2 shrink-0 z-40 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3 min-w-0">
            <Link
              href="/dashboard"
              className="text-slate-700 hover:text-slate-950 font-bold text-2xl leading-none pr-1"
            >
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-950 tracking-wide capitalize">
                {arenaName || `Chamber #${id}`}
              </h1>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Now
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowLedgerModal(true)}
              className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full active:bg-slate-200 transition font-medium"
            >
              📋 Ledger
            </button>
            <button
              onClick={() => setShowMembersModal(true)}
              className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full active:bg-slate-200 transition font-medium"
            >
              👥 Info ({arenaMembers.length})
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAdminModal(true)}
                className="text-[11px] bg-indigo-600 border border-indigo-500 text-white px-3 py-1.5 rounded-full active:bg-indigo-700 transition font-bold"
              >
                ⚙️ Admin ({pendingRequests.length})
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-700 p-1.5 text-[10px] text-center shrink-0">
          {error}
        </div>
      )}

      {/* CHAT FRAME */}
      <div className="flex-1 flex flex-col bg-[#F3F4F6] overflow-hidden relative">
        <div className="flex-1 px-4 py-4 overflow-y-auto flex flex-col-reverse gap-3.5 pb-24">
          <div ref={chatBottomRef} />
          {messages.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center my-auto">
              Chamber quiet. Send a message to start.
            </p>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.user_id === userId;
              return (
                <div
                  key={msg.id || idx}
                  className={`flex max-w-[90%] items-end gap-2 ${isMe ? "self-end flex-row-reverse" : "self-start"}`}
                >
                  {!isMe &&
                    renderAvatar(msg.sender_name, msg.sender_avatar_url)}
                  <div className="flex min-w-0 max-w-full flex-col">
                    {!isMe && (
                      <span className="mb-1 ml-1.5 text-[10px] font-semibold text-slate-500">
                        {msg.sender_name}
                      </span>
                    )}
                    <div
                      className={`w-fit max-w-[78vw] md:max-w-md rounded-[22px] px-4 py-3 text-[13px] leading-snug whitespace-pre-wrap wrap-break-word shadow-sm ${
                        isMe
                          ? "bg-[#EAEAEA] text-slate-900 rounded-br-md"
                          : "bg-white border border-slate-200 text-slate-900 rounded-bl-md"
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

        {/* CHAT INPUT BAR */}
        <form
          onSubmit={handleSendChatMessage}
          className="absolute bottom-0 inset-x-0 p-3 bg-[#F3F4F6]/95 backdrop-blur-md border-t border-slate-200 flex gap-2 items-center shrink-0 z-10"
        >
          <input
            type="text"
            required
            placeholder="Type dispatch message..."
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-full text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button
            type="submit"
            className="px-5 py-3 bg-[#5B4DFF] active:bg-[#4B3EEB] font-bold text-sm text-white rounded-full min-w-17.5 text-center transition shadow-sm"
          >
            Send
          </button>
        </form>
      </div>

      {/* MODAL 1: ROOM ACTIVITY LEDGER MODAL */}
      {showLedgerModal && (
        <div className="fixed inset-0 bg-slate-900/25 z-50 flex flex-col justify-end backdrop-blur-sm">
          <div className="bg-white border-t border-slate-200 rounded-t-[28px] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 shrink-0 bg-white rounded-t-[28px]">
              <div>
                <h3 className="text-sm font-extrabold text-slate-950 tracking-wide">
                  Ledger Room
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Live proof stream and verification activity
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold">
                  Live
                </span>
                <button
                  onClick={() => setShowLedgerModal(false)}
                  className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-200 transition"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-[#F8FAFC]">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                    Proof Mode
                  </span>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                    {getProofComposerLabel()}
                  </span>
                  <span className="text-[10px] px-2 py-1 rounded-full font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                    Window closes: {getWindowEndLabel()}
                  </span>
                </div>

                <form onSubmit={handleSendProof} className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3">
                    {arenaProofType === "text" ? (
                      <textarea
                        required
                        disabled={hasUserSubmittedInActiveWindow()}
                        rows={4}
                        placeholder={
                          hasUserSubmittedInActiveWindow()
                            ? "You have submitted your proof for this window."
                            : getProofPlaceholder()
                        }
                        className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={hasUserSubmittedInActiveWindow()}
                            onClick={() => proofFileInputRef.current?.click()}
                            className="px-3 py-2 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                          >
                            Upload Image
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
                            <span className="text-[11px] text-slate-500 truncate">
                              Selected: {proofFileName}
                            </span>
                          )}
                        </div>

                        {selectedProofPreviewUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              openImageViewer(selectedProofPreviewUrl)
                            }
                            className="group block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left"
                          >
                            <img
                              src={selectedProofPreviewUrl}
                              alt="Selected proof preview"
                              className="max-h-40 w-full object-cover transition group-hover:scale-[1.01]"
                              loading="lazy"
                            />
                            <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
                              Tap to open full screen preview
                            </div>
                          </button>
                        )}

                        <input
                          type="text"
                          required
                          disabled={hasUserSubmittedInActiveWindow()}
                          placeholder={
                            hasUserSubmittedInActiveWindow()
                              ? "You have submitted your proof for this window."
                              : getProofPlaceholder()
                        }
                        className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-40"
                        value={
                          proofUrl.startsWith("data:image/") ? "" : proofUrl
                        }
                        onChange={(e) => setProofUrl(e.target.value)}
                      />
                    </div>
                  )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500 leading-5">
                      One proof per day is enforced before the deadline.
                    </p>
                    <button
                      type="submit"
                      disabled={hasUserSubmittedInActiveWindow()}
                      className="px-4 py-2.5 bg-[#5B4DFF] disabled:bg-slate-200 disabled:text-slate-500 text-xs font-bold rounded-full text-white whitespace-nowrap transition"
                    >
                      {hasUserSubmittedInActiveWindow()
                        ? "Locked"
                        : "Submit Proof"}
                    </button>
                  </div>
                </form>
              </div>

              {/* VERIFICATION HISTORY RECORDS */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    Verification History
                  </h4>
                </div>
                {submissions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                    <p className="text-sm text-slate-600 font-semibold">
                      No proof posted yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.keys(groupedSubmissions).map((dateGroupLabel) => (
                      <div key={dateGroupLabel} className="space-y-3 relative">
                        {/* WhatsApp-style Sticky Date Header */}
                        <div className="flex justify-center my-4 sticky top-0 z-10">
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full shadow border border-slate-200 uppercase tracking-wide backdrop-blur-sm">
                            {dateGroupLabel}
                          </span>
                        </div>

                        {groupedSubmissions[dateGroupLabel].map((sub) => {
                          const isMine = sub.user_id === userId;
                          const isImage =
                            arenaProofType === "image" ||
                            isImageProof(sub.proof_url);
                          return (
                            <div
                              key={sub.id}
                              className={`rounded-2xl border p-4 bg-white shadow-sm ${sub.is_absent ? "border-red-200" : isMine ? "border-indigo-200" : "border-slate-200"}`}
                            >
                              <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0 flex items-start gap-3">
                                  {renderAvatar(
                                    sub.user_name,
                                    sub.user_avatar_url,
                                    "h-10 w-10",
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-[11px] font-bold text-indigo-700 truncate">
                                        {sub.user_name}
                                      </p>
                                      {sub.is_absent && (
                                        <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                                          ABSENT
                                        </span>
                                      )}
                                    </div>
                                    <a
                                      href={sub.proof_url}
                                      target={isImage ? undefined : "_blank"}
                                      rel={isImage ? undefined : "noreferrer"}
                                      onClick={(event) => {
                                        if (isImage) {
                                          event.preventDefault();
                                          openImageViewer(sub.proof_url);
                                        }
                                      }}
                                      className="mt-1 block break-all text-[12px] text-slate-700 hover:text-slate-900 transition"
                                    >
                                      {isImage ? (
                                        <img
                                          src={sub.proof_url}
                                          alt={`Proof from ${sub.user_name}`}
                                          className="max-h-56 w-full max-w-60 rounded-xl border border-slate-200 object-cover mt-2"
                                          loading="lazy"
                                        />
                                      ) : (
                                        sub.proof_url
                                      )}
                                    </a>
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                  {new Date(
                                    sub.submitted_at,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                  <span>👍 {sub.upvotes || 0}</span>
                                  <span>👎 {sub.downvotes || 0}</span>
                                </div>
                                {sub.user_id !== userId && !sub.is_absent ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        handleVoteProof(sub.id, "up")
                                      }
                                      className="px-2.5 py-1.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                                    >
                                      Verify
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleVoteProof(sub.id, "down")
                                      }
                                      className="px-2.5 py-1.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                                    >
                                      Report
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500">
                                    Ledger record
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHAMBER INFO / PARTICIPANTS MODAL */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                Chamber Inhabitants ({arenaMembers.length})
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {arenaMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex justify-between items-center p-2 rounded-2xl bg-[#F8FAFC] border border-slate-200"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {member.full_name}
                    </p>
                    <p className="text-[10px] text-slate-500">{member.email}</p>
                  </div>
                  {isAdmin && member.user_id !== userId && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-[10px] text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full hover:bg-red-100 transition"
                    >
                      Expel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADMIN CONSOLE PARAMETERS */}
      {showAdminModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                Admin Hub Console
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {inviteAssets && (
                <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-2xl space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Invite Code Credentials
                  </p>
                  <p className="text-xs font-mono text-indigo-700 bg-white p-2 rounded-2xl border border-slate-200 break-all select-text">
                    {inviteAssets.invite_code}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Share this string with trusted platform profiles to request
                    ingress access logs.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Pending Gate Access Enlistments ({pendingRequests.length})
                </p>
                {pendingRequests.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">
                    No active clearance request packets waiting.
                  </p>
                ) : (
                  pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F8FAFC] border border-slate-200"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {req.user_name || `User ID #${req.user_id}`}
                        </p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                          Status: {req.status}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() =>
                            handleProcessRequest(req.user_id, "approve")
                          }
                          className="px-2.5 py-1 rounded-full bg-emerald-600 active:bg-emerald-700 text-[10px] font-bold text-white transition"
                        >
                          Admit
                        </button>
                        <button
                          onClick={() =>
                            handleProcessRequest(req.user_id, "reject")
                          }
                          className="px-2.5 py-1 rounded-full bg-slate-100 active:bg-slate-200 text-[10px] text-slate-700 border border-slate-200 transition"
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
        </div>
      )}

      {/* FULL-SCREEN IMAGE LIGHTBOX VIEWER */}
      {viewerImageUrl && (
        <div className="fixed inset-0 bg-black/95 z-100 flex flex-col justify-between items-center p-4 backdrop-blur-md select-none">
          <div className="w-full flex justify-between items-center z-10 p-2 bg-linear-to-b from-black/80 to-transparent absolute top-0 inset-x-0">
            <div className="text-left pl-2">
              <p className="text-xs font-bold text-white tracking-wide">
                Evidence Core Engine
              </p>
              <p className="text-[10px] text-slate-400">
                Zoom level: {Math.round(viewerZoom * 100)}%
              </p>
            </div>
            <button
              onClick={() => setViewerImageUrl(null)}
              className="bg-slate-900/80 border border-slate-700/60 active:bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-xs font-extrabold shadow-xl transition"
            >
              Close Viewer ✕
            </button>
          </div>

          <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4 cursor-zoom-in">
            <img
              src={viewerImageUrl}
              alt="Expanded proof file viewport"
              style={{ transform: `scale(${viewerZoom})` }}
              onClick={() => setViewerZoom((z) => (z === 1 ? 1.6 : 1))}
              className="max-h-[82vh] max-w-[94vw] object-contain rounded-xl shadow-2xl transition-transform duration-200 ease-out will-change-transform border border-slate-900"
            />
          </div>

          <div className="w-full flex justify-center gap-3 items-center z-10 p-4 absolute bottom-0 inset-x-0 bg-linear-to-t from-black/80 to-transparent">
            <button
              onClick={() => setViewerZoom((z) => Math.max(0.6, z - 0.2))}
              className="h-9 w-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-sm font-bold text-slate-300 active:bg-slate-800"
            >
              －
            </button>
            <button
              onClick={() => setViewerZoom(1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-semibold text-slate-400 active:bg-slate-800"
            >
              Reset
            </button>
            <button
              onClick={() => setViewerZoom((z) => Math.min(3, z + 0.2))}
              className="h-9 w-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-sm font-bold text-slate-300 active:bg-slate-800"
            >
              ＋
            </button>
          </div>
        </div>
      )}
    </div>
  );
}