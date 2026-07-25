"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../utils/api";
import { API_BASE_URL, getWsBaseUrl } from "../../utils/config";
import { useToast } from "../../context/ToastContext";

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
  user_name?: string;
  email: string;
  role?: string;
  user_avatar_url?: string | null;
  common_arenas_count: number;
}

type ArenaProofType = "text" | "image" | "link";

const proofIcon = (t: string) =>
  t === "image" ? "📸" : t === "link" ? "🔗" : "✍️";

const isImageUrl = (url: string) =>
  typeof url === "string" &&
  (url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(url));

const isHttpUrl = (url: string) =>
  typeof url === "string" &&
  (url.startsWith("http://") || url.startsWith("https://"));

interface CustomSelectOption {
  value: string;
  label: string;
  icon?: string;
}

const PROOF_TYPE_OPTIONS: CustomSelectOption[] = [
  { value: "text", label: "Text Only", icon: "✍️" },
  { value: "link", label: "Link (URL)", icon: "🔗" },
  { value: "image", label: "Image Upload", icon: "📸" },
];

const DEADLINE_TIME_OPTIONS: CustomSelectOption[] = [
  { value: "05:00 AM", label: "05:00 AM (Early Bird)", icon: "🌅" },
  { value: "06:00 AM", label: "06:00 AM", icon: "⏰" },
  { value: "09:00 AM", label: "09:00 AM", icon: "⏰" },
  { value: "12:00 PM", label: "12:00 PM (Noon Cutoff)", icon: "☀️" },
  { value: "06:00 PM", label: "06:00 PM", icon: "🌆" },
  { value: "08:00 PM", label: "08:00 PM", icon: "⏰" },
  { value: "10:00 PM", label: "10:00 PM (Night Cutoff)", icon: "🌙" },
  { value: "11:00 PM", label: "11:00 PM", icon: "⏰" },
  { value: "11:59 PM", label: "11:59 PM (Midnight End)", icon: "🕛" },
];

function CustomSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: CustomSelectOption[];
  onChange: (val: string) => void;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--fg-muted)" }}>
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.99]"
        style={{
          background: "var(--bg-card)",
          border: isOpen ? "1px solid var(--accent)" : "1px solid var(--border)",
          color: "var(--fg)",
          boxShadow: isOpen ? "0 0 0 3px var(--accent-glow2)" : "none",
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOpt?.icon && <span>{selectedOpt.icon}</span>}
          <span>{selectedOpt?.label || value}</span>
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-[var(--accent)]" : "text-[var(--fg-muted)]"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl p-1.5 shadow-2xl animate-scale-in space-y-0.5 max-h-56 overflow-y-auto styled-scroll"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid var(--border)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.50)",
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-extrabold transition-colors duration-150"
                style={{
                  background: isSelected ? "var(--accent-light)" : "transparent",
                  color: isSelected ? "var(--accent)" : "var(--fg)",
                }}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon && <span>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </span>
                {isSelected && <span className="text-xs font-black">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeadlineTimerSetter({
  currentDeadline,
  onSave,
}: {
  currentDeadline: string;
  onSave: (newDeadline: string) => Promise<void> | void;
}) {
  const parseInitial = () => {
    if (!currentDeadline) return { hour: "10", minute: "00", period: "PM" };
    const parts = currentDeadline.trim().split(" ");
    const periodPart = (parts[1] || "PM").toUpperCase();
    const timePart = parts[0] || "10:00";
    const [h, m] = timePart.split(":");
    let hNum = Number(h) || 10;
    if (hNum > 12) hNum = hNum % 12 || 12;
    const hStr = String(hNum).padStart(2, "0");
    const mStr = String(Number(m) || 0).padStart(2, "0");
    return { hour: hStr, minute: mStr, period: periodPart === "AM" ? "AM" : "PM" };
  };

  const [hour, setHour] = useState(() => parseInitial().hour);
  const [minute, setMinute] = useState(() => parseInitial().minute);
  const [period, setPeriod] = useState(() => parseInitial().period);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const parsed = parseInitial();
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setPeriod(parsed.period);
  }, [currentDeadline]);

  const handleApply = async () => {
    const formatted = `${hour}:${minute} ${period}`;
    setIsSaving(true);
    await onSave(formatted);
    setIsSaving(false);
  };

  const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

  return (
    <div
      className="p-3.5 rounded-2xl space-y-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1">
          <span>⏱️ Daily Cutoff Timer Setter</span>
        </label>
        <span
          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          Active: {currentDeadline || `${hour}:${minute} ${period}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className="flex-1 text-xs font-extrabold px-2.5 py-2 rounded-xl focus-accent cursor-pointer text-center"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
          }}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h} Hour
            </option>
          ))}
        </select>

        <span className="text-sm font-black" style={{ color: "var(--fg-muted)" }}>
          :
        </span>

        <select
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          className="flex-1 text-xs font-extrabold px-2.5 py-2 rounded-xl focus-accent cursor-pointer text-center"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
          }}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m} Min
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setPeriod(period === "AM" ? "PM" : "AM")}
          className="px-3 py-2 rounded-xl text-xs font-black transition active:scale-95 shadow-sm"
          style={{
            background:
              period === "AM"
                ? "linear-gradient(135deg, #F59E0B, #D97706)"
                : "linear-gradient(135deg, #3B82F6, #1D4ED8)",
            color: "#fff",
          }}
        >
          {period === "AM" ? "🌅 AM" : "🌙 PM"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleApply}
        disabled={isSaving}
        className="w-full py-2.5 text-xs font-extrabold rounded-xl text-white transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
        style={{
          background: "linear-gradient(135deg, var(--accent), #0095F6)",
          boxShadow: "0 4px 14px var(--accent-glow2)",
        }}
      >
        <span>
          {isSaving ? "Updating Core Arena..." : `💾 Set & Update Deadline (${hour}:${minute} ${period})`}
        </span>
      </button>
    </div>
  );
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function Avatar({
  name,
  imageUrl,
  size = 8,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
}) {
  const cls = `w-${size} h-${size} rounded-full shrink-0 text-xs font-bold flex items-center justify-center text-white overflow-hidden`;
  if (imageUrl)
    return <img src={imageUrl} alt={name} className={`${cls} object-cover`} />;
  return (
    <div
      className={cls}
      style={{ background: "linear-gradient(135deg, var(--accent), #0095F6)" }}
    >
      {getInitials(name || "U")}
    </div>
  );
}

function isSameDay(iso1: string, iso2: string): boolean {
  if (!iso1 || !iso2) return false;
  const parse = (s: string) => {
    let norm = s;
    if (typeof s === "string" && !s.includes("T") && s.includes(" ")) norm = s.replace(" ", "T");
    if (typeof norm === "string" && !norm.endsWith("Z") && !norm.includes("+")) norm += "Z";
    return new Date(norm);
  };
  const d1 = parse(iso1);
  const d2 = parse(iso2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

function formatDateLabel(iso: string): string {
  if (!iso) return "";
  let normalizedIso = iso;
  if (typeof iso === "string" && !iso.includes("T") && iso.includes(" ")) {
    normalizedIso = iso.replace(" ", "T");
  }
  if (typeof normalizedIso === "string" && !normalizedIso.endsWith("Z") && !normalizedIso.includes("+")) {
    normalizedIso += "Z";
  }
  const d = new Date(normalizedIso);
  const targetDate = isNaN(d.getTime()) ? new Date(iso) : d;
  if (isNaN(targetDate.getTime())) return iso;

  const now = new Date();
  const isToday =
    targetDate.getDate() === now.getDate() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    targetDate.getDate() === yesterday.getDate() &&
    targetDate.getMonth() === yesterday.getMonth() &&
    targetDate.getFullYear() === yesterday.getFullYear();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  return targetDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function TimeOnlyStr({ iso }: { iso: string }) {
  if (!iso) return null;
  let normalizedIso = iso;
  if (typeof iso === "string" && !iso.includes("T") && iso.includes(" ")) {
    normalizedIso = iso.replace(" ", "T");
  }
  if (typeof normalizedIso === "string" && !normalizedIso.endsWith("Z") && !normalizedIso.includes("+")) {
    normalizedIso += "Z";
  }
  const d = new Date(normalizedIso);
  const targetDate = isNaN(d.getTime()) ? new Date(iso) : d;
  if (isNaN(targetDate.getTime())) return <span>{iso}</span>;

  return (
    <span>
      {targetDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}
    </span>
  );
}

function TimeStr({ iso }: { iso: string }) {
  if (!iso) return null;
  let normalizedIso = iso;
  if (typeof iso === "string" && !iso.includes("T") && iso.includes(" ")) {
    normalizedIso = iso.replace(" ", "T");
  }
  if (typeof normalizedIso === "string" && !normalizedIso.endsWith("Z") && !normalizedIso.includes("+")) {
    normalizedIso += "Z";
  }
  const d = new Date(normalizedIso);
  const targetDate = isNaN(d.getTime()) ? new Date(iso) : d;
  if (isNaN(targetDate.getTime())) return <span>{iso}</span>;

  const dateStr = targetDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeStr = targetDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <span>
      {dateStr}, {timeStr}
    </span>
  );
}



export default function ArenaRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
    inputRequired?: string;
    onConfirm: () => void;
  } | null>(null);
  const [confirmInputVal, setConfirmInputVal] = useState("");

  const [userId, setUserId] = useState<number | null>(null);
  const [arenaName, setArenaName] = useState("");
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

  const [arenaMembers, setArenaMembers] = useState<ArenaMember[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showMobileLedger, setShowMobileLedger] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [arenaIconUrl, setArenaIconUrl] = useState<string | null>(null);
  const [arenaDescription, setArenaDescription] = useState("");
  const [arenaPenaltyAmount, setArenaPenaltyAmount] = useState<number>(0);
  const [arenaInviteCode, setArenaInviteCode] = useState("");

  const COMMON_EMOJIS = [
    "😀", "😂", "❤️", "🔥", "👍", "🎉", 
    "🚀", "💯", "👏", "🙌", "💪", "✨", 
    "😎", "💡", "📌", "🏆", "⭐", "🙏", 
    "🥳", "🎯", "😍", "🤩", "⚡", "📷"
  ];

  const wsRef = useRef<WebSocket | null>(null);

  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement | null>(null);
  const dpFileInputRef = useRef<HTMLInputElement | null>(null);


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
      if (err?.response?.status === 403)
        setError("Membership approval required to access this arena.");
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await api.get(`/api/admin/arenas/${id}/requests`);
      const data = res.data?.data;
      if (Array.isArray(data)) setPendingRequests(data);
    } catch (err) {
      console.error("Failed to fetch pending requests", err);
    }
  };

  const fetchInviteAssets = async () => {
    try {
      const res = await api.get(`/api/admin/arenas/${id}/invite-assets`);
      if (res.data?.data) setInviteAssets(res.data.data);
    } catch {
      /* non-critical */
    }
  };

  const fetchMembersList = async () => {
    try {
      const res = await api.get(`/api/arenas/${id}/members`);
      if (Array.isArray(res.data?.data)) setArenaMembers(res.data.data);
    } catch {
      /* non-critical */
    }
  };

  useEffect(() => {
    const localUserId = localStorage.getItem("tribely_user_id");
    if (localUserId) setUserId(Number(localUserId));

    fetchHistory();
    fetchMembersList();

    const checkAdmin = async () => {
      try {
        const res = await api.get("/api/arenas/");
        const userArenas = res.data?.data || [];
        const cur = userArenas.find((a: any) => a.id === Number(id));
        if (cur) {
          setArenaName(cur.name);
          setArenaProofType((cur.proof_type as ArenaProofType) || "text");
          setArenaDeadlineTime(cur.deadline_time || "10:00 PM");
          setArenaIconUrl(cur.icon_url || null);
          setArenaDescription(cur.description || "");
          setArenaPenaltyAmount(cur.penalty_amount || 0);
          setArenaInviteCode(cur.invite_code || "");
          if (cur.user_role === "admin") {
            setIsAdmin(true);
            fetchPendingRequests();
            fetchInviteAssets();
          }
        }
      } catch {
        setArenaName(`Chamber #${id}`);
      }
    };
    checkAdmin();

    let isMounted = true;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      if (!isMounted) return;
      const wsBase = getWsBaseUrl();
      const wsUrl = `${wsBase}/ws/arena/${id}`;
      const wsToken = localStorage.getItem("tribely_token");
      const ws = new WebSocket(
        wsToken ? `${wsUrl}?token=${encodeURIComponent(wsToken)}` : wsUrl,
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const liveData = JSON.parse(event.data);
          const eventType = liveData?.event_type || liveData?.type;

          // Real-time Member Removed / Kick Event Handler
          if (eventType === "member_removed" || eventType === "kicked") {
            const kickedUserId = Number(liveData.user_id);
            const currentStoredUserId = Number(localStorage.getItem("tribely_user_id"));

            if (kickedUserId && kickedUserId === currentStoredUserId) {
              toast.warning("You have been removed from this arena by an admin.");
              router.push("/dashboard");
              return;
            } else {
              fetchMembersList();
              return;
            }
          }

          // Real-time Join Request Event Handler
          if (eventType === "join_request" || eventType === "join_request_update") {
            fetchPendingRequests();
            fetchMembersList();
            if (eventType === "join_request" && isAdmin) {
              toast.info(`New join request: ${liveData.user_name || "A member"} requested access.`);
            }
            return;
          }

          // Real-time Arena Settings Update Handler (Deadline Time / Verification Rule)
          if (eventType === "arena_settings_updated") {
            if (liveData.deadline_time) {
              setArenaDeadlineTime(liveData.deadline_time);
            }
            if (liveData.proof_type) {
              setArenaProofType(liveData.proof_type);
            }
            if (liveData.name) {
              setArenaName(liveData.name);
            }
            return;
          }

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

          // Real-time chat message handler
          const newMessage = liveData?.message || liveData?.data || liveData;
          if (newMessage && (newMessage.content || newMessage.id)) {
            setMessages((prev) => {
              if (newMessage.id && prev.some((m) => m.id === newMessage.id)) {
                return prev;
              }
              return [newMessage, ...prev];
            });
          }
        } catch {
          /* ignore malformed payloads */
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = () => {};
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
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

  const hasUserSubmittedInActiveWindow = () => {
    if (!userId) return false;
    const cutoff = parseDeadlineDate(arenaDeadlineTime);
    const windowStart = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);
    return submissions.some(
      (sub) =>
        sub.user_id === userId && new Date(sub.submitted_at) >= windowStart,
    );
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
    if (
      arenaProofType === "link" &&
      !proofUrl.startsWith("http://") &&
      !proofUrl.startsWith("https://")
    ) {
      setError("This arena requires a valid http:// or https:// URL link.");
      return;
    }
    try {
      await api.post("/api/activity/submit", {
        arena_id: Number(id),
        proof_url: proofUrl,
        client_submitted_at: new Date().toISOString(),
      });
      setProofUrl("");
      setProofFileName("");
      setSelectedProofPreviewUrl(null);
      fetchHistory();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : detail?.message || "Proof submission failed.",
      );
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
      alert(
        typeof detail === "string" ? detail : detail?.message || "Vote failed.",
      );
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = chatInput.trim();
    if (!messageText) return;

    setChatInput("");

    // 1. Send over active WebSocket connection if available & connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({ content: messageText, message_type: "text" }),
        );
        return;
      } catch (err) {
        console.warn("WebSocket send failed, executing HTTP fallback", err);
      }
    }

    // 2. Fallback to HTTP POST if WebSocket is disconnected or send failed
    try {
      const res = await api.post(`/api/activity/arena/${id}/message`, {
        content: messageText,
        message_type: "text",
      });
      const returnedMsg = res.data?.data;
      if (returnedMsg) {
        setMessages((prev) => {
          if (returnedMsg.id && prev.some((m) => m.id === returnedMsg.id)) {
            return prev;
          }
          return [returnedMsg, ...prev];
        });
      }
    } catch (err: any) {
      console.error("HTTP chat message fallback failed", err);
      setError("Failed to deliver message. Please try sending again.");
    }
  };

  const handleUpdateProofType = async (newType: string) => {
    try {
      await api.patch(`/api/admin/arenas/${id}/proof-type`, {
        proof_type: newType,
      });
      setArenaProofType(newType as ArenaProofType);
      setProofUrl("");
      setSelectedProofPreviewUrl(null);
      setProofFileName("");
      toast.success(`Verification rule updated: ${newType}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update proof type.");
    }
  };

  const handleUpdateDeadlineTime = async (newDeadline: string) => {
    try {
      await api.patch(`/api/admin/arenas/${id}/settings`, {
        deadline_time: newDeadline,
      });
      setArenaDeadlineTime(newDeadline);
      toast.success(`Daily deadline updated: ${newDeadline}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update deadline time.");
    }
  };

  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [editedAbout, setEditedAbout] = useState("");

  const handleSaveAbout = async () => {
    try {
      await api.patch(`/api/admin/arenas/${id}/settings`, {
        description: editedAbout,
      });
      setArenaDescription(editedAbout);
      setIsEditingAbout(false);
      toast.success("About description updated successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update About description.");
    }
  };

  const handleLeaveArena = async () => {
    setConfirmModal({
      title: "Leave Arena Group",
      message: "Are you sure you want to leave this arena? You will lose access to the daily proof stream and group chat.",
      confirmText: "Leave Arena",
      danger: true,
      onConfirm: async () => {
        try {
          await api.post(`/api/arenas/${id}/leave`);
          toast.info("You left the arena group.");
          router.push("/dashboard");
        } catch (err: any) {
          toast.error(err.response?.data?.detail || "Failed to leave the arena.");
        }
      },
    });
  };

  const handleArenaDpChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;
      try {
        await api.patch(`/api/admin/arenas/${id}/settings`, {
          icon_url: base64Url,
        });
        setArenaIconUrl(base64Url);
        toast.success("Arena Group DP updated successfully!");
      } catch (err: any) {
        toast.error(err.response?.data?.detail || "Failed to update DP.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteArena = async () => {
    setConfirmModal({
      title: "Delete Arena Group",
      message: `Are you sure you want to permanently delete "${arenaName}"? This action cannot be undone.`,
      confirmText: "Delete Arena",
      inputRequired: "DELETE",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/arenas/${id}`);
          toast.success("Arena deleted successfully.");
          router.push("/dashboard");
        } catch (err: any) {
          toast.error(err.response?.data?.detail || "Failed to delete arena.");
        }
      },
    });
  };


  const handleApprove = async (reqUserId: number) => {
    try {
      await api.post("/api/admin/arenas/approve", {
        arena_id: Number(id),
        user_id: reqUserId,
      });
      fetchPendingRequests();
      fetchMembersList();
    } catch {
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
    } catch {
      setError("Failed to reject membership.");
    }
  };

  const handleKickMember = (member: ArenaMember) => {
    const memberName =
      member.user_name || member.full_name || `Member #${member.user_id}`;

    setShowGroupInfoModal(false);

    setConfirmModal({
      title: "Remove Member",
      message: `Are you sure you want to remove ${memberName} from "${arenaName}"? They will lose access to group chat and daily proof submissions.`,
      confirmText: "Remove Member",
      danger: true,
      onConfirm: async () => {
        try {
          await api.post("/api/admin/arenas/remove", {
            arena_id: Number(id),
            user_id: member.user_id,
          });
          toast.success(`${memberName} has been removed from the arena.`);
          fetchMembersList();
        } catch (err: any) {
          toast.error(err.response?.data?.detail || "Failed to remove member.");
        }
      },
    });
  };

  const sortedMembers = [...arenaMembers].sort((a, b) => {
    if (a.user_id === userId) return -1;
    if (b.user_id === userId) return 1;
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (b.role === "admin" && a.role !== "admin") return 1;
    return 0;
  });

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ background: "var(--bg)", color: "var(--fg)" }}
    >
      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-30 shrink-0 px-4 py-3 flex items-center justify-between glass"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="p-2 rounded-full transition hover:scale-110"
            style={{ background: "var(--bg-raised)", color: "var(--fg-muted)" }}
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div
            onClick={() => setShowGroupInfoModal(true)}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 transition group"
            title="Open Arena Group Profile & Info"
          >
            <div className="relative p-0.5 rounded-full ring-2 ring-emerald-500/70 dark:ring-emerald-400/80 shadow-sm shrink-0">
              <Avatar
                name={arenaName || `Arena #${id}`}
                imageUrl={arenaIconUrl || undefined}
                size={9}
              />
            </div>
            <div className="min-w-0">
              <h1
                className="truncate text-sm font-extrabold capitalize group-hover:underline"
                style={{ color: "var(--fg)" }}
              >
                {arenaName || `Chamber #${id}`}
              </h1>
              <p
                className="flex items-center gap-1.5 text-[10px]"
                style={{ color: "var(--fg-muted)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--success)" }}
                />
                {arenaMembers.length} {arenaMembers.length === 1 ? "member" : "members"} · Tap for Info
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowMobileLedger(!showMobileLedger)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition hover:opacity-80"
            style={{
              background: "var(--accent-light)",
              color: "var(--accent)",
              border: "1px solid rgba(0,122,204,0.20)",
            }}
          >
            📋 Ledger
          </button>
          <button
            onClick={() => setShowGroupInfoModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition hover:opacity-80 active:scale-95"
            style={{
              background: "var(--bg-raised)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            👥 Group Info
            {isAdmin && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-white">
                Admin
              </span>
            )}
          </button>
        </div>
      </header>

      {/* error banner */}
      {error && (
        <div
          className="shrink-0 px-4 py-2 text-xs text-center flex items-center justify-center gap-2 animate-fade-in"
          style={{
            background: "rgba(239,68,68,0.08)",
            borderBottom: "1px solid rgba(239,68,68,0.15)",
            color: "var(--danger)",
          }}
        >
          {error}
          <button
            onClick={() => setError("")}
            className="font-bold hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* ── CHAT STREAM ── */}
        <div
          className="flex-1 min-w-0 flex flex-col relative"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          {/* messages list */}
          <div
            className="flex-1 px-3 sm:px-5 py-4 overflow-y-auto styled-scroll flex flex-col-reverse pb-24"
            style={{ gap: "2px" }}
          >
            <div ref={chatBottomRef} />
            {messages.length === 0 ? (
              <div className="my-auto text-center py-16 px-4 animate-fade-in">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-4"
                  style={{ background: "var(--accent-light)" }}
                >
                  💬
                </div>
                <h3
                  className="text-sm font-bold mb-1"
                  style={{ color: "var(--fg)" }}
                >
                  No messages yet
                </h3>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  Be the first to say something.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.user_id === userId;
                const prevMsg = messages[idx + 1];
                const isGroupStart =
                  !prevMsg || prevMsg.user_id !== msg.user_id;
                const isFirstMsgOfDate =
                  !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);

                return (
                  <React.Fragment key={msg.id || idx}>
                    <div
                      className={`flex items-end ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                      style={{ marginTop: isGroupStart ? "10px" : "2px" }}
                    >
                      {!isMe && (
                        <div
                          className="shrink-0 mr-2"
                          style={{ width: 28, opacity: isGroupStart ? 1 : 0 }}
                        >
                          {isGroupStart && (
                            <Avatar
                              name={msg.sender_name}
                              imageUrl={msg.sender_avatar_url}
                              size={7}
                            />
                          )}
                        </div>
                      )}

                      <div
                        className={`flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        } max-w-[75%] sm:max-w-[62%]`}
                      >
                        {!isMe && isGroupStart && (
                          <span
                            className="mb-1 ml-1 text-[10px] font-semibold"
                            style={{ color: "var(--fg-muted)" }}
                          >
                            {msg.sender_name}
                          </span>
                        )}

                        <div
                          className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                          style={
                            isMe
                              ? {
                                  background:
                                    "linear-gradient(135deg, #C13584 0%, #833AB4 40%, #5851DB 75%, #405DE6 100%)",
                                  color: "#fff",
                                  borderRadius: "22px 22px 6px 22px",
                                  boxShadow: "0 1px 4px rgba(131,58,180,0.25)",
                                }
                              : {
                                  background: "var(--ig-recv-bg, #262626)",
                                  color: "var(--fg)",
                                  borderRadius: "22px 22px 22px 6px",
                                }
                          }
                        >
                          {msg.content}
                        </div>

                        {(!messages[idx - 1] ||
                          messages[idx - 1].user_id !== msg.user_id) && (
                          <span
                            className={`mt-1 text-[9px] font-medium ${
                              isMe ? "mr-1" : "ml-1"
                            }`}
                            style={{ color: "var(--fg-subtle)" }}
                          >
                            <TimeOnlyStr iso={msg.created_at} />
                          </span>
                        )}
                      </div>

                      {!isMe && <div className="ml-2" style={{ minWidth: 8 }} />}
                    </div>

                    {isFirstMsgOfDate && (
                      <div className="flex justify-center my-3 shrink-0">
                        <span
                          className="px-3.5 py-1 rounded-full text-[10px] font-bold tracking-wide shadow-sm"
                          style={{
                            background: "var(--bg-raised)",
                            color: "var(--fg-muted)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {formatDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })

            )}
          </div>

          {/* ── FLOATING EMOJI PICKER POPOVER ── */}
          {showEmojiPicker && (
            <div
              className="absolute bottom-16 right-3 sm:right-4 z-30 p-3 rounded-2xl shadow-2xl border animate-fade-in grid grid-cols-6 gap-2"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border)",
                backdropFilter: "blur(20px)",
                maxWidth: "280px",
              }}
            >
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setChatInput((prev) => prev + emoji);
                  }}
                  className="w-9 h-9 text-xl flex items-center justify-center rounded-xl transition hover:scale-125 hover:bg-[var(--bg-raised)] active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* ── CHAT INPUT FORM ── */}
          <form
            onSubmit={(e) => {
              setShowEmojiPicker(false);
              handleSendChatMessage(e);
            }}
            className="absolute bottom-0 inset-x-0 z-20 flex items-center gap-2.5 px-3 sm:px-4 py-3"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "blur(20px)",
              borderTop: "1px solid var(--border)",
            }}
          >
            {/* Outer Left Camera Button */}
            <button
              type="button"
              onClick={() => {
                setShowMobileLedger(true);
                if (proofFileInputRef.current) {
                  proofFileInputRef.current.click();
                }
              }}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition hover:opacity-80 active:scale-95"
              style={{
                background: "var(--bg-raised)",
                color: "var(--fg-muted)",
              }}
              title="Capture Photo or Video Proof"
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

            {/* Clean Input Pill Bar */}
            <div
              className="flex-1 flex items-center rounded-full px-4 py-2.5"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
              }}
            >
              <input
                type="text"
                placeholder="Message…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--fg)" }}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => setShowEmojiPicker(false)}
              />
            </div>

            {/* Outer Right Action: Send Button or Outer Emoji Icon */}
            {chatInput.trim() ? (
              <button
                type="submit"
                className="shrink-0 text-sm font-bold transition hover:opacity-70 active:scale-95 px-1"
                style={{
                  background: "linear-gradient(135deg, #C13584, #5851DB)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Send
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full hover:opacity-70 active:scale-95 transition"
                style={{ color: "var(--fg-muted)" }}
                title="Emojis"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            )}
          </form>


        </div>

        {/* ── MOBILE OVERLAY ── */}
        {showMobileLedger && (
          <div
            onClick={() => setShowMobileLedger(false)}
            className="lg:hidden fixed inset-0 z-40"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
            }}
          />
        )}

        {/* ── LEDGER PANEL ── */}
        <div
          className={`fixed lg:relative inset-y-0 right-0 z-40 w-full sm:w-[420px] lg:w-[380px] xl:w-[440px] shrink-0 flex flex-col transition-transform duration-300 ease-out shadow-2xl lg:shadow-none ${
            showMobileLedger
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0"
          }`}
          style={{ background: "var(--bg-card)" }}
        >
          <div
            className="shrink-0 px-4 py-3.5 flex justify-between items-center glass"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <h3
                className="text-sm font-extrabold flex items-center gap-2"
                style={{ color: "var(--fg)" }}
              >
                📋 Live Proof Stream
              </h3>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: "var(--fg-muted)" }}
              >
                Real-time activity & peer votes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: "rgba(16,185,129,0.10)",
                  color: "var(--success)",
                  border: "1px solid rgba(16,185,129,0.20)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-ping"
                  style={{ background: "var(--success)" }}
                />
                Live
              </span>
              <button
                onClick={() => setShowMobileLedger(false)}
                className="lg:hidden px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
                style={{
                  background: "var(--bg-raised)",
                  color: "var(--fg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto styled-scroll p-4 space-y-4">
            {/* PROOF SUBMISSION COMPOSER */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Submit Proof
                </span>
                <span
                  className="pill"
                  style={{
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                    border: "1px solid rgba(0,122,204,0.20)",
                  }}
                >
                  {arenaProofType === "image"
                    ? "Image Required"
                    : arenaProofType === "link"
                      ? "Link Required"
                      : "Text Required"}
                </span>
              </div>

              <form onSubmit={handleSendProof} className="space-y-3">
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {arenaProofType === "text" && (
                    <textarea
                      required
                      disabled={hasUserSubmittedInActiveWindow()}
                      rows={3}
                      placeholder={
                        hasUserSubmittedInActiveWindow()
                          ? "Proof already submitted ✓"
                          : "Describe your completed task…"
                      }
                      className="w-full resize-none bg-transparent text-sm focus:outline-none disabled:opacity-40"
                      style={{ color: "var(--fg)" }}
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                    />
                  )}
                  {arenaProofType === "link" && (
                    <input
                      type="url"
                      required
                      disabled={hasUserSubmittedInActiveWindow()}
                      placeholder={
                        hasUserSubmittedInActiveWindow()
                          ? "Proof already submitted ✓"
                          : "https://example.com/proof"
                      }
                      className="w-full bg-transparent text-sm focus:outline-none disabled:opacity-40"
                      style={{ color: "var(--fg)" }}
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                    />
                  )}
                  {arenaProofType === "image" && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={hasUserSubmittedInActiveWindow()}
                          onClick={() => proofFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            color: "var(--fg)",
                          }}
                        >
                          📷 Choose Image
                        </button>
                        <input
                          ref={proofFileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={handleProofFileSelect}
                          disabled={hasUserSubmittedInActiveWindow()}
                        />
                        {proofFileName && (
                          <span
                            className="text-[11px] truncate max-w-[160px]"
                            style={{ color: "var(--fg-muted)" }}
                          >
                            {proofFileName}
                          </span>
                        )}
                      </div>
                      {selectedProofPreviewUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewerImageUrl(selectedProofPreviewUrl);
                            setViewerZoom(1);
                          }}
                          className="block w-full overflow-hidden rounded-xl"
                        >
                          <img
                            src={selectedProofPreviewUrl}
                            alt="Preview"
                            className="max-h-32 w-full object-cover"
                          />
                        </button>
                      )}
                      <input
                        type="text"
                        disabled={hasUserSubmittedInActiveWindow()}
                        placeholder="Or paste image URL (https://…)"
                        className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-40 border-t pt-2"
                        style={{
                          color: "var(--fg)",
                          borderColor: "var(--border)",
                        }}
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
                  )}
                </div>

                <button
                  type="submit"
                  disabled={hasUserSubmittedInActiveWindow()}
                  className="w-full py-2.5 rounded-full text-sm font-bold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                  style={{
                    background: hasUserSubmittedInActiveWindow()
                      ? "var(--success)"
                      : "var(--accent)",
                  }}
                >
                  {hasUserSubmittedInActiveWindow()
                    ? "✓ Proof Submitted"
                    : "Submit Daily Proof"}
                </button>
              </form>
            </div>

            {/* SUBMISSIONS LEDGER */}
            <div className="space-y-3">
              <h4
                className="text-xs font-bold uppercase tracking-wider px-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Submissions ({submissions.length})
              </h4>

              {submissions.length === 0 ? (
                <div
                  className="p-6 text-center rounded-2xl text-xs italic"
                  style={{
                    background: "var(--bg-raised)",
                    border: "1px solid var(--border)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  No submissions recorded yet for this active cycle.
                </div>
              ) : (
                submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl space-y-3 animate-fade-in"
                    style={{
                      background: "var(--bg-raised)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={sub.user_name}
                          imageUrl={sub.user_avatar_url}
                          size={7}
                        />
                        <span
                          className="text-xs font-bold"
                          style={{ color: "var(--fg)" }}
                        >
                          {sub.user_name}
                        </span>
                      </div>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--fg-subtle)" }}
                      >
                        <TimeStr iso={sub.submitted_at} />
                      </span>
                    </div>

                    <div>
                      {isImageUrl(sub.proof_url) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setViewerImageUrl(sub.proof_url);
                            setViewerZoom(1);
                          }}
                          className="block w-full overflow-hidden rounded-xl"
                        >
                          <img
                            src={sub.proof_url}
                            alt="Proof"
                            className="max-h-40 w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : isHttpUrl(sub.proof_url) ? (
                        <a
                          href={sub.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-3 py-2 rounded-xl font-mono text-xs truncate hover:opacity-80 transition"
                          style={{
                            background: "var(--bg)",
                            color: "var(--accent)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          🔗 {sub.proof_url}
                        </a>
                      ) : (
                        <p
                          className="px-3 py-2 rounded-xl text-xs leading-relaxed"
                          style={{
                            background: "var(--bg)",
                            color: "var(--fg)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {sub.proof_url}
                        </p>
                      )}
                    </div>

                    <div
                      className="flex items-center justify-between pt-1 border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVoteSubmission(sub.id, "upvote")}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition hover:scale-105 active:scale-95"
                          style={{
                            background: "rgba(16,185,129,0.10)",
                            color: "var(--success)",
                            border: "1px solid rgba(16,185,129,0.20)",
                          }}
                        >
                          👍 {sub.upvotes || 0}
                        </button>
                        <button
                          onClick={() =>
                            handleVoteSubmission(sub.id, "downvote")
                          }
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition hover:scale-105 active:scale-95"
                          style={{
                            background: "rgba(239,68,68,0.08)",
                            color: "var(--danger)",
                            border: "1px solid rgba(239,68,68,0.18)",
                          }}
                        >
                          👎 {sub.downvotes || 0}
                        </button>
                      </div>
                      {sub.is_absent ? (
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: "var(--danger)" }}
                        >
                          ❌ Failed
                        </span>
                      ) : (
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: "var(--success)" }}
                        >
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

      {/* ── CUSTOM CONFIRMATION & PROMPT MODAL ── */}
      {confirmModal && (
        <div
          onClick={() => setConfirmModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.80)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
            }}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                {confirmModal.danger ? "⚠️" : "ℹ️"} {confirmModal.title}
              </h3>
              <button
                onClick={() => setConfirmModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition hover:bg-[var(--bg-raised)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {confirmModal.message}
            </p>

            {confirmModal.inputRequired && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
                  Type <span className="font-mono text-red-500">{confirmModal.inputRequired}</span> to confirm
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-xs font-mono outline-none focus:border-red-500"
                  value={confirmInputVal}
                  onChange={(e) => setConfirmInputVal(e.target.value)}
                  placeholder={confirmModal.inputRequired}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition hover:bg-[var(--bg-raised)] border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmModal.inputRequired ? confirmInputVal.trim() !== confirmModal.inputRequired : false}
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(null);
                  setConfirmInputVal("");
                  action();
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold transition disabled:opacity-40 text-white shadow-lg"
                style={{
                  background: confirmModal.danger
                    ? "linear-gradient(135deg, #EF4444, #DC2626)"
                    : "var(--accent)",
                }}
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP-STYLE GROUP INFO MODAL ── */}
      {showGroupInfoModal && (
        <div
          onClick={() => setShowGroupInfoModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scale-in"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
            }}
          >
            {/* Header bar */}
            <div
              className="px-5 py-4 flex items-center justify-between glass shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <span>👥 Group Info</span>
              </h3>
              <button
                onClick={() => setShowGroupInfoModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition hover:bg-[var(--bg-raised)]"
                style={{ color: "var(--fg-muted)" }}
              >
                ✕
              </button>
            </div>

            {/* Modal scrollable body */}
            <div className="overflow-y-auto styled-scroll p-6 space-y-6">
              {/* Large Arena DP & Name Section */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative group flex justify-center">
                  <div className="relative p-1 rounded-full ring-4 ring-emerald-500/80 dark:ring-emerald-400/90 shadow-md flex justify-center">
                    <Avatar
                      name={arenaName || `Arena #${id}`}
                      imageUrl={arenaIconUrl || undefined}
                      size={20}
                    />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => dpFileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 rounded-full shadow-lg transition hover:scale-110 active:scale-95 text-xs font-bold flex items-center gap-1 z-10"
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        border: "2px solid var(--bg-card)",
                      }}
                      title="Change Arena DP"
                    >
                      📷 <span className="text-[10px] hidden sm:inline">Edit DP</span>
                    </button>
                  )}
                  <input
                    ref={dpFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleArenaDpChange}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-extrabold capitalize">{arenaName}</h2>
                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                    {arenaMembers.length} {arenaMembers.length === 1 ? "member" : "members"} · Created for daily habit accountability
                  </p>
                </div>

                {/* WhatsApp-Style Group About / Description Card */}
                <div
                  className="w-full rounded-2xl p-4 space-y-2 text-left shadow-sm"
                  style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <h4
                      className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      ℹ️ About Arena
                    </h4>
                    {isAdmin && !isEditingAbout && (
                      <button
                        onClick={() => {
                          setEditedAbout(arenaDescription);
                          setIsEditingAbout(true);
                        }}
                        className="px-2.5 py-1 rounded-full text-[10px] font-extrabold transition hover:bg-[var(--bg-card)] flex items-center gap-1"
                        style={{ color: "var(--accent)", border: "1px solid var(--border)" }}
                      >
                        ✏️ Edit About
                      </button>
                    )}
                  </div>

                  {isEditingAbout ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={editedAbout}
                        onChange={(e) => setEditedAbout(e.target.value)}
                        placeholder="Add an about description for this arena..."
                        rows={2}
                        className="w-full text-xs font-semibold p-2.5 rounded-xl focus-accent"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          color: "var(--fg)",
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsEditingAbout(false)}
                          className="px-3 py-1 rounded-xl text-xs font-bold transition hover:bg-[var(--bg-card)]"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveAbout}
                          className="px-3 py-1 rounded-xl text-xs font-extrabold text-white transition shadow-sm"
                          style={{ background: "var(--accent)" }}
                        >
                          Save About
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold leading-relaxed" style={{ color: "var(--fg)" }}>
                      {arenaDescription || "No description set for this arena room."}
                    </p>
                  )}
                </div>

                {/* Quick Actions Row */}
                <div className="flex items-center justify-center gap-3 w-full pt-2">
                  <button
                    onClick={() => {
                      setShowGroupInfoModal(false);
                      setShowMobileLedger(true);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition hover:opacity-80 active:scale-95"
                    style={{
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                      border: "1px solid rgba(0,122,204,0.20)",
                    }}
                  >
                    📋 Live Ledger
                  </button>

                  {arenaInviteCode && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(arenaInviteCode);
                        toast.success(`Invite code copied: ${arenaInviteCode}`);
                      }}
                      className="flex-1 py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition hover:opacity-80 active:scale-95"
                      style={{
                        background: "var(--bg-raised)",
                        color: "var(--fg)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      🔗 Copy Code
                    </button>
                  )}
                </div>
              </div>

              {/* Group Details Card */}
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
              >
                <h4 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
                  Chamber Rules & Stakes
                </h4>
                {arenaDescription && (
                  <p className="text-xs leading-relaxed" style={{ color: "var(--fg)" }}>
                    {arenaDescription}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <span className="text-[10px] block font-semibold" style={{ color: "var(--fg-muted)" }}>Verification Type</span>
                    <span className="font-extrabold capitalize flex items-center gap-1.5 mt-0.5">
                      {proofIcon(arenaProofType)} {arenaProofType}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <span className="text-[10px] block font-semibold" style={{ color: "var(--fg-muted)" }}>Daily Deadline</span>
                    <span className="font-extrabold flex items-center gap-1.5 mt-0.5">
                      ⏰ {arenaDeadlineTime}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Panel (Integrated directly inside Group Profile) */}
              {isAdmin && (
                <div
                  className="rounded-2xl p-4 space-y-3"
                  style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                      👑 Admin Settings & Control
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <CustomSelect
                      label="Required Verification Rule"
                      value={arenaProofType}
                      options={PROOF_TYPE_OPTIONS}
                      onChange={(val) => handleUpdateProofType(val)}
                    />
                    <DeadlineTimerSetter
                      currentDeadline={arenaDeadlineTime}
                      onSave={(newDeadline) => handleUpdateDeadlineTime(newDeadline)}
                    />
                  </div>

                  {/* Pending Requests */}
                  {pendingRequests.length > 0 && (
                    <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
                      <h5 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                        Pending Join Requests ({pendingRequests.length})
                      </h5>
                      <div className="space-y-2 max-h-36 overflow-y-auto styled-scroll pr-1">
                        {pendingRequests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between p-2.5 rounded-xl"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                          >
                            <span className="text-xs font-bold truncate">
                              {req.user_name || `Member #${req.user_id}`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleApprove(req.user_id)}
                                className="px-3 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500 text-white hover:bg-emerald-600 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(req.user_id)}
                                className="px-3 py-1 rounded-lg text-[10px] font-extrabold bg-red-500/20 text-red-500 hover:bg-red-500/30 transition"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Members List with Tags and Remove Button */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
                    Group Members ({arenaMembers.length})
                  </h4>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto styled-scroll pr-1">
                  {sortedMembers.map((member, idx) => {
                    const memberName =
                      member.user_name ||
                      member.full_name ||
                      member.email ||
                      `Member #${member.user_id}`;
                    const isMemberAdmin = member.role === "admin";
                    const isMe = member.user_id === userId;

                    return (
                      <div
                        key={member.user_id || idx}
                        className="flex items-center justify-between p-3 rounded-2xl transition hover:bg-[var(--bg-raised)]"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            name={memberName}
                            imageUrl={member.user_avatar_url}
                            size={8}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate flex items-center gap-1.5">
                              <span>{memberName}</span>
                              {isMe && (
                                <span className="text-[10px] font-normal" style={{ color: "var(--fg-muted)" }}>
                                  (You)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isMemberAdmin ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm flex items-center gap-1">
                              👑 Group Admin
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: "var(--bg-raised)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}>
                              Member
                            </span>
                          )}

                          {/* Authority for Admins to remove users */}
                          {isAdmin && !isMe && (
                            <button
                              onClick={() => handleKickMember(member)}
                              className="px-2.5 py-1 rounded-full text-[10px] font-extrabold text-red-500 hover:bg-red-500/10 border border-red-500/30 transition active:scale-95 flex items-center gap-1"
                              title={`Remove ${memberName} from arena`}
                            >
                              🚫 Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Danger Zone Actions */}
              <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
                {isAdmin ? (
                  <button
                    onClick={handleDeleteArena}
                    className="w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-extrabold transition hover:opacity-90 active:scale-95 text-white"
                    style={{
                      background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                      boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    🗑️ Delete Arena Group
                  </button>
                ) : (
                  <button
                    onClick={handleLeaveArena}
                    className="w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-extrabold transition hover:opacity-90 active:scale-95 text-white"
                    style={{
                      background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                    }}
                  >
                    🚪 Leave Arena Group
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE VIEWER ── */}
      {viewerImageUrl && (
        <div
          onClick={() => {
            setViewerImageUrl(null);
            setViewerZoom(1);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-4"
          >
            <img
              src={viewerImageUrl}
              alt="Full view"
              style={{
                transform: `scale(${viewerZoom})`,
                transition: "transform 0.2s ease",
              }}
              className="max-h-[78vh] max-w-full object-contain rounded-2xl"
            />
            <div
              className="flex items-center gap-3 px-5 py-2.5 rounded-full border text-white text-xs font-bold"
              style={{
                background: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.12)",
              }}
            >
              <button
                onClick={() => setViewerZoom((z) => Math.max(z - 0.2, 0.4))}
                className="px-2 py-0.5 rounded hover:bg-white/10 transition"
              >
                −
              </button>
              <span>{Math.round(viewerZoom * 100)}%</span>
              <button
                onClick={() => setViewerZoom((z) => Math.min(z + 0.2, 4))}
                className="px-2 py-0.5 rounded hover:bg-white/10 transition"
              >
                +
              </button>
              <button
                onClick={() => {
                  setViewerImageUrl(null);
                  setViewerZoom(1);
                }}
                className="ml-3 px-3 py-1 rounded-full text-white text-xs font-bold hover:opacity-80 transition"
                style={{ background: "var(--danger)" }}
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
