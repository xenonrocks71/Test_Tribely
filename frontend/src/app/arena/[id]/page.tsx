"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { formatErrorMessage } from "../../utils/api";

import dataCache from "../../utils/dataCache";
import { API_BASE_URL, getWsBaseUrl } from "../../utils/config";
import { useToast } from "../../context/ToastContext";
import {
  Camera, PenLine, Link2, Clock, Sunrise, Sun, Sunset, Moon,
  Image as ImageIcon, Video, Mic, FileText, Paperclip, Crown, UserX,
  LogOut, Trash2, CheckCircle2, XCircle, MessageCircle, BookOpen, Users,
  Settings, Copy, QrCode, Share2, ArrowLeft, MoreVertical, ChevronDown,
  Flame, Key, Target, Shield, X, Check, Plus, Lock, Unlock, Bell, Zap, Coins
} from "lucide-react";
import KudosWalletModal from "../../../components/KudosWalletModal";



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
  t === "image" ? <Camera className="w-3.5 h-3.5" /> : t === "link" ? <Link2 className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />;

const isImageUrl = (url: string) =>
  typeof url === "string" &&
  (url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(url));

const isHttpUrl = (url: string) =>
  typeof url === "string" &&
  (url.startsWith("http://") || url.startsWith("https://"));

function formatCallTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return "Just now";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Recently";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function sanitizeSnippet(snippet?: string) {
  if (!snippet) return "";
  return snippet.replace(/<[^>]*>?/gm, "").trim();
}

function renderFormattedMessageContent(
  content: string,
  onImageClick?: (url: string) => void
) {
  if (!content) return null;
  const trimmed = content.trim();

  // 1. Direct Base64 / HTTP Image URL
  if (
    trimmed.startsWith("data:image/") ||
    /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(trimmed)
  ) {
    return (
      <div className="space-y-1 my-0.5">
        <img
          src={trimmed}
          alt="Media proof"
          onClick={() => onImageClick?.(trimmed)}
          className="max-h-60 rounded-xl object-cover cursor-pointer hover:opacity-90 transition shadow-sm"
        />
      </div>
    );
  }

  // 2. Direct Video URL (.mp4, .webm, .mov)
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(trimmed)) {
    return (
      <div className="space-y-1 my-0.5">
        <video
          src={trimmed}
          controls
          className="max-h-60 rounded-xl w-full bg-black shadow-sm"
        />
      </div>
    );
  }

  // 3. Bracketed attachment check: [filename.ext]
  const bracketMatch = trimmed.match(/^(?:📷|🎥|🎙️|📄)?\s*\[(.*?)\]\s*([\s\S]*)$/);
  if (bracketMatch) {
    const filename = bracketMatch[1];
    const restText = bracketMatch[2];
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    const isImg = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
    const isVid = ["mp4", "webm", "mov"].includes(ext);
    const isPdf = ["pdf", "doc", "docx", "txt"].includes(ext);

    return (
      <div className="space-y-1.5 my-0.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/25 backdrop-blur-xs text-xs font-semibold">
          <span className="text-base">{isImg ? <ImageIcon className="w-4 h-4" /> : isVid ? <Video className="w-4 h-4" /> : isPdf ? <FileText className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono font-bold text-[11px] tracking-tight">{filename}</p>
            <span className="text-[9px] opacity-75 uppercase tracking-wider font-extrabold">{ext} file</span>
          </div>
        </div>
        {restText && (
          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {restText}
          </p>
        )}
      </div>
    );
  }

  // 4. Standard text content
  return (
    <span className="whitespace-pre-wrap break-words" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
      {content}
    </span>
  );
}

interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

const PROOF_TYPE_OPTIONS: CustomSelectOption[] = [
  { value: "text", label: "Text Only", icon: <PenLine className="w-3.5 h-3.5" /> },
  { value: "link", label: "Link (URL)", icon: <Link2 className="w-3.5 h-3.5" /> },
  { value: "image", label: "Image Upload", icon: <Camera className="w-3.5 h-3.5" /> },
];

const DEADLINE_TIME_OPTIONS: CustomSelectOption[] = [
  { value: "05:00 AM", label: "05:00 AM (Early Bird)", icon: <Sunrise className="w-3.5 h-3.5" /> },
  { value: "06:00 AM", label: "06:00 AM", icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "09:00 AM", label: "09:00 AM", icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "12:00 PM", label: "12:00 PM (Noon Cutoff)", icon: <Sun className="w-3.5 h-3.5" /> },
  { value: "06:00 PM", label: "06:00 PM", icon: <Sunset className="w-3.5 h-3.5" /> },
  { value: "08:00 PM", label: "08:00 PM", icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "10:00 PM", label: "10:00 PM (Night Cutoff)", icon: <Moon className="w-3.5 h-3.5" /> },
  { value: "11:00 PM", label: "11:00 PM", icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "11:59 PM", label: "11:59 PM (Midnight End)", icon: <Clock className="w-3.5 h-3.5" /> },
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
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArenaCustomTimeDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-98"
        style={{
          background: "var(--bg-raised)",
          borderColor: open ? "var(--accent)" : "var(--border)",
          color: "var(--fg)",
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180 text-[var(--accent)]" : "text-[var(--fg-muted)]"}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-48 overflow-y-auto rounded-2xl border p-1.5 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-150 styled-scroll"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border)",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.4)",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${value === opt.value
                  ? "bg-[var(--accent)] text-white shadow-sm font-black"
                  : "text-[var(--fg)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
                }`}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
          ))}
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
    const parts = currentDeadline.split(" ");
    const period = parts[1] || "PM";
    const timeParts = (parts[0] || "10:00").split(":");
    return {
      hour: timeParts[0] ? timeParts[0].padStart(2, "0") : "10",
      minute: timeParts[1] ? timeParts[1].padStart(2, "0") : "00",
      period,
    };
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
          <Clock className="w-3.5 h-3.5" /> Daily Cutoff Timer Setter
        </label>
        <span
          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          Active: {currentDeadline || `${hour}:${minute} ${period}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ArenaCustomTimeDropdown
          value={hour}
          onChange={setHour}
          options={HOURS.map((h) => ({ value: h, label: `${h} Hour` }))}
        />

        <span className="text-sm font-black" style={{ color: "var(--fg-muted)" }}>
          :
        </span>

        <ArenaCustomTimeDropdown
          value={minute}
          onChange={setMinute}
          options={MINUTES.map((m) => ({ value: m, label: `${m} Min` }))}
        />

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
  const { showToast, toast } = useToast();

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
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"chats" | "ledger">("chats");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQueryChat, setSearchQueryChat] = useState("");
  const [show3DotsMenu, setShow3DotsMenu] = useState(false);

  // Kudos Ecosystem States
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [userKudosBalance, setUserKudosBalance] = useState<number | null>(null);
  const [arenaVaultKudos, setArenaVaultKudos] = useState<number>(0);
  const [kudosDaysRemaining, setKudosDaysRemaining] = useState<number>(21);

  // Fetch Kudos User Balance & Arena Vault Metrics
  const fetchKudosData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const [walletRes, vaultRes] = await Promise.all([
        fetch("http://localhost:8000/api/kudos/wallet", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`http://localhost:8000/api/kudos/arena/${id}/vault`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const walletData = await walletRes.json();
      if (walletData.status === "success") {
        setUserKudosBalance(walletData.data.kudos_balance);
      }

      const vaultData = await vaultRes.json();
      if (vaultData.status === "success") {
        setArenaVaultKudos(vaultData.data.kudos_reserve_vault);
        setKudosDaysRemaining(vaultData.data.cycle_days_remaining);
      }
    } catch (e) {
      console.error("Error fetching Kudos data:", e);
    }
  };

  useEffect(() => {
    if (id) {
      fetchKudosData();
    }
  }, [id]);


  // User's Joined Arenas List (for Left Chats Sidebar)
  const [userArenas, setUserArenas] = useState<any[]>([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  useEffect(() => {
    const raw = dataCache.get("/api/arenas/");
    if (raw) {
      const cached = Array.isArray(raw) ? raw : raw?.data || raw?.arenas || [];
      if (cached.length > 0) setUserArenas(cached);
    }
    api.get("/api/arenas/").then((res) => {
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.data || res.data?.arenas || [];
      setUserArenas(list);
      dataCache.set("/api/arenas/", list);
    }).catch(() => { });
  }, []);

  // Instant zero-delay synchronization of active arena metadata from userArenas list
  useEffect(() => {
    if (userArenas && userArenas.length > 0 && id) {
      const cur = userArenas.find((a: any) => a.id === Number(id));
      if (cur && cur.name) {
        setArenaName(cur.name);
        setArenaProofType((cur.proof_type as ArenaProofType) || "text");
        setArenaDeadlineTime(cur.deadline_time || "10:00 PM");
        setArenaIconUrl(cur.icon_url || null);
        setArenaDescription(cur.description || "");
        setArenaPenaltyAmount(cur.penalty_amount || 0);
        setArenaInviteCode(cur.invite_code || "");
        if (cur.user_role === "admin") setIsAdmin(true);
      }
    }
  }, [userArenas, id]);


  // Real-Time Voice & Video Call States
  const [showVoiceCallModal, setShowVoiceCallModal] = useState(false);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [callDuration, setCallDuration] = useState(14);

  useEffect(() => {
    let timer: any;
    if (showVoiceCallModal || showVideoCallModal) {
      timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [showVoiceCallModal, showVideoCallModal]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };
    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    handleResize();
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
    };
  }, []);

  const [arenaMembers, setArenaMembers] = useState<ArenaMember[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showMobileLedger, setShowMobileLedger] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [activeCallState, setActiveCallState] = useState<{
    active: boolean;
    call_type: "audio" | "video";
    caller_name: string;
  } | null>(null);

  const handleStartVoiceCall = async () => {
    setShowVoiceCallModal(true);
    if (activeCallState?.active) {
      toast.info("📞 Joined ongoing Voice Huddle in progress!");
      return;
    }

    const callerName = arenaMembers.find((m) => m.user_id === userId)?.user_name || "A member";
    setActiveCallState({
      active: true,
      call_type: "audio",
      caller_name: callerName,
    });
    try {
      await api.post(`/api/activity/arena/${id}/message`, {
        content: `📞 Voice Huddle started by ${callerName}! Tap Join Call to enter the group call.`,
        message_type: "call_invite",
      });
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            event_type: "call_started",
            call_type: "audio",
            caller_name: callerName,
            caller_id: userId,
            arena_id: Number(id),
          })
        );
      }
    } catch {
      /* ignore */
    }
  };

  const handleStartVideoCall = async () => {
    setShowVideoCallModal(true);
    if (activeCallState?.active) {
      toast.info("📹 Joined ongoing HD Video Call in progress!");
      return;
    }

    const callerName = arenaMembers.find((m) => m.user_id === userId)?.user_name || "A member";
    setActiveCallState({
      active: true,
      call_type: "video",
      caller_name: callerName,
    });
    try {
      await api.post(`/api/activity/arena/${id}/message`, {
        content: `📹 HD Video Call started by ${callerName}! Tap Join Call to enter the stream.`,
        message_type: "call_invite",
      });
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            event_type: "call_started",
            call_type: "video",
            caller_name: callerName,
            caller_id: userId,
            arena_id: Number(id),
          })
        );
      }
    } catch {
      /* ignore */
    }
  };

  const handleEndCall = async () => {
    setShowVoiceCallModal(false);
    setShowVideoCallModal(false);
    setActiveCallState(null);

    const callerName = arenaMembers.find((m) => m.user_id === userId)?.user_name || "A member";
    try {
      await api.post(`/api/activity/arena/${id}/message`, {
        content: `📞 Voice/Video call session ended by ${callerName}.`,
        message_type: "call_ended",
      });
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            event_type: "call_ended",
            caller_name: callerName,
            arena_id: Number(id),
          })
        );
      }
    } catch {
      /* ignore */
    }
  };

  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [arenaIconUrl, setArenaIconUrl] = useState<string | null>(null);
  const [arenaDescription, setArenaDescription] = useState("");
  const [arenaPenaltyAmount, setArenaPenaltyAmount] = useState<number>(0);
  const [arenaInviteCode, setArenaInviteCode] = useState("");

  const copyInviteLink = () => {
    const code = arenaInviteCode || `TRIBELY-${id}`;
    const url = `${window.location.origin}/arena/join/${code}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    showToast("Invite link copied to clipboard!", "success");
  };

  const COMMON_EMOJIS = [
    "😀", "😂", "❤️", "🔥", "👍", "🎉",
    "🚀", "💯", "👏", "🙌", "💪", "✨",
    "😎", "💡", "📌", "🏆", "⭐", "🙏",
    "🥳", "🎯", "😍", "🤩", "⚡", "📷"
  ];

  const wsRef = useRef<WebSocket | null>(null);

  // Instagram-style horizontal swipe gesture navigation between Chats & Ledger
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Horizontal swipe threshold (>50px and horizontal distance dominant over vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0 && mobileTab === "chats") {
        // Swipe Left -> Open Ledger
        setMobileTab("ledger");
        setShowMobileLedger(true);
      } else if (deltaX > 0 && mobileTab === "ledger") {
        // Swipe Right -> Open Chats
        setMobileTab("chats");
        setShowMobileLedger(false);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement | null>(null);
  const dpFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    if (showVideoCallModal) {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: true })
          .then((stream) => {
            mediaStream = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch((err) => {
            console.warn("Camera/Mic access not granted:", err);
          });
      }
    } else {
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        localVideoRef.current.srcObject = null;
      }
    }
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showVideoCallModal]);

  const toggleCameraTrack = () => {
    setIsCamOn((prev) => {
      const next = !prev;
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getVideoTracks().forEach((t) => (t.enabled = next));
      }
      return next;
    });
  };

  const toggleMicTrack = () => {
    setIsMicOn((prev) => {
      const next = !prev;
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getAudioTracks().forEach((t) => (t.enabled = next));
      }
      return next;
    });
  };

  // Auto-resize textarea like WhatsApp — grows up to 5 lines, snaps back on clear
  useEffect(() => {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 5 * 24; // 5 lines × 24px line-height
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }, [chatInput]);

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

    // Zero-delay instant cache pre-hydration
    const cachedHistory = dataCache.get(`/api/activity/arena/${id}/history`);
    if (cachedHistory) {
      const data = cachedHistory.data || cachedHistory;
      if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
      if (Array.isArray(data.messages)) setMessages(data.messages);
    }
    const cachedMembers = dataCache.get(`/api/arenas/${id}/members`);
    if (cachedMembers) {
      const list = Array.isArray(cachedMembers.data) ? cachedMembers.data : Array.isArray(cachedMembers) ? cachedMembers : [];
      if (list.length > 0) setArenaMembers(list);
    }
    const rawArenas = dataCache.get("/api/arenas/");
    const cachedArenas = Array.isArray(rawArenas)
      ? rawArenas
      : Array.isArray(rawArenas?.data)
        ? rawArenas.data
        : Array.isArray(rawArenas?.arenas)
          ? rawArenas.arenas
          : [];
    if (cachedArenas.length > 0) {
      const cur = cachedArenas.find((a: any) => a.id === Number(id));
      if (cur && cur.name) {
        setArenaName(cur.name);
        setArenaProofType((cur.proof_type as ArenaProofType) || "text");
        setArenaDeadlineTime(cur.deadline_time || "10:00 PM");
        setArenaIconUrl(cur.icon_url || null);
        setArenaDescription(cur.description || "");
        setArenaPenaltyAmount(cur.penalty_amount || 0);
        setArenaInviteCode(cur.invite_code || "");
        if (cur.user_role === "admin") setIsAdmin(true);
      }
    }

    fetchHistory();
    fetchMembersList();

    const checkAdmin = async () => {
      try {
        const res = await api.get("/api/arenas/");
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data?.arenas)
              ? res.data.arenas
              : [];
        const cur = list.find((a: any) => a.id === Number(id));
        if (cur && cur.name) {
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
        /* ignore error */
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

          // Real-time Join Request & Approval Event Handler
          if (
            eventType === "join_request" ||
            eventType === "join_request_created" ||
            eventType === "join_request_update" ||
            eventType === "join_request_approved" ||
            eventType === "join_request_rejected" ||
            eventType === "member_joined"
          ) {
            fetchPendingRequests();
            fetchMembersList();
            if ((eventType === "join_request" || eventType === "join_request_created") && isAdmin) {
              toast.info(`New join request: ${liveData.user_name || "A member"} requested access.`);
            }
            if (eventType === "join_request_approved") {
              const approvedUserId = Number(liveData.user_id);
              const currentStoredUserId = Number(localStorage.getItem("tribely_user_id"));
              if (approvedUserId === currentStoredUserId) {
                toast.success("🎉 Your join request was approved! Welcome to the arena.");
              }
            }
            return;
          }


          // Real-time Voice / Video Call Started Event Handler
          if (liveData?.event_type === "call_started") {
            const callerName = liveData.caller_name || "A member";
            const callType = liveData.call_type || "audio";
            toast.info(`📞 ${callerName} started a live ${callType === "video" ? "HD Video" : "Audio"} Call!`);
            setActiveCallState({
              active: true,
              call_type: callType,
              caller_name: callerName,
            });
            return;
          }

          // Real-time Voice / Video Call Ended Event Handler
          if (liveData?.event_type === "call_ended") {
            const callerName = liveData.caller_name || "A member";
            toast.info(`📞 Call session ended by ${callerName}.`);
            setActiveCallState(null);
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

          // Real-time Ledger Submission & Vote Update Handler
          if (
            liveData?.event_type === "ledger_update" ||
            liveData?.action === "submission_created" ||
            liveData?.action === "vote_updated"
          ) {
            if (liveData.action === "submission_created" && liveData.submission) {
              const newSub = liveData.submission;
              setSubmissions((prev) => {
                const exists = prev.some((s) => s.id === newSub.id);
                if (exists) return prev;
                return [newSub, ...prev];
              });
              if (newSub.user_id !== userId) {
                toast.info(`🎉 New proof posted by ${newSub.user_name || "a member"} in Ledger!`);
              }
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

      ws.onerror = () => { };
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
      toast.info("Image selected! Click 'Submit Proof' below to confirm.");
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
      setError(formatErrorMessage(err.response?.data?.detail, "Proof submission failed."));
    }

  };

  const handleVoteSubmission = async (
    submissionId: number,
    voteType: "upvote" | "downvote",
  ) => {
    try {
      // Optimistic UI update
      setSubmissions((prev) =>
        prev.map((sub) => {
          if (sub.id !== submissionId) return sub;
          const isUp = voteType === "upvote";
          const curUp = sub.upvotes || 0;
          const curDown = sub.downvotes || 0;
          return {
            ...sub,
            upvotes: isUp ? curUp + 1 : Math.max(0, curUp - 1),
            downvotes: !isUp ? curDown + 1 : Math.max(0, curDown - 1),
          };
        })
      );
      await api.post(`/api/activity/submission/${submissionId}/vote`, {
        vote_type: voteType,
      });
      fetchHistory();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Vote operation failed.";
      toast.error(msg);
      fetchHistory();
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

  if ((userKudosBalance !== null && userKudosBalance <= 0) || error === "ZERO_KUDOS_BLOCKED") {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-black p-6 text-center text-white z-50">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40 text-3xl">
            🚫
          </div>
          <div>
            <h2 className="text-xl font-black text-rose-300">Arena Access Blocked</h2>
            <p className="text-xs font-semibold text-rose-400 mt-1 uppercase tracking-wider">0 Kudos Balance in Wallet</p>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            ⚠️ Your Kudos balance is 0. Daily absent penalties continue to accrue for each day missed until you recharge. Top-up your wallet now to unlock the arena, submit your proof, and protect your streak!
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => setShowKudosModal(true)}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 py-3 text-sm font-extrabold text-black shadow-lg shadow-amber-500/30 hover:scale-105 transition"
            >
              ⚡ Recharge Wallet (₹50 = 5,000 Kudos)
            </button>
            <Link
              href="/dashboard"
              className="block w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition"
            >
              ← Back to Workspace Dashboard
            </Link>
          </div>
        </div>

        <KudosWalletModal
          isOpen={showKudosModal}
          onClose={() => {
            setShowKudosModal(false);
            fetchKudosData();
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="w-screen flex flex-col overflow-hidden"

      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        height: viewportHeight ? `${viewportHeight}px` : "100dvh",
      }}
    >
      {/* ── HEADER (MOBILE ONLY, HIDDEN ON DESKTOP) ── */}
      <header
        className="lg:hidden sticky top-0 z-30 shrink-0 px-4 py-3 flex items-center justify-between glass"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {/* Left: Back Link + Avatar Stack + Title & Online Status */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Link
            href="/dashboard"
            className="p-2 rounded-full transition hover:scale-105 active:scale-95 shrink-0"
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
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>

          <div
            onClick={() => setShowGroupInfoModal(true)}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-85 transition group flex-1"
            title="Open Arena Group Profile & Info"
          >
            <div className="relative shrink-0 flex items-center">
              <Avatar
                name={arenaName || `Arena #${id}`}
                imageUrl={arenaIconUrl || undefined}
                size={9}
              />
              {arenaMembers.length > 1 && (
                <span className="absolute -top-1 -right-1.5 w-5 h-5 rounded-full text-[9px] font-black text-white bg-[var(--accent)] flex items-center justify-center border-2 border-[var(--bg)] shadow-xs">
                  +{arenaMembers.length > 9 ? "9+" : arenaMembers.length}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1
                className="truncate text-base font-black capitalize tracking-tight group-hover:text-[var(--accent)] transition"
                style={{ color: "var(--fg)" }}
              >
                {arenaName || `Chamber #${id}`}
              </h1>
              <p
                className="flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: "var(--success)" }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{arenaMembers.length} members online</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Kudos Wallet + Voice Call + Video Call + 3-Dots Menu */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Arena Vault Badge */}
          <button
            onClick={() => setShowGroupInfoModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-amber-400 text-xs font-black hover:scale-105 transition shadow-sm"
            title="View Arena Locked Vault & 21-Day Consistency Standings"
          >
            <span className="font-extrabold text-sm text-amber-400">₹</span>
            <span className="hidden sm:inline">🔒 Vault: ₹ {arenaVaultKudos.toLocaleString()}</span>
          </button>




          {/* Voice Call */}
          <button

            onClick={() => setShowVoiceCallModal(true)}
            className="p-2 rounded-full transition hover:bg-[var(--bg-raised)] active:scale-95"
            style={{ color: "var(--fg)" }}
            title="Voice Call"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>

          {/* Video Call */}
          <button
            onClick={() => setShowVideoCallModal(true)}
            className="p-2 rounded-full transition hover:bg-[var(--bg-raised)] active:scale-95"
            style={{ color: "var(--fg)" }}
            title="Video Call"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          {/* 3-Dots Menu */}
          <button
            onClick={() => setShow3DotsMenu(!show3DotsMenu)}
            className="p-2 rounded-full transition hover:bg-[var(--bg-raised)] active:scale-95 relative"
            style={{ color: "var(--fg)" }}
            title="Arena Controls & Info"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
            {isAdmin && (
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1 right-1" />
            )}
          </button>
        </div>
      </header>

      {/* ── 3-DOTS ACTION MENU POPOVER ── */}
      {show3DotsMenu && (
        <div className="absolute top-16 right-4 z-40 w-72 rounded-2xl shadow-2xl p-2 animate-fade-in border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-[var(--border)]">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--fg-muted)]">Arena Controls</span>
            <button onClick={() => setShow3DotsMenu(false)} className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold hover:bg-[var(--bg-raised)] text-[var(--fg-subtle)]">✕</button>
          </div>

          <div className="py-1">
            {/* Live Ledger */}
            <button
              onClick={() => {
                setShow3DotsMenu(false);
                setMobileTab("ledger");
                setShowMobileLedger(true);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--bg-raised)] flex items-center gap-3 transition"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.12)" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#f97316" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--fg)" }}>Live Ledger</p>
                <p className="text-[10px]" style={{ color: "var(--fg-muted)" }}>View proof submissions</p>
              </div>
              {mobileTab === "ledger" && <span className="ml-auto w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
            </button>

            {/* Arena Profile / Group Info */}
            <button
              onClick={() => { setShow3DotsMenu(false); setShowGroupInfoModal(true); }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--bg-raised)] flex items-center gap-3 transition"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.12)" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#6366f1" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--fg)" }}>Arena Profile</p>
                <p className="text-[10px]" style={{ color: "var(--fg-muted)" }}>Members, rules & settings</p>
              </div>
              {isAdmin && <span className="ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-black bg-amber-500/20 text-amber-500 shrink-0">Admin</span>}
            </button>

            {/* Rules & Stakes */}
            <button
              onClick={() => { setShow3DotsMenu(false); setShowGroupInfoModal(true); }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--bg-raised)] flex items-center gap-3 transition"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.12)" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#10b981" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--fg)" }}>Rules & Stakes</p>
                <p className="text-[10px]" style={{ color: "var(--fg-muted)" }}>₹{arenaPenaltyAmount || 500} penalty · {arenaProofType} proof</p>
              </div>
            </button>

            <div className="my-1 border-t border-[var(--border)]" />

            {/* Leave or Delete */}
            {isAdmin ? (
              <button
                onClick={() => { setShow3DotsMenu(false); handleDeleteArena(); }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/10 shrink-0">
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <p className="text-xs font-extrabold">Delete Arena</p>
              </button>
            ) : (
              <button
                onClick={() => { setShow3DotsMenu(false); handleLeaveArena(); }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/10 shrink-0">
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <p className="text-xs font-extrabold">Leave Arena</p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── SEARCH INPUT BAR (SLIDE DOWN WHEN ACTIVE) ── */}
      {showSearchInput && (
        <div className="px-4 py-2 bg-[var(--bg-card)] border-b border-[var(--border)] animate-fade-in flex items-center gap-2">
          <input
            type="text"
            placeholder="Search messages or proofs..."
            value={searchQueryChat}
            onChange={(e) => setSearchQueryChat(e.target.value)}
            className="input-base text-xs py-2 focus-accent flex-1"
          />
          <button
            onClick={() => { setSearchQueryChat(""); setShowSearchInput(false); }}
            className="text-xs font-bold text-[var(--fg-muted)] px-2 py-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── TOP CAPSULE SWITCHER (MOBILE ONLY, HIDDEN ON DESKTOP) ── */}
      <div className="lg:hidden shrink-0 px-4 py-2.5 flex items-center justify-center bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="w-full max-w-xs flex items-center p-1 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-card)] shadow-xs">
          <button
            type="button"
            onClick={() => {
              setMobileTab("ledger");
              setShowMobileLedger(true);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all duration-200 text-center ${mobileTab === "ledger"
                ? "capsule-tab-active shadow-md"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
          >
            Ledger
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileTab("chats");
              setShowMobileLedger(false);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all duration-200 text-center ${mobileTab === "chats"
                ? "capsule-tab-active shadow-md"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
          >
            Chats
          </button>
        </div>
      </div>

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
        {/* ── COLUMN 1: LEFT CHATS SIDEBAR ── */}
        <div
          className="w-64 xl:w-72 shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] hidden lg:flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-[var(--border)] space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight flex items-center gap-1.5" style={{ color: "var(--fg)" }}>
                💬 Chats
              </h2>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
                {userArenas.length} joined
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search arenas..."
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-[11px] border bg-[var(--bg-raised)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                style={{ borderColor: "var(--border)", color: "var(--fg)" }}
              />
              <span className="absolute left-2 top-2 text-[10px] text-[var(--fg-muted)]">🔍</span>
            </div>
          </div>

          {/* Arenas List */}
          <div className="flex-1 overflow-y-auto styled-scroll p-1.5 space-y-0.5">
            {(Array.isArray(userArenas) ? userArenas : [])
              .filter((a) => a && a.name && a.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase()))
              .map((item) => {
                const isActive = item.id === Number(id);
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(`/arena/${item.id}`)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl transition flex items-center gap-2.5 relative group ${isActive
                        ? "bg-[var(--accent-light)] border-l-2 border-[var(--accent)]"
                        : "hover:bg-[var(--bg-raised)]"
                      }`}
                  >
                    <Avatar name={item.name} imageUrl={item.icon_url} size={8} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className={`text-[11px] truncate capitalize ${isActive ? "font-bold text-[var(--accent)]" : "font-semibold text-[var(--fg)]"}`}>
                          {item.name}
                        </h4>
                        <span className="text-[9px] font-medium shrink-0 text-[var(--fg-muted)]">
                          {formatRelativeTime(item.last_activity_at)}
                        </span>
                      </div>
                      <p className="text-[10px] truncate text-[var(--fg-subtle)]">
                        {sanitizeSnippet(item.last_activity_snippet) || `${item.member_count || 1} members`}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* ── 75% MAIN STAGE CONTAINER (DESKTOP + MOBILE SWITCHABLE VIEW) ── */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
        >
          {/* Desktop-Only Stage Header (75% Area Only) */}
          <div className="hidden lg:flex shrink-0 px-4 py-2 items-center justify-between glass border-b border-[var(--border)]">
            {/* Left: Arena Avatar + Name & Online Status */}
            <div
              onClick={() => setShowGroupInfoModal(true)}
              className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 transition group"
              title="Open Arena Group Profile & Info"
            >
              <div className="relative shrink-0 flex items-center">
                <Avatar
                  name={arenaName || `Arena #${id}`}
                  imageUrl={arenaIconUrl || undefined}
                  size={8}
                />
                {arenaMembers.length > 1 && (
                  <span className="absolute -top-0.5 -right-1 w-4 h-4 rounded-full text-[8px] font-black text-white bg-[var(--accent)] flex items-center justify-center border-2 border-[var(--bg)] shadow-xs">
                    +{arenaMembers.length > 9 ? "9+" : arenaMembers.length}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-black capitalize tracking-tight group-hover:text-[var(--accent)] transition text-[var(--fg)]">
                  {arenaName || `Chamber #${id}`}
                </h1>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--success)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{arenaMembers.length} members online</span>
                  <span className="text-[var(--fg-muted)] font-normal">· ₹{arenaPenaltyAmount} Stake</span>

                </p>
              </div>
            </div>

            {/* Center: Desktop Capsule Switcher [ Messenger | Ledger ] */}
            <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setMobileTab("chats");
                  setShowMobileLedger(false);
                }}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 text-center ${mobileTab === "chats"
                    ? "capsule-tab-active shadow-md"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
              >
                💬 Messenger
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileTab("ledger");
                  setShowMobileLedger(true);
                }}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 text-center ${mobileTab === "ledger"
                    ? "capsule-tab-active shadow-md"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
              >
                📋 Live Ledger
              </button>
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Voice Call */}
              <button
                onClick={handleStartVoiceCall}
                className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-raised)] active:scale-90 cursor-pointer"
                style={{ color: "var(--fg)" }}
                title="Start Voice Huddle"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              </button>

              {/* Video Call */}
              <button
                onClick={handleStartVideoCall}
                className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-raised)] active:scale-90 cursor-pointer"
                style={{ color: "var(--fg)" }}
                title="Start Video Stream"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>

              {/* Search */}
              <button
                onClick={() => setShowSearchInput(!showSearchInput)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-raised)] active:scale-90"
                style={{ color: "var(--fg)" }}
                title="Search messages"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>

              {/* Group Info / Settings */}
              <button
                onClick={() => setShowGroupInfoModal(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-raised)] active:scale-90"
                style={{ color: "var(--fg)" }}
                title="Group Info & Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </button>

              {/* More / 3-dots */}
              <button
                onClick={() => setShow3DotsMenu(!show3DotsMenu)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-raised)] active:scale-90 relative"
                style={{ color: "var(--fg)" }}
                title="More options"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
                {isAdmin && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5 ring-2 ring-[var(--bg)]" />
                )}
              </button>
            </div>

          </div>

          {/* ── STAGE: CHATTING BOX (INSTAGRAM DM STYLE) ── */}
          <div
            className={`flex-1 min-h-0 flex flex-col overflow-hidden relative ${mobileTab === "chats" ? "flex" : "hidden"
              }`}
          >
            {/* Active Call Live Banner */}
            {activeCallState?.active && (
              <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-between shadow-md shrink-0 animate-fade-in border-b border-emerald-400/30">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>Live {activeCallState.call_type === "video" ? "HD Video Call" : "Voice Huddle"} in progress (Started by {activeCallState.caller_name})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (activeCallState.call_type === "video") setShowVideoCallModal(true);
                    else setShowVoiceCallModal(true);
                  }}
                  className="px-3 py-1 rounded-full bg-white text-emerald-800 text-[11px] font-black hover:bg-emerald-50 active:scale-95 transition shadow-xs cursor-pointer"
                >
                  Join Call 📞
                </button>
              </div>
            )}
            {/* messages list — gets bottom padding so last message isn't hidden behind input */}
            <div
              className="flex-1 min-h-0 px-3 sm:px-5 py-4 overflow-y-auto styled-scroll flex flex-col-reverse space-y-reverse space-y-1.5"
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
                        className={`flex items-end ${isMe ? "justify-end" : "justify-start"}`}
                        style={{ marginTop: isGroupStart ? "8px" : "2px" }}
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
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[70%] min-w-0`}
                        >
                          {!isMe && isGroupStart && (
                            <span
                              className="mb-1 ml-1.5 text-[10px] font-semibold truncate max-w-full"
                              style={{ color: "var(--fg-muted)" }}
                            >
                              {msg.sender_name}
                            </span>
                          )}

                          {/* Call Invite Card or Regular Chat Message */}
                          {(msg.message_type === "call_invite" || msg.content.includes("Huddle started by") || msg.content.includes("Video Call started")) ? (
                            <div className={`p-3.5 rounded-2xl flex flex-col gap-2.5 my-1 min-w-[240px] shadow-sm transition-all ${activeCallState?.active
                                ? "bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-blue-500/15 border border-emerald-500/40"
                                : "bg-[var(--bg-raised)] border border-[var(--border)]"
                              }`}>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${activeCallState?.active ? "bg-emerald-500/20 text-emerald-400 animate-pulse" : "bg-[var(--bg-card)] text-[var(--fg-muted)]"
                                  }`}>
                                  {msg.content.includes("Video") ? "📹" : "📞"}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className={`text-xs font-black ${activeCallState?.active ? "text-emerald-400" : "text-[var(--fg-muted)]"}`}>
                                    {activeCallState?.active
                                      ? (msg.content.includes("Video") ? "Live HD Video Call" : "Live Voice Huddle")
                                      : "Call Session Ended"}
                                  </h4>
                                  <p className="text-[10px] text-[var(--fg-muted)] leading-tight">{msg.content}</p>
                                </div>
                              </div>

                              {activeCallState?.active ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (msg.content.includes("Video")) setShowVideoCallModal(true);
                                    else setShowVoiceCallModal(true);
                                  }}
                                  className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-black transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <span>{msg.content.includes("Video") ? "📹 Join Video Stream" : "📞 Join Audio Call"}</span>
                                </button>
                              ) : (
                                <div className="w-full py-1.5 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[10px] font-bold text-[var(--fg-muted)] flex items-center justify-center gap-1.5">
                                  <span>🔒 Call Ended</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="px-4 py-2.5 text-sm leading-relaxed rounded-[20px] break-words whitespace-pre-wrap min-w-0 max-w-full"
                              style={{
                                background: isMe ? "var(--bg-raised)" : "var(--bg-card)",
                                color: "var(--fg)",
                                border: "1px solid var(--border)",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {renderFormattedMessageContent(msg.content, setViewerImageUrl)}
                            </div>
                          )}

                          {(!messages[idx - 1] ||
                            messages[idx - 1].user_id !== msg.user_id) && (
                              <span
                                className={`mt-1 text-[9px] font-medium ${isMe ? "mr-1.5" : "ml-1.5"}`}
                                style={{ color: "var(--fg-subtle)" }}
                              >
                                <TimeOnlyStr iso={msg.created_at} />
                              </span>
                            )}
                        </div>

                        {!isMe && <div className="ml-2" style={{ minWidth: 8 }} />}
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            {/* ── FLOATING EMOJI PICKER POPOVER ── */}
            {showEmojiPicker && (
              <div
                className="absolute bottom-20 right-3 sm:right-4 z-30 p-3 rounded-2xl shadow-2xl border animate-fade-in grid grid-cols-6 gap-2"
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

            {/* ── INSTAGRAM DM INTEGRATED INPUT PILL BAR ── */}
            <form
              onSubmit={(e) => {
                setShowEmojiPicker(false);
                handleSendChatMessage(e);
              }}
              className="shrink-0 z-20 px-3 sm:px-4 py-2.5"
              style={{
                background: "var(--bg)",
                borderTop: "1px solid var(--border)",
                paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div
                className="flex items-end gap-2 rounded-full px-2 py-1.5 transition-all"
                style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Left: Blue Camera Circle Icon */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileLedger(true);
                    if (proofFileInputRef.current) {
                      proofFileInputRef.current.click();
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-[#0095F6] hover:bg-[#0081D6] text-white flex items-center justify-center shrink-0 transition active:scale-90 shadow-xs"
                  title="Capture Photo or Video"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth={2.2} />
                  </svg>
                </button>

                {/* Center: Auto-growing Textarea (WhatsApp style) */}
                <textarea
                  ref={chatTextareaRef}
                  rows={1}
                  placeholder="Message…"
                  className="flex-1 bg-transparent text-sm outline-none px-1 resize-none overflow-y-auto styled-scroll"
                  style={{
                    color: "var(--fg)",
                    wordBreak: "break-word",
                    lineHeight: "24px",
                    minHeight: "24px",
                    maxHeight: "120px", // 5 lines
                    overflowY: "auto",
                    paddingTop: "4px",
                    paddingBottom: "4px",
                  }}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onFocus={() => setShowEmojiPicker(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (chatInput.trim()) {
                        setShowEmojiPicker(false);
                        handleSendChatMessage(e as any);
                      }
                    }
                  }}
                />

                {/* Right Actions inside Pill */}
                {chatInput.trim() ? (
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-full text-xs font-bold text-[#0095F6] hover:text-[#0081D6] transition active:scale-95 shrink-0"
                  >
                    Send
                  </button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0 pr-1" style={{ color: "var(--fg-muted)" }}>
                    {/* Voice Mic Icon */}
                    <button
                      type="button"
                      onClick={() => showToast("Voice message feature coming soon", "info")}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-card)] active:scale-90"
                      title="Voice Message"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>

                    {/* Gallery / Image Icon */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileLedger(true);
                        if (proofFileInputRef.current) {
                          proofFileInputRef.current.click();
                        }
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-card)] active:scale-90"
                      title="Gallery"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>

                    {/* Sticker / Emoji Icon */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-card)] active:scale-90"
                      title="Emoji & Stickers"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </form>


          </div>

          {/* ── STAGE: LEDGER ROOM ── */}
          <div
            className={`flex-1 min-h-0 flex flex-col overflow-hidden ${mobileTab === "ledger" ? "flex" : "hidden"
              }`}
            style={{ background: "var(--bg)" }}
          >
            {/* ── Ledger Header ── */}
            <div
              className="shrink-0 px-4 py-3 flex items-center justify-between"
              style={{
                background: "var(--bg-card)",
                borderBottom: "1px solid var(--border)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Proof Ledger
                </h3>
                <p className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--fg-muted)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  {submissions.length} submission{submissions.length !== 1 ? "s" : ""} · {arenaMembers.length} members · peer-verified
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Rejection threshold info badge */}
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    color: "var(--danger)",
                    border: "1px solid rgba(239,68,68,0.18)",
                  }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reject if dislikes &gt; {Math.floor(arenaMembers.length / 2)}
                </div>
              </div>
            </div>

            {/* ── Proof Submission Composer (shrink-0) ── */}
            <div
              className="shrink-0 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}
            >
              {hasUserSubmittedInActiveWindow() ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-400">Today's Proof Verified! 🎉</h4>
                      <p className="text-[10px] text-emerald-300/80 font-medium">Your habit streak is safe for today.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">✓ Verified</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[var(--fg-muted)]">
                      Submit Today's Proof
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Due {arenaDeadlineTime}
                    </span>
                  </div>

                  <input ref={proofFileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleProofFileSelect} />

                  {/* 1-Tap Camera Box or Image Selection Preview Box */}
                  {arenaProofType === "image" && (
                    <div>
                      {selectedProofPreviewUrl || proofFileName ? (
                        <div className="p-3 rounded-2xl bg-[var(--bg-raised)] border border-[var(--accent)]/40 flex items-center justify-between gap-3 animate-fade-in">
                          <div className="flex items-center gap-3 min-w-0">
                            {selectedProofPreviewUrl && (
                              <img
                                src={selectedProofPreviewUrl}
                                alt="Selected proof preview"
                                className="w-12 h-12 rounded-xl object-cover border border-[var(--border)] shrink-0 shadow-sm"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[var(--fg)] truncate">
                                {proofFileName || "Selected Image"}
                              </p>
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                ✓ Ready to submit
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => proofFileInputRef.current?.click()}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[var(--fg-muted)] hover:text-[var(--fg)] bg-[var(--bg-card)] border border-[var(--border)] transition cursor-pointer"
                            >
                              🔄 Change
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => proofFileInputRef.current?.click()}
                          className="w-full p-4 rounded-2xl border-2 border-dashed border-[var(--accent)]/40 hover:border-[var(--accent)] bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 transition flex flex-col items-center justify-center gap-2 group cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center group-hover:scale-110 transition shadow-sm">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-extrabold text-[var(--fg)]">Tap to Select Photo or Video Proof 📷</p>
                            <p className="text-[10px] text-[var(--fg-muted)] mt-0.5">Choose file, review preview, and click Submit Proof</p>
                          </div>
                        </button>
                      )}
                    </div>
                  )}

                  {/* URL or Text Proof Form */}
                  <form onSubmit={handleSendProof} className="flex items-center gap-2">
                    <input
                      type={arenaProofType === "link" ? "url" : "text"}
                      required={arenaProofType !== "image"}
                      placeholder={arenaProofType === "image" ? "Or paste image URL link…" : arenaProofType === "link" ? "https://example.com/proof" : "Describe your completed task…"}
                      className="flex-1 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs outline-none focus:border-[var(--accent)] transition"
                      style={{ color: "var(--fg)" }}
                      value={proofUrl.startsWith("data:") ? "" : proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!proofUrl.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 transition shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🚀 Submit Proof</span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* ── Proof Cards Feed (flex-1 scrollable) ── */}
            <div className="flex-1 min-h-0 overflow-y-auto styled-scroll p-3 sm:p-4 pb-24 lg:pb-6 space-y-3">
              {submissions.length === 0 ? (
                /* Empty State */
                <div
                  className="flex flex-col items-center justify-center py-20 text-center px-6 rounded-3xl mt-4 animate-fade-in"
                  style={{ border: "2px dashed var(--border)", color: "var(--fg-subtle)" }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: "var(--accent-light)" }}
                  >
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--accent)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--fg)" }}>No proofs yet today</p>
                  <p className="text-xs max-w-xs" style={{ color: "var(--fg-muted)" }}>Be the first to submit your daily proof above and start the accountability chain.</p>
                </div>
              ) : (
                /* Two-column grid on desktop, single-column on mobile */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {submissions.map((sub) => {
                    const memberCount = arenaMembers.length || 1;
                    const downvotes = sub.downvotes || 0;
                    const upvotes = sub.upvotes || 0;
                    const isRejected = downvotes > Math.floor(memberCount / 2);
                    const isMySubmission = sub.user_id === userId;

                    return (
                      <div
                        key={sub.id}
                        className="rounded-2xl flex flex-col animate-fade-in transition-all duration-200 hover:translate-y-[-2px]"
                        style={{
                          background: "var(--bg-card)",
                          border: isRejected
                            ? "1.5px solid rgba(239,68,68,0.35)"
                            : "1.5px solid var(--border)",
                          boxShadow: isRejected
                            ? "0 4px 24px rgba(239,68,68,0.08), 0 1px 4px rgba(0,0,0,0.08)"
                            : "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
                          overflow: "hidden",
                        }}
                      >
                        {/* ── Card Header: Username + Avatar + Time ── */}
                        <div
                          className="flex items-center justify-between px-4 py-3"
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <Avatar name={sub.user_name} imageUrl={sub.user_avatar_url} size={8} />
                              {isMySubmission && (
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                  style={{ background: "var(--accent)", border: "1.5px solid var(--bg-card)" }}
                                >
                                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-[12px] font-extrabold truncate leading-tight"
                                style={{ color: "var(--fg)" }}
                              >
                                {sub.user_name}
                                {isMySubmission && (
                                  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>You</span>
                                )}
                              </p>
                              <p className="text-[10px]" style={{ color: "var(--fg-muted)" }}>
                                <TimeStr iso={sub.submitted_at} />
                              </p>
                            </div>
                          </div>

                          {/* Status Badge — top right of card header */}
                          <div className="shrink-0 ml-2">
                            {isRejected ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black"
                                style={{
                                  background: "rgba(239,68,68,0.12)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239,68,68,0.3)",
                                }}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Rejected
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black"
                                style={{
                                  background: "rgba(16,185,129,0.12)",
                                  color: "#10b981",
                                  border: "1px solid rgba(16,185,129,0.3)",
                                }}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Approved
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Card Body: Actual Proof Content ── */}
                        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                          {/* Proof type label */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                              style={{ background: "var(--bg-raised)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                            >
                              {proofIcon(arenaProofType)}
                              {arenaProofType} proof
                            </span>
                          </div>

                          {/* Inner proof panel */}
                          <div
                            className="rounded-xl overflow-hidden"
                            style={{
                              background: "var(--bg-raised)",
                              border: "1px solid var(--border)",
                              minHeight: 64,
                            }}
                          >
                            {isImageUrl(sub.proof_url) ? (
                              <button
                                type="button"
                                onClick={() => { setViewerImageUrl(sub.proof_url); setViewerZoom(1); }}
                                className="block w-full"
                              >
                                <img
                                  src={sub.proof_url}
                                  alt={`${sub.user_name}'s proof`}
                                  className="w-full max-h-64 object-cover transition hover:scale-[1.02] duration-300"
                                  loading="lazy"
                                />
                              </button>
                            ) : isHttpUrl(sub.proof_url) ? (
                              <a
                                href={sub.proof_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 px-4 py-3 group transition hover:bg-[var(--accent-light)]"
                              >
                                <div
                                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>External Link</p>
                                  <p className="text-[10px] truncate" style={{ color: "var(--fg-muted)" }}>{sub.proof_url}</p>
                                </div>
                                <svg className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--accent)" }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : (
                              <div className="px-4 py-3">
                                <p
                                  className="text-sm leading-relaxed"
                                  style={{ color: "var(--fg)", wordBreak: "break-word", whiteSpace: "pre-wrap" }}
                                >
                                  {sub.proof_url}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── Card Footer: Like / Dislike + Vote Progress ── */}
                        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                          {/* Vote buttons */}
                          <div className="flex items-center gap-2">
                            {/* Like button */}
                            <button
                              onClick={() => handleVoteSubmission(sub.id, "upvote")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
                              style={{
                                background: "rgba(16,185,129,0.10)",
                                color: "#10b981",
                                border: "1px solid rgba(16,185,129,0.25)",
                              }}
                              title="Approve this proof"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                              </svg>
                              <span>{upvotes}</span>
                            </button>

                            {/* Dislike button */}
                            <button
                              onClick={() => handleVoteSubmission(sub.id, "downvote")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
                              style={{
                                background: "rgba(239,68,68,0.08)",
                                color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.22)",
                              }}
                              title="Reject this proof"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                              </svg>
                              <span>{downvotes}</span>
                            </button>
                          </div>

                          {/* Vote progress bar + rejection threshold info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-medium" style={{ color: "var(--fg-subtle)" }}>
                                {upvotes + downvotes} votes
                              </span>
                              <span className="text-[9px] font-medium" style={{ color: isRejected ? "#ef4444" : "var(--fg-subtle)" }}>
                                {isRejected ? `Rejected (needs ≤${Math.floor(memberCount / 2)} dislikes)` : `Threshold: >${Math.floor(memberCount / 2)}`}
                              </span>
                            </div>
                            {/* Progress bar showing downvote ratio */}
                            {(upvotes + downvotes) > 0 && (
                              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.round((downvotes / (upvotes + downvotes)) * 100)}%`,
                                    background: isRejected
                                      ? "linear-gradient(90deg, #ef4444, #f87171)"
                                      : "linear-gradient(90deg, #10b981, #34d399)",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

              {/* Locked Arena Kudos Vault Card */}
              <div
                className="rounded-2xl p-4 border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-black space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Arena Locked Kudos Vault</h4>
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
                    <span className="font-mono font-black text-amber-400 text-sm">{arenaVaultKudos.toLocaleString()} Kudos</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-amber-500/20 bg-slate-900/60">
                    <span className="text-[10px] block font-semibold text-slate-400">21-Day Cycle Remaining</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">{kudosDaysRemaining} Days</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 italic">
                  🛡️ <strong>ACID Vault Lock:</strong> Missed daily cutoff penalties automatically transfer into this vault. Neither users nor admins can manually withdraw or transfer funds.
                </p>
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



      {/* ── REAL-TIME VOICE HUDDLE MODAL OVERLAY ── */}
      {showVoiceCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[#16181E]/90 border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-6">
            {/* Huddle Header */}
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Voice Huddle Live</span>
              </div>
              <h2 className="text-xl font-black text-white capitalize">{arenaName || "Arena Huddle"}</h2>
              <p className="text-xs font-mono text-white/60">{formatCallTime(callDuration)}</p>
            </div>

            {/* Participant Avatar Grid with Glowing Audio Pulse Rings */}
            <div className="grid grid-cols-2 gap-6 my-4 w-full px-4">
              {arenaMembers.slice(0, 4).map((member, idx) => (
                <div key={member.user_id || idx} className="flex flex-col items-center space-y-2">
                  <div className="relative">
                    <div className={`p-1 rounded-full ${idx === 0 ? "ring-4 ring-emerald-500/60 animate-pulse" : "ring-2 ring-white/10"}`}>
                      <Avatar name={member.user_name || member.full_name || "User"} imageUrl={member.user_avatar_url || undefined} size={14} />
                    </div>
                    {idx === 0 && (
                      <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black bg-emerald-500 text-black">
                        Speaking
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white/90 truncate max-w-[100px]">
                    {member.user_name || member.full_name || "Member"}
                  </span>
                </div>
              ))}
            </div>

            {/* Voice Control Buttons */}
            <div className="flex items-center justify-center gap-4 pt-2 w-full">
              {/* Mute Toggle */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-90 ${isMuted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white border border-white/10"
                  }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? "🎙️❌" : "🎙️"}
              </button>

              {/* Speaker Toggle */}
              <button
                type="button"
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-90 ${!isSpeakerOn ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white border border-white/10"
                  }`}
                title="Speaker Toggle"
              >
                {isSpeakerOn ? "🔊" : "🔇"}
              </button>

              {/* Hand Raise */}
              <button
                type="button"
                onClick={() => setIsHandRaised(!isHandRaised)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-90 ${isHandRaised ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-white/10 text-white border border-white/10"
                  }`}
                title="Raise Hand"
              >
                ✋
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={handleEndCall}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/50 active:scale-90 transition font-bold cursor-pointer"
                title="End Voice Huddle"
              >
                📞
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REAL-TIME HD VIDEO CALL STREAM OVERLAY (INSTAGRAM / WHATSAPP STYLE) ── */}
      {showVideoCallModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0c10] text-white animate-fade-in select-none">
          {/* Top Video Call Bar */}
          <div className="px-5 py-3 flex items-center justify-between glass border-b border-white/10 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <div>
                <h3 className="text-sm font-black tracking-tight capitalize flex items-center gap-2 text-white">
                  <span>📹 {arenaName || "Arena HD Video Call"}</span>
                </h3>
                <p className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
                  <span>● 720p HD Stream</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/80">{formatCallTime(callDuration)}</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleEndCall}
              className="px-4 py-1.5 rounded-full text-xs font-extrabold text-white bg-red-600 hover:bg-red-500 transition shadow-lg cursor-pointer flex items-center gap-1.5"
            >
              <span>📞 End Call</span>
            </button>
          </div>

          {/* Center Video Tiles Grid */}
          <div className="flex-1 p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto styled-scroll max-h-full">
            {/* Primary Tile: Current User Live WebCam Feed */}
            <div className="relative rounded-3xl overflow-hidden bg-[#16181E] border-2 border-emerald-500/50 shadow-2xl flex flex-col items-center justify-center min-h-[220px] group">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform scale-x-[-1] transition-all duration-300 ${isCamOn ? "opacity-100" : "opacity-0 absolute"
                  }`}
              />
              {!isCamOn && (
                <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
                  <Avatar name={arenaMembers.find(m => m.user_id === userId)?.user_name || "You"} imageUrl={arenaMembers.find(m => m.user_id === userId)?.user_avatar_url || undefined} size={16} />
                  <p className="text-xs font-extrabold text-white">Camera Off</p>
                </div>
              )}

              {/* User Label Badge */}
              <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>You ({arenaMembers.find(m => m.user_id === userId)?.user_name || "Member"})</span>
                {!isMicOn && <span className="text-red-400 ml-1">🎙️❌</span>}
              </div>
            </div>

            {/* Subscribed Arena Members Video Stream Tiles */}
            {arenaMembers
              .filter((m) => m.user_id !== userId)
              .slice(0, 3)
              .map((member, idx) => (
                <div
                  key={member.user_id || idx}
                  className="relative rounded-3xl overflow-hidden bg-[#16181E] border border-white/10 shadow-xl flex flex-col items-center justify-center min-h-[220px] group"
                >
                  <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
                    <div className="relative p-1 rounded-full ring-2 ring-emerald-400/80">
                      <Avatar name={member.user_name || member.full_name || "User"} imageUrl={member.user_avatar_url || undefined} size={16} />
                    </div>
                    <p className="text-xs font-extrabold text-white">
                      {member.user_name || member.full_name || "Member"}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Stream Connected
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                    <span>{member.user_name || member.full_name || "Member"}</span>
                  </div>
                </div>
              ))}
          </div>

          {/* Floating WhatsApp/Instagram Style Bottom Action Bar */}
          <div className="px-6 py-4 bg-[#12141A]/90 border-t border-white/10 backdrop-blur-xl flex items-center justify-center gap-4 shrink-0 shadow-2xl">
            {/* Mic Button */}
            <button
              type="button"
              onClick={toggleMicTrack}
              className={`w-13 h-13 rounded-2xl flex items-center justify-center text-lg transition active:scale-95 shadow-md cursor-pointer ${!isMicOn ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white border border-white/15 hover:bg-white/20"
                }`}
              title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
            >
              {isMicOn ? "🎙️" : "🎙️❌"}
            </button>

            {/* Camera Button */}
            <button
              type="button"
              onClick={toggleCameraTrack}
              className={`w-13 h-13 rounded-2xl flex items-center justify-center text-lg transition active:scale-95 shadow-md cursor-pointer ${!isCamOn ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white border border-white/15 hover:bg-white/20"
                }`}
              title={isCamOn ? "Turn Off Camera" : "Turn On Camera"}
            >
              {isCamOn ? "📹" : "📹❌"}
            </button>

            {/* Raise Hand Button */}
            <button
              type="button"
              onClick={() => setIsHandRaised(!isHandRaised)}
              className={`w-13 h-13 rounded-2xl flex items-center justify-center text-lg transition active:scale-95 shadow-md cursor-pointer ${isHandRaised ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-white/10 text-white border border-white/15 hover:bg-white/20"
                }`}
              title="Raise Hand"
            >
              ✋
            </button>

            {/* Red Pill End Call Button */}
            <button
              type="button"
              onClick={handleEndCall}
              className="w-16 h-13 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 transition font-black cursor-pointer text-xl"
              title="End Video Call"
            >
              📞
            </button>
          </div>
        </div>
      )}
      {/* Kudos Economy Wallet & Cashout Modal */}
      <KudosWalletModal
        isOpen={showKudosModal}
        onClose={() => setShowKudosModal(false)}
      />
    </div>
  );
}

