"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  Flame, Key, Target, Shield, X, Check, CheckCheck, Plus, Lock, Unlock, Bell, Zap, Coins, ExternalLink
} from "lucide-react";
import KudosWalletModal from "../../../components/KudosWalletModal";
import { initPushNotifications } from "../../utils/pushNotification";
import { useNotifications } from "../../context/NotificationContext";
import AudioMessagePlayer from "../../../components/AudioMessagePlayer";





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
  user_vote?: string | null;
  voters?: { user_id: number; user_name: string; user_avatar_url?: string | null }[];
  ai_confidence_score?: number;
  ai_status?: string;
  ai_audit_notes?: string;
}


interface Message {
  id: number;
  user_id: number;
  sender_name: string;
  sender_avatar_url?: string | null;
  content: string;
  message_type: string;
  created_at: string;
  is_read?: boolean;
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

const getDomainName = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "external-link";
  }
};

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
  { value: "11:00 PM", label: "11:00 PM", icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "11:59 PM", label: "11:59 PM (Midnight End)", icon: <Clock className="w-3.5 h-3.5" /> },
];

const isSubmissionVotingExpired = (submittedAtIso: string, deadlineStr: string): boolean => {
  if (!submittedAtIso) return false;
  try {
    const subDate = new Date(submittedAtIso);
    if (isNaN(subDate.getTime())) return false;

    const match = (deadlineStr || "05:00 AM").match(/(\d+):(\d+)\s*(AM|PM)?/i);
    let hours = match ? parseInt(match[1], 10) : 5;
    const minutes = match ? parseInt(match[2], 10) : 0;
    const ampm = match && match[3] ? match[3].toUpperCase() : null;

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    const cutoff = new Date(subDate);
    cutoff.setHours(hours, minutes, 0, 0);

    if (subDate > cutoff) {
      cutoff.setDate(cutoff.getDate() + 1);
    }

    return new Date() > cutoff;
  } catch (e) {
    return false;
  }
};

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

function parseIsoToLocalDate(iso: string | Date | undefined): Date {
  if (!iso) return new Date();
  if (iso instanceof Date) return iso;
  let str = String(iso).trim();
  if (str.includes(" ") && !str.includes("T")) {
    str = str.replace(" ", "T");
  }
  if (!str.endsWith("Z") && !str.includes("+") && !str.match(/[-+]\d{2}:\d{2}$/)) {
    str += "Z";
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}


function isSameDay(iso1: string | Date, iso2: string | Date): boolean {
  if (!iso1 || !iso2) return false;
  const d1 = parseIsoToLocalDate(iso1);
  const d2 = parseIsoToLocalDate(iso2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatDateHeader(iso: string | Date | undefined): string {
  const d = parseIsoToLocalDate(iso);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (targetDay.getTime() === today.getTime()) {
    return "Today";
  }
  if (targetDay.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateLabel(iso: string): string {
  if (!iso) return "";
  return formatDateHeader(iso);
}

function TimeOnlyStr({ iso }: { iso: string }) {
  if (!iso) return null;
  const d = parseIsoToLocalDate(iso);
  return (
    <span>
      {d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}
    </span>
  );
}

function TimeStr({ iso }: { iso: string }) {
  if (!iso) return null;
  const d = parseIsoToLocalDate(iso);
  const dateStr = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("en-US", {
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




// Dedicated resilient audio element for remote streams — ensures unthrottled background playback
function RemoteAudioElement({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.muted = false;
    el.volume = 1.0;
    
    // Play with automatic retry on mobile / browser gesture restrictions
    const attemptPlay = () => {
      if (!el) return;
      el.play().catch(() => {
        const resumeOnInteraction = () => {
          el?.play().catch(() => {});
          window.removeEventListener("click", resumeOnInteraction);
          window.removeEventListener("touchstart", resumeOnInteraction);
        };
        window.addEventListener("click", resumeOnInteraction, { once: true });
        window.addEventListener("touchstart", resumeOnInteraction, { once: true });
      });
    };

    attemptPlay();

    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      style={{
        position: "fixed",
        top: -9999,
        left: -9999,
        width: "1px",
        height: "1px",
        opacity: 0.001,
        pointerEvents: "none",
      }}
    />
  );
}

function RemoteMediaElement({ stream, isVideo }: { stream: MediaStream; isVideo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play().catch(() => {});
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-cover rounded-3xl"
      />
    );
  }
  // For audio-only calls use the dedicated audio element component
  return <RemoteAudioElement stream={stream} />;
}

function AnalogAudioSignalIndicator({
  isSpeaking,
  volumeLevel = 0,
  isMuted,
}: {
  isSpeaking: boolean;
  volumeLevel?: number;
  isMuted?: boolean;
}) {
  if (isMuted) {
    return (
      <div className="flex items-center gap-1 text-slate-400 text-[10px] font-mono select-none">
        <span className="opacity-40">••</span>
        <span className="text-red-400 text-xs font-bold">🎙️❌</span>
        <span className="opacity-40">••</span>
      </div>
    );
  }

  if (isSpeaking || volumeLevel > 5) {
    // Dynamic height calculation based on real volume Level (0 to 100)
    const vol = Math.max(volumeLevel, isSpeaking ? 30 : 0);
    const h1 = Math.min(100, Math.max(20, vol * 0.5));
    const h2 = Math.min(100, Math.max(30, vol * 0.85));
    const h3 = Math.min(100, Math.max(40, vol * 1.2));
    const h4 = Math.min(100, Math.max(35, vol * 1.0));
    const h5 = Math.min(100, Math.max(25, vol * 0.75));
    const h6 = Math.min(100, Math.max(30, vol * 0.9));
    const h7 = Math.min(100, Math.max(20, vol * 0.45));

    return (
      <div className="flex items-end gap-0.5 h-6 px-1 select-none">
        <span style={{ height: `${h1}%` }} className="w-1 bg-amber-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        <span style={{ height: `${h2}%` }} className="w-1 bg-amber-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        <span style={{ height: `${h3}%` }} className="w-1 bg-amber-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        <span style={{ height: `${h4}%` }} className="w-1 bg-amber-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        <span style={{ height: `${h5}%` }} className="w-1 bg-amber-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        <span style={{ height: `${h6}%` }} className="w-1 bg-amber-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        <span style={{ height: `${h7}%` }} className="w-1 bg-amber-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 text-slate-500/50 text-[10px] tracking-tighter font-mono select-none">
      ••••••••••
    </div>
  );
}




export default function ArenaRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, toast } = useToast();

  // WebRTC Peer-to-Peer Real-Time Stream Engine
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const [remoteStreamsMap, setRemoteStreamsMap] = useState<{ [uid: number]: MediaStream }>({});
  const [speakingMap, setSpeakingMap] = useState<{ [uid: number]: boolean }>({});
  const [volumeMap, setVolumeMap] = useState<{ [uid: number]: number }>({});
  const [muteMap, setMuteMap] = useState<{ [uid: number]: boolean }>({});
  const [handMap, setHandMap] = useState<{ [uid: number]: boolean }>({});

  // ─── CRITICAL FIX: always read current userId via ref, NOT stale closure state ───
  const userIdRef = useRef<number | null>(null);
  const getSelfId = (): number | null => {
    if (userIdRef.current) return userIdRef.current;
    const stored = localStorage.getItem("tribely_user_id");
    return stored ? Number(stored) : null;
  };




  const getOrCreatePeerConnection = (remoteUserId: number): RTCPeerConnection => {
    if (peerConnectionsRef.current.has(remoteUserId)) {
      return peerConnectionsRef.current.get(remoteUserId)!;
    }

    const selfId = getSelfId();

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            event_type: "webrtc_signal",
            target_user_id: remoteUserId,
            sender_user_id: selfId,
            candidate: event.candidate,
            arena_id: Number(id),
          })
        );
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreamsMap((prev) => {
        const existing = prev[remoteUserId];
        let stream: MediaStream;
        if (existing) {
          existing.addTrack(event.track);
          stream = new MediaStream(existing.getTracks());
        } else if (event.streams && event.streams[0]) {
          stream = event.streams[0];
        } else {
          stream = new MediaStream([event.track]);
        }
        return { ...prev, [remoteUserId]: stream };
      });
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        peerConnectionsRef.current.delete(remoteUserId);
        setRemoteStreamsMap((prev) => {
          const next = { ...prev };
          delete next[remoteUserId];
          return next;
        });
      }
    };

    // Attach existing local tracks right away
    if (localStreamRef.current) {
      const senders = pc.getSenders();
      localStreamRef.current.getTracks().forEach((track) => {
        const exists = senders.some((s) => s.track?.kind === track.kind);
        if (!exists) pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionsRef.current.set(remoteUserId, pc);
    return pc;
  };

  // Point-to-point SDP offer to one remote peer
  const sendWebRTCOffer = async (remoteUserId: number) => {
    const selfId = getSelfId();
    if (!localStreamRef.current || !selfId) return;
    const pc = getOrCreatePeerConnection(remoteUserId);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            event_type: "webrtc_signal",
            target_user_id: remoteUserId,
            sender_user_id: selfId,
            sdp: offer,
            arena_id: Number(id),
          })
        );
      }
    } catch (e) {
      console.error("sendWebRTCOffer error:", e);
    }
  };

  const startLocalMediaStream = async (isVideo: boolean): Promise<void> => {
    try {
      // Stop any prior stream to avoid duplicate tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });

      localStreamRef.current = stream;

      if (isVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Re-sync tracks to any existing peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
          }
        });
      });
    } catch (e: any) {
      console.error("❌ Failed to access local media devices:", e);
      throw e;
    }
  };

  const stopLocalMediaStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteStreamsMap({});
    setSpeakingMap({});
    setVolumeMap({});
    setMuteMap({});
    setHandMap({});
    setIsMuted(false);
    setIsHandRaised(false);
  };


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
  const [showLogBookModal, setShowLogBookModal] = useState(false);

  // Voters Modal States (Anonymous Peer Reviewers)
  const [showVotersModal, setShowVotersModal] = useState(false);
  const [votersList, setVotersList] = useState<{ user_id: number; user_name: string; user_avatar_url?: string | null }[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  const openVotersModal = async (sub: Submission) => {
    // 1. Show local voters immediately (0ms delay)
    setVotersList(sub.voters || []);
    setShowVotersModal(true);

    // 2. Fetch complete voters list across all accounts from backend
    try {
      if (!sub.voters || sub.voters.length === 0) setLoadingVoters(true);
      const res = await api.get(`/api/activity/submission/${sub.id}/voters`);
      const backendVoters = res.data?.data?.voters;
      if (Array.isArray(backendVoters)) {
        setVotersList(backendVoters);
        setSubmissions((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, voters: backendVoters } : s))
        );
      }
    } catch (err) {
      console.error("Voters list fetch warning:", err);
    } finally {
      setLoadingVoters(false);
    }
  };





  // Kudos Ecosystem States
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [userKudosBalance, setUserKudosBalance] = useState<number | null>(null);
  const [arenaVaultKudos, setArenaVaultKudos] = useState<number>(0);
  const [kudosDaysRemaining, setKudosDaysRemaining] = useState<number>(21);
  const [arenaVaultTransactions, setArenaVaultTransactions] = useState<any[]>([]);
  const [arenaLeaderboard, setArenaLeaderboard] = useState<any[]>([]);

  // Fetch Kudos User Balance & Arena Vault Metrics
  const fetchKudosData = async () => {
    try {
      const [walletRes, vaultRes] = await Promise.all([
        api.get("/api/kudos/wallet"),
        api.get(`/api/kudos/arena/${id}/vault`)
      ]);

      if (walletRes.data?.data?.kudos_balance !== undefined) {
        setUserKudosBalance(walletRes.data.data.kudos_balance);
      }

      if (vaultRes.data?.data) {
        const d = vaultRes.data.data;
        setArenaVaultKudos(d.kudos_reserve_vault ?? 0);
        setKudosDaysRemaining(d.cycle_days_remaining ?? 21);
        if (d.recent_transactions && Array.isArray(d.recent_transactions)) {
          setArenaVaultTransactions(d.recent_transactions);
        }
        if (d.leaderboard && Array.isArray(d.leaderboard)) {
          setArenaLeaderboard(d.leaderboard);
        }
      }
    } catch (e) {
      console.error("Error fetching Kudos data:", e);
    }
  };

  const handleDistributeRewards = async () => {
    try {
      const res = await api.post(`/api/kudos/arena/${id}/distribute-21-days`);
      if (res.data?.status === "success") {
        toast.success(res.data.data.message || "21-Day Vault Rewards distributed successfully!");
        fetchKudosData();
      } else {
        toast.error(res.data?.detail || "Distribution failed");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed distributing vault rewards");
    }
  };

  // Consume global real-time WhatsApp notification context
  const { unreadCounts, markArenaRead } = useNotifications();

  const handleRingMember = (targetMember: ArenaMember) => {
    const memberName = targetMember.user_name || targetMember.full_name || `Member #${targetMember.user_id}`;
    const callerName = localStorage.getItem("tribely_user_name") || "A member";
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "call_ring_user",
          target_user_id: targetMember.user_id,
          caller_name: callerName,
          call_type: activeCallState?.call_type || "video",
        })
      );
      toast.success(`🔔 Ringing ${memberName}...`);
    } else {
      toast.info(`Ringing alert sent to ${memberName}!`);
    }
  };



  useEffect(() => {
    if (id) {
      fetchKudosData();
      markArenaRead(Number(id));
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
    // Only manage the call duration timer here.
    let timer: any;
    if (showVoiceCallModal || showVideoCallModal) {
      timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showVoiceCallModal, showVideoCallModal]);

  // Keep local video element srcObject attached whenever video call modal mounts or camera toggles
  useEffect(() => {
    if (showVideoCallModal && localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [showVideoCallModal, isCamOn]);


  // Real-Time Audio Spectrum Analyser for Local Microphone Waveform
  useEffect(() => {

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let animId: number;

    if (localStreamRef.current && (showVoiceCallModal || showVideoCallModal)) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(localStreamRef.current);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVolume = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const isUserSpeaking = avg > 12 && isMicOn && !isMuted;
          const volumeLevel = isUserSpeaking ? Math.min(100, Math.round((avg / 120) * 100)) : 0;

          if (userId) {
            setSpeakingMap((prev) => {
              if (prev[userId] === isUserSpeaking) return prev;
              return { ...prev, [userId]: isUserSpeaking };
            });
            setVolumeMap((prev) => ({ ...prev, [userId]: volumeLevel }));
          }

          animId = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (e) {
        /* ignore */
      }
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx) audioCtx.close();
    };
  }, [showVoiceCallModal, showVideoCallModal, isMicOn, isMuted, userId]);

  // Real-Time Audio Spectrum Analyser for Remote Streams
  useEffect(() => {
    const audioContexts: AudioContext[] = [];
    const animIds: number[] = [];

    Object.entries(remoteStreamsMap).forEach(([remoteIdStr, stream]) => {
      const remoteId = Number(remoteIdStr);
      if (!stream || stream.getAudioTracks().length === 0) return;

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        audioContexts.push(ctx);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkRemoteVol = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const isSpeaking = avg > 10;
          const volumeLevel = isSpeaking ? Math.min(100, Math.round((avg / 120) * 100)) : 0;

          setSpeakingMap((prev) => {
            if (prev[remoteId] === isSpeaking) return prev;
            return { ...prev, [remoteId]: isSpeaking };
          });
          setVolumeMap((prev) => ({ ...prev, [remoteId]: volumeLevel }));

          const aid = requestAnimationFrame(checkRemoteVol);
          animIds.push(aid);
        };
        checkRemoteVol();
      } catch (e) {
        /* ignore */
      }
    });

    return () => {
      animIds.forEach((aid) => cancelAnimationFrame(aid));
      audioContexts.forEach((ctx) => ctx.close());
    };
  }, [remoteStreamsMap]);



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
    active?: boolean;
    status?: string;
    call_type: "audio" | "video";
    caller_name: string;
    caller_id?: number;
    host_id?: number;
    participants?: number[];
    participants_info?: any[];
  } | null>(null);

  const isCallSessionLive = (callObj: any) => {
    if (!callObj) return false;
    return Boolean(callObj.active === true || callObj.status === "IN_CALL" || callObj.status === "RINGING");
  };

  const handleStartVoiceCall = async () => {
    const selfId = getSelfId();
    if (!selfId) return;

    const callerName = arenaMembers.find((m) => m.user_id === selfId)?.user_name || "A member";

    // Step 1: Capture local microphone FIRST (must be before any WebRTC signaling)
    try {
      await startLocalMediaStream(false);
    } catch {
      toast.error("❌ Could not access microphone. Please check permissions.");
      return;
    }

    // Step 2: Show call modal UI
    setShowVoiceCallModal(true);
    setCallDuration(0);

    // Step 3: Send INITIATE_CALL (if no active call) or JOIN_CALL (if ongoing call)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const eventType = isCallSessionLive(activeCallState) ? "JOIN_CALL" : "INITIATE_CALL";
      if (eventType === "JOIN_CALL") {
        toast.info("📞 Joining ongoing Voice Huddle!");
      }
      wsRef.current.send(
        JSON.stringify({
          event_type: eventType,
          call_type: "audio",
          caller_name: callerName,
          caller_id: selfId,
          sender_user_id: selfId,
          arena_id: Number(id),
        })
      );
    }
  };

  const handleStartVideoCall = async () => {
    const selfId = getSelfId();
    if (!selfId) return;

    const callerName = arenaMembers.find((m) => m.user_id === selfId)?.user_name || "A member";

    try {
      await startLocalMediaStream(true);
    } catch {
      toast.error("❌ Could not access camera/microphone. Please check permissions.");
      return;
    }

    setShowVideoCallModal(true);
    setCallDuration(0);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const eventType = isCallSessionLive(activeCallState) ? "JOIN_CALL" : "INITIATE_CALL";
      wsRef.current.send(
        JSON.stringify({
          event_type: eventType,
          call_type: "video",
          caller_name: callerName,
          caller_id: selfId,
          sender_user_id: selfId,
          arena_id: Number(id),
        })
      );
    }
  };

  // Ensure refreshing or loading the page NEVER auto-starts or auto-joins a call
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("action=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      url.searchParams.delete("call_type");
      const newSearch = url.searchParams.toString();
      const newUrl = url.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);


  const handleEndCall = async () => {
    setShowVoiceCallModal(false);
    setShowVideoCallModal(false);
    stopLocalMediaStream();

    const selfId = getSelfId();
    const callerName = arenaMembers.find((m) => m.user_id === selfId)?.user_name || "A member";
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "LEAVE_CALL",
          caller_name: callerName,
          sender_user_id: selfId,
          arena_id: Number(id),
        })
      );
    }
  };

  const handleForceEndCall = async () => {
    setShowVoiceCallModal(false);
    setShowVideoCallModal(false);
    stopLocalMediaStream();

    const selfId = getSelfId();
    const callerName = arenaMembers.find((m) => m.user_id === selfId)?.user_name || "Host";
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "FORCE_END_CALL",
          caller_name: callerName,
          sender_user_id: selfId,
          arena_id: Number(id),
        })
      );
    }
  };

  const toggleLocalMute = () => {
    const next = !isMuted;
    setIsMuted(next);

    // Physically enable/disable local audio media tracks so audio bytes stop/start
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }

    const selfId = getSelfId();
    if (selfId) {
      setMuteMap((prev) => ({ ...prev, [selfId]: next }));
    }

    // Broadcast TOGGLE_MUTE via WebSocket to all arena members in real-time
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selfId) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "TOGGLE_MUTE",
          is_muted: next,
          sender_user_id: selfId,
          arena_id: Number(id),
        })
      );
    }
  };

  const toggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);

    const selfId = getSelfId();
    if (selfId) {
      setHandMap((prev) => ({ ...prev, [selfId]: next }));
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selfId) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "TOGGLE_HAND",
          is_hand_raised: next,
          sender_user_id: selfId,
          arena_id: Number(id),
        })
      );
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
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const handleStartVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      showToast("Microphone access denied or unavailable.", "error");
    }
  };

  const handleCancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const handleSendVoiceRecording = async () => {
    if (!mediaRecorderRef.current) return;
    setIsUploadingMedia(true);
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      recorder.stream.getTracks().forEach((t) => t.stop());

      // Optimistic Voice Note in Chat Feed (0ms delay)
      const currentStoredUserId = typeof window !== "undefined" ? Number(localStorage.getItem("tribely_user_id")) : 0;
      const tempId = `temp_audio_${Date.now()}`;
      const localAudioUrl = URL.createObjectURL(audioBlob);
      const optimisticVoiceMsg: Message = {
        id: tempId as any,
        user_id: currentStoredUserId || userId || 0,
        sender_name: typeof window !== "undefined" ? localStorage.getItem("tribely_user_name") || "You" : "You",
        sender_avatar_url: typeof window !== "undefined" ? localStorage.getItem("tribely_user_avatar") || null : null,
        content: localAudioUrl,
        message_type: "audio",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [optimisticVoiceMsg, ...prev]);

      try {
        const formData = new FormData();
        formData.append("file", audioBlob, `voice_note_${Date.now()}.webm`);

        const uploadRes = await api.post("/upload/file", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const audioUrl = uploadRes.data?.url;
        if (audioUrl) {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ content: audioUrl, message_type: "audio", temp_id: tempId })
            );
          } else {
            const res = await api.post(`/api/activity/arena/${id}/message`, {
              content: audioUrl,
              message_type: "audio",
            });
            const returnedMsg = res.data?.data;
            if (returnedMsg) {
              setMessages((prev) => [returnedMsg, ...prev.filter((m) => String(m.id) !== String(tempId))]);
            }
          }
        }
      } catch (err) {
        console.error("Voice note upload error:", err);
        showToast("Failed to send voice note.", "error");
      } finally {
        setIsUploadingMedia(false);
        setIsRecordingAudio(false);
        setRecordingSeconds(0);
        audioChunksRef.current = [];
      }
    };

    recorder.stop();
  };

  const handleSelectChatImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    const tempId = `temp_img_${Date.now()}`;
    const localImgUrl = URL.createObjectURL(file);

    // Optimistic Image in Chat Feed (0ms delay)
    const currentStoredUserId = typeof window !== "undefined" ? Number(localStorage.getItem("tribely_user_id")) : 0;
    const optimisticImgMsg: Message = {
      id: tempId as any,
      user_id: currentStoredUserId || userId || 0,
      sender_name: typeof window !== "undefined" ? localStorage.getItem("tribely_user_name") || "You" : "You",
      sender_avatar_url: typeof window !== "undefined" ? localStorage.getItem("tribely_user_avatar") || null : null,
      content: localImgUrl,
      message_type: "image",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticImgMsg, ...prev]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await api.post("/upload/file", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const imageUrl = uploadRes.data?.url;
      if (imageUrl) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ content: imageUrl, message_type: "image", temp_id: tempId })
          );
        } else {
          const res = await api.post(`/api/activity/arena/${id}/message`, {
            content: imageUrl,
            message_type: "image",
          });
          const returnedMsg = res.data?.data;
          if (returnedMsg) {
            setMessages((prev) => [returnedMsg, ...prev.filter((m) => String(m.id) !== String(tempId))]);
          }
        }
      }
    } catch (err) {
      console.error("Chat image upload error:", err);
      showToast("Failed to upload image.", "error");
    } finally {
      setIsUploadingMedia(false);
      if (chatImageInputRef.current) chatImageInputRef.current.value = "";
    }
  };


  const toggleCameraTrack = () => {
    const next = !isCamOn;
    setIsCamOn(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = next));
    }
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
      const res: any = await api.get(`/api/activity/arena/${id}/history`);
      const payload = res?.data?.data !== undefined ? res.data.data : res?.data !== undefined ? res.data : res;
      if (payload) {
        if (Array.isArray(payload.submissions))
          setSubmissions(payload.submissions);
        if (Array.isArray(payload.messages)) {
          setMessages(payload.messages);
          dataCache.set(`/api/activity/arena/${id}/history`, payload);
        }
        if (payload.active_call && (payload.active_call.active || payload.active_call.status === "IN_CALL" || payload.active_call.status === "RINGING")) {
          setActiveCallState(payload.active_call);
        } else {
          setActiveCallState(null);
        }
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
    if (localUserId) {
      setUserId(Number(localUserId));
      userIdRef.current = Number(localUserId); // Keep ref in sync for WS/WebRTC closures
    }

    // Zero-delay instant cache pre-hydration (only if cache actually has items)
    const cachedHistory = dataCache.get(`/api/activity/arena/${id}/history`);
    if (cachedHistory) {
      const data = cachedHistory.data || cachedHistory;
      if (Array.isArray(data.submissions) && data.submissions.length > 0) setSubmissions(data.submissions);
      if (Array.isArray(data.messages) && data.messages.length > 0) setMessages(data.messages);
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
    let pingInterval: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      if (!isMounted) return;
      const wsBase = getWsBaseUrl();
      const wsUrl = `${wsBase}/ws/arena/${id}`;
      const wsToken = localStorage.getItem("tribely_token");
      const ws = new WebSocket(
        wsToken ? `${wsUrl}?token=${encodeURIComponent(wsToken)}` : wsUrl,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        // Re-sync message history on connect / reconnect
        fetchHistory();
      };

      // Heartbeat Keep-Alive (every 25s) to prevent cloud reverse proxy disconnection
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event_type: "ping", timestamp: Date.now() }));
        }
      }, 25000);

      ws.onmessage = (event) => {
        try {
          const liveData = JSON.parse(event.data);
          const eventType = liveData?.event_type || liveData?.type;

          // Ignore keep-alive pong responses
          if (eventType === "pong") return;

          // Real-time Chat Message Event Handler
          if (eventType === "chat_message" || (liveData?.content && liveData?.sender_name && !eventType?.includes("call") && !eventType?.includes("request") && !eventType?.includes("member"))) {
            const incomingMsg: Message = {
              id: liveData.id || Date.now(),
              user_id: Number(liveData.user_id),
              sender_name: liveData.sender_name || `Member #${liveData.user_id}`,
              sender_avatar_url: liveData.sender_avatar_url || null,
              content: String(liveData.content || liveData.text || ""),
              message_type: String(liveData.message_type || "text"),
              created_at: liveData.created_at || new Date().toISOString(),
            };
            setMessages((prev) => {
              const liveTempId = liveData.temp_id || liveData.client_id;
              
              // 1. Exact ID check: if server ID already exists, skip
              if (prev.some((m) => m.id === incomingMsg.id)) {
                return prev;
              }

              // 2. Temp ID replacement: replace optimistic item with real server message
              if (liveTempId) {
                const tempIndex = prev.findIndex((m) => String(m.id) === String(liveTempId));
                if (tempIndex !== -1) {
                  const updated = [...prev];
                  updated[tempIndex] = incomingMsg;
                  return updated;
                }
              }

              // 3. Optimistic self-message fallback deduplication (same user, same content, temporary item)
              const selfTempIndex = prev.findIndex((m) => 
                (String(m.id).startsWith("temp_") || typeof m.id === "string") &&
                m.user_id === incomingMsg.user_id &&
                m.content.trim() === incomingMsg.content.trim()
              );
              if (selfTempIndex !== -1) {
                const updated = [...prev];
                updated[selfTempIndex] = incomingMsg;
                return updated;
              }

              // 4. Genuine new message from any member -> prepend to newest list
              return [incomingMsg, ...prev];
            });
            return;
          }

          // Real-time WhatsApp-style Read Receipt Event Handler
          if (eventType === "READ_RECEIPT" || eventType === "read_receipt") {
            const readerId = Number(liveData.reader_user_id);
            const lastReadId = Number(liveData.last_read_msg_id);
            setMessages((prev) =>
              prev.map((msg) => {
                if (readerId !== msg.user_id && (lastReadId ? msg.id <= lastReadId : true)) {
                  return { ...msg, is_read: true };
                }
                return msg;
              })
            );
            return;
          }

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


          // ── INCOMING_CALL: Someone started a new call — notify non-starters & log to chat ──
          if (liveData?.event_type === "INCOMING_CALL") {
            const callerName = liveData.caller_name || liveData.active_call?.caller_name || "A member";
            const callType = liveData.call_type || liveData.active_call?.call_type || "audio";
            const selfId = getSelfId();
            const callerId = Number(liveData.caller_id || liveData.active_call?.caller_id);

            // Set global call state for all arena members
            if (liveData.active_call) {
              setActiveCallState(liveData.active_call);
            } else {
              setActiveCallState({ active: true, call_type: callType, caller_name: callerName, caller_id: callerId });
            }

            // Real-time Call Log in Chat Feed (0ms delay)
            const callMsg: Message = {
              id: `call_${Date.now()}` as any,
              user_id: callerId,
              sender_name: callerName,
              sender_avatar_url: null,
              content: `${callType === "video" ? "📹 Video Call" : "📞 Voice Huddle"} started by ${callerName}! Tap to join.`,
              message_type: "call_invite",
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => {
              const alreadyHas = prev.some((m) => m.message_type === "call_invite" && Date.now() - new Date(m.created_at).getTime() < 10000);
              return alreadyHas ? prev : [callMsg, ...prev];
            });

            // If I'm not the starter, show toast to invite me to join
            if (selfId !== callerId) {
              const callEmoji = callType === "video" ? "📹" : "📞";
              const callLabel = callType === "video" ? "Video Call" : "Voice Huddle";
              toast.info(`${callEmoji} ${callerName} started a ${callLabel}! Tap the ${callEmoji} icon to join.`);
            }
            return;
          }

          // ── USER_JOINED: A new member joined the call — existing members each send an offer ──
          if (liveData?.event_type === "USER_JOINED") {
            if (liveData.active_call) setActiveCallState(liveData.active_call);

            const selfId = getSelfId();
            const joinerId = Number(liveData.sender_user_id || liveData.caller_id);

            // Each already-in-call member sends an individual offer to the new joiner
            if (joinerId && selfId && joinerId !== selfId && localStreamRef.current) {
              // Small delay so joiner's peer connection is ready to receive offers
              setTimeout(() => sendWebRTCOffer(joinerId), 300);
            }
            return;
          }

          // ── USER_LEFT: A member left the call ──
          if (liveData?.event_type === "USER_LEFT") {
            if (liveData.active_call) setActiveCallState(liveData.active_call);
            const leftId = Number(liveData.sender_user_id || liveData.caller_id);
            if (leftId) {
              setMuteMap((prev) => {
                const n = { ...prev };
                delete n[leftId];
                return n;
              });
            }
            return;
          }

          // ── MUTE_UPDATED: Real-Time Mute Synchronization ──
          if (liveData?.event_type === "MUTE_UPDATED") {
            const senderId = Number(liveData.sender_user_id || liveData.caller_id);
            const isMutedVal = Boolean(liveData.is_muted);
            if (senderId) {
              setMuteMap((prev) => ({ ...prev, [senderId]: isMutedVal }));
            }
            if (liveData.active_call) {
              setActiveCallState(liveData.active_call);
            }
            return;
          }

          // ── HAND_UPDATED: Real-Time Hand Raise Synchronization ──
          if (liveData?.event_type === "HAND_UPDATED") {
            const senderId = Number(liveData.sender_user_id || liveData.caller_id);
            const isHandVal = Boolean(liveData.is_hand_raised);
            if (senderId) {
              setHandMap((prev) => ({ ...prev, [senderId]: isHandVal }));
            }
            if (liveData.active_call) {
              setActiveCallState(liveData.active_call);
            }
            return;
          }

          // ── CALL_ENDED: Call has been fully ended ──
          if (liveData?.event_type === "CALL_ENDED") {
            setActiveCallState(null);
            setShowVoiceCallModal(false);
            setShowVideoCallModal(false);
            stopLocalMediaStream();
            toast.info("📞 The call has ended.");
            return;
          }

          // ── webrtc_signal: Point-to-point SDP / ICE relay ──
          if (liveData?.event_type === "webrtc_signal") {
            const selfId = getSelfId();
            const targetId = Number(liveData.target_user_id);
            const senderId = Number(liveData.sender_user_id);

            if (selfId && targetId === selfId && senderId) {
              const pc = getOrCreatePeerConnection(senderId);

              if (liveData.sdp) {
                pc.setRemoteDescription(new RTCSessionDescription(liveData.sdp))
                  .then(async () => {
                    if (liveData.sdp.type === "offer") {
                      // Attach local audio/video tracks before creating answer so peer receives audio
                      if (localStreamRef.current) {
                        const senders = pc.getSenders();
                        localStreamRef.current.getTracks().forEach((track) => {
                          const exists = senders.some((s) => s.track?.kind === track.kind);
                          if (!exists) pc.addTrack(track, localStreamRef.current!);
                        });
                      }
                      const answer = await pc.createAnswer();
                      await pc.setLocalDescription(answer);
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                          JSON.stringify({
                            event_type: "webrtc_signal",
                            target_user_id: senderId,
                            sender_user_id: selfId,
                            sdp: answer,
                            arena_id: Number(id),
                          })
                        );
                      }
                    }
                  })
                  .catch((err) => console.error("setRemoteDescription error:", err));
              } else if (liveData.candidate) {
                pc.addIceCandidate(new RTCIceCandidate(liveData.candidate)).catch((candErr) => {
                  console.warn("addIceCandidate warning:", candErr);
                });
              }
            }
            return;
          }



          // Real-time Unread Badge & Counter Handler handled by global NotificationContext
          if (liveData?.event_type === "unread_update" || liveData?.event_type === "unread_cleared") {
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
      if (pingInterval) clearInterval(pingInterval);
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
    const normRequested = voteType === "upvote" ? "up" : "down";
    
    try {
      // Optimistic UI update with single vote & toggle-off protection
      setSubmissions((prev) =>
        prev.map((sub) => {
          if (sub.id !== submissionId) return sub;
          let curUp = sub.upvotes || 0;
          let curDown = sub.downvotes || 0;
          let newVote: string | null = normRequested;

          if (sub.user_vote === normRequested) {
            // Un-vote / toggle off
            newVote = null;
            if (normRequested === "up") curUp = Math.max(0, curUp - 1);
            else curDown = Math.max(0, curDown - 1);
          } else if (sub.user_vote) {
            // Switch vote choice
            if (normRequested === "up") {
              curUp += 1;
              curDown = Math.max(0, curDown - 1);
            } else {
              curDown += 1;
              curUp = Math.max(0, curUp - 1);
            }
          } else {
            // New vote
            if (normRequested === "up") curUp += 1;
            else curDown += 1;
          }

          const myVoterObj = userId ? {
            user_id: userId,
            user_name: localStorage.getItem("tribely_user_name") || `Member #${userId}`,
            user_avatar_url: localStorage.getItem("tribely_user_avatar") || null,
          } : null;

          let updatedVoters = sub.voters ? [...sub.voters] : [];
          if (newVote && myVoterObj) {
            if (!updatedVoters.some(v => v.user_id === userId)) {
              updatedVoters.push(myVoterObj);
            }
          } else if (!newVote && userId) {
            updatedVoters = updatedVoters.filter(v => v.user_id !== userId);
          }

          return {
            ...sub,
            upvotes: curUp,
            downvotes: curDown,
            user_vote: newVote,
            voters: updatedVoters,
          };
        })
      );

      const res = await api.post(`/api/activity/submission/${submissionId}/vote`, {
        vote_type: voteType,
      });

      if (res.data?.data) {
        const d = res.data.data;
        setSubmissions((prev) =>
          prev.map((sub) => {
            if (sub.id !== submissionId) return sub;
            return {
              ...sub,
              upvotes: d.upvotes ?? sub.upvotes,
              downvotes: d.downvotes ?? sub.downvotes,
              user_vote: d.user_vote !== undefined ? d.user_vote : sub.user_vote,
              is_absent: d.is_absent ?? sub.is_absent,
            };
          })
        );
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = typeof detail === "string" ? detail : detail?.message || "Voting window closed for this cycle.";
      if (msg.includes("offset-naive") || msg.includes("500") || msg.includes("Vote operation failed:")) {
        msg = "Voting for this submission cycle has expired.";
      }
      toast.warning(msg);
      fetchHistory();
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = chatInput.trim();
    if (!messageText) return;

    setChatInput("");

    // Optimistic UI Hydration (0ms Instant Rendering)
    const currentStoredUserId = typeof window !== "undefined" ? Number(localStorage.getItem("tribely_user_id")) : 0;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMsg: Message = {
      id: tempId as any,
      user_id: currentStoredUserId || userId || 0,
      sender_name: typeof window !== "undefined" ? localStorage.getItem("tribely_user_name") || "You" : "You",
      sender_avatar_url: typeof window !== "undefined" ? localStorage.getItem("tribely_user_avatar") || null : null,
      content: messageText,
      message_type: "text",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [optimisticMsg, ...prev]);

    // 1. Send over active WebSocket connection if available & connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({ content: messageText, message_type: "text", temp_id: tempId, client_id: tempId }),
        );
        return;
      } catch (err) {
        console.warn("WebSocket send failed, executing HTTP fallback", err);
      }
    }

    // 2. Fallback to HTTP POST if WebSocket is disconnected or send failed
    try {
      const res: any = await api.post(`/api/activity/arena/${id}/message`, {
        content: messageText,
        message_type: "text",
      });
      const returnedMsg = res?.data?.data || res?.data || res;
      if (returnedMsg) {
        setMessages((prev) => {
          // Replace temp message with server message
          const filtered = prev.filter((m) => String(m.id) !== String(tempId));
          if (returnedMsg.id && filtered.some((m) => m.id === returnedMsg.id)) {
            return filtered;
          }
          return [returnedMsg, ...filtered];
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
            onClick={() => {
              if (isCallSessionLive(activeCallState)) {
                if (activeCallState?.call_type === "video") handleStartVideoCall();
                else handleStartVoiceCall();
              } else {
                handleStartVoiceCall();
              }
            }}
            className={`p-2 rounded-full transition active:scale-95 cursor-pointer ${
              isCallSessionLive(activeCallState)
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 animate-pulse"
                : "hover:bg-[var(--bg-raised)]"
            }`}
            style={isCallSessionLive(activeCallState) ? {} : { color: "var(--fg)" }}
            title={isCallSessionLive(activeCallState) ? "Join Ongoing Call" : "Voice Call"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>

          {/* Video Call */}
          {!isCallSessionLive(activeCallState) && (
            <button
              onClick={handleStartVideoCall}
              className="p-2 rounded-full transition hover:bg-[var(--bg-raised)] active:scale-95 cursor-pointer"
              style={{ color: "var(--fg)" }}
              title="Video Call"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}

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

          <div className="py-1 space-y-1">
            {/* Exit to Dashboard */}
            <button
              onClick={() => {
                setShow3DotsMenu(false);
                router.push("/dashboard");
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--bg-raised)] flex items-center gap-3 transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--fg)]">Exit to Dashboard</p>
                <p className="text-[10px] text-[var(--fg-muted)]">Return to main arena dashboard</p>
              </div>
            </button>

            {/* Monthly Log Book */}
            <button
              onClick={() => {
                setShow3DotsMenu(false);
                setShowLogBookModal(true);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--bg-raised)] flex items-center gap-3 transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--fg)]">Log Book</p>
                <p className="text-[10px] text-[var(--fg-muted)]">Monthly missed, rejected & Kudos logs</p>
              </div>
            </button>

            <div className="my-1 border-t border-[var(--border)]" />

            {/* Leave or Delete Group */}
            {isAdmin ? (
              <button
                onClick={() => { setShow3DotsMenu(false); handleDeleteArena(); }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 flex items-center gap-3 transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-rose-500/10 shrink-0">
                  <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <p className="text-xs font-extrabold">Delete Arena</p>
              </button>
            ) : (
              <button
                onClick={() => { setShow3DotsMenu(false); handleLeaveArena(); }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 flex items-center gap-3 transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-rose-500/10 shrink-0">
                  <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <p className="text-xs font-extrabold">Leave Group</p>
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
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className="text-[10px] truncate text-[var(--fg-subtle)]">
                          {sanitizeSnippet(item.last_activity_snippet) || `${item.member_count || 1} members`}
                        </p>
                        {unreadCounts[item.id] > 0 && !isActive && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs animate-pulse">
                            {unreadCounts[item.id] > 99 ? "99+" : unreadCounts[item.id]}
                          </span>
                        )}
                      </div>
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
              {/* Voice/Video Call button — joins ongoing call if live, otherwise starts new */}
              <button
                onClick={() => {
                  if (isCallSessionLive(activeCallState)) {
                    // Join the existing ongoing call with its original type
                    if (activeCallState?.call_type === "video") handleStartVideoCall();
                    else handleStartVoiceCall();
                  } else {
                    handleStartVoiceCall();
                  }
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 cursor-pointer ${
                  isCallSessionLive(activeCallState)
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 animate-pulse"
                    : "hover:bg-[var(--bg-raised)]"
                }`}
                style={isCallSessionLive(activeCallState) ? {} : { color: "var(--fg)" }}
                title={isCallSessionLive(activeCallState) ? "Join Ongoing Call" : "Start Voice Huddle"}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              </button>

              {/* Video Call — only shown when no active call or active call is video */}
              {!isCallSessionLive(activeCallState) && (
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
              )}

              {/* Arena Locked Kudos Vault Icon */}
              <button
                onClick={() => setShowKudosModal(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-raised)] active:scale-90 cursor-pointer text-base"
                style={{ color: "var(--fg)" }}
                title="Arena Locked Kudos Vault"
              >
                <span>💰</span>
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
              {(() => {
                const visibleMessages = messages.filter((msg) => {
                  if (msg.message_type === "call_ended") return false;
                  if (typeof msg.content === "string" && (
                    msg.content.includes("call session ended") ||
                    msg.content.includes("Call session ended") ||
                    msg.content.includes("Call ended by")
                  )) return false;
                  return true;
                });

                if (visibleMessages.length === 0) {
                  return (
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
                  );
                }

                return visibleMessages.map((msg, idx) => {
                  const isMe = msg.user_id === userId;
                  const prevMsg = visibleMessages[idx + 1];
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

                          {/* 1. Instagram Call Log Pill (Single Call Start Log) */}
                          {msg.message_type === "call_invite" || (typeof msg.content === "string" && (msg.content.startsWith("📞") || msg.content.startsWith("📹") || msg.content.includes("started the call") || msg.content.includes("Voice Huddle") || msg.content.includes("Video Call"))) ? (
                            (() => {
                              const callIsLive = isCallSessionLive(activeCallState);
                              const isVideo = (typeof msg.content === "string" && msg.content.toLowerCase().includes("video")) ||
                                (activeCallState?.call_type === "video" && callIsLive);
                              const callTitle = typeof msg.content === "string" && msg.content.length > 0
                                ? msg.content
                                : isVideo ? `📹 ${msg.sender_name} started a video call` : `📞 ${msg.sender_name} started the call`;

                              return (
                                <div
                                  onClick={() => {
                                    if (!callIsLive) {
                                      toast.info("📞 This call has already ended.");
                                      return;
                                    }
                                    const liveType = activeCallState?.call_type || (isVideo ? "video" : "audio");
                                    if (liveType === "video") handleStartVideoCall();
                                    else handleStartVoiceCall();
                                  }}
                                  className={`px-3.5 py-2 rounded-[20px] flex items-center gap-3 shadow-xs border my-0.5 transition-all duration-200 ${
                                    callIsLive ? "cursor-pointer hover:scale-[1.02] active:scale-95" : "cursor-default opacity-85"
                                  } ${
                                    isMe
                                      ? "bg-neutral-800 text-white border-neutral-700/40 hover:bg-neutral-700"
                                      : "bg-neutral-200 text-neutral-900 dark:bg-[#262626] dark:text-[#F5F5F5] border-neutral-300/30 dark:border-neutral-700/30 hover:bg-neutral-300 dark:hover:bg-[#303030]"
                                  }`}
                                  title={callIsLive ? "Tap to Join Ongoing Call" : "Call Ended"}
                                >
                                  <div className="w-8 h-8 rounded-full bg-neutral-500/30 dark:bg-neutral-700/60 flex items-center justify-center text-xs shrink-0">
                                    {isVideo ? "📹" : "📞"}
                                  </div>
                                  <div className="flex flex-col min-w-0 pr-1">
                                    <span className="text-xs font-bold leading-tight flex items-center gap-1.5">
                                      <span>{callTitle}</span>
                                      {callIsLive && (
                                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                                          {isVideo ? "Join 📹" : "Join 📞"}
                                        </span>
                                      )}
                                    </span>
                                    <span
                                      className="text-[10px] opacity-70 mt-0.5 font-medium"
                                      style={{ color: "inherit" }}
                                    >
                                      <TimeOnlyStr iso={msg.created_at} />
                                    </span>
                                  </div>
                                </div>
                              );
                            })()
                          ) : msg.message_type === "audio" || (typeof msg.content === "string" && (msg.content.endsWith(".webm") || msg.content.endsWith(".mp3") || msg.content.endsWith(".wav") || msg.content.startsWith("blob:") || (msg.content.includes("/static/uploads/") && msg.content.includes("voice")))) ? (
                            <AudioMessagePlayer src={msg.content || ""} isMe={isMe} />
                          ) : msg.message_type === "image" || (typeof msg.content === "string" && (msg.content.startsWith("data:image/") || msg.content.startsWith("blob:") || /\.(jpg|jpeg|png|gif|webp|svg)/i.test(msg.content) || (msg.content.includes("/static/uploads/") && !msg.content.includes(".webm")))) ? (
                            <div
                              onClick={() => msg.content && setViewerImageUrl(msg.content)}
                              className="overflow-hidden rounded-2xl border border-neutral-700/40 cursor-pointer max-w-[260px] shadow-sm hover:opacity-95 transition-opacity"
                            >
                              <img src={msg.content || ""} alt="Chat Attachment" className="w-full h-auto object-cover max-h-[300px] rounded-2xl" />
                            </div>
                          ) : (
                            /* 2. Text Message Bubble typed by users */
                            <div
                              className={`px-4 py-2.5 text-sm leading-snug break-words whitespace-pre-wrap min-w-0 max-w-full shadow-xs ${
                                isMe
                                  ? "bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 text-white rounded-[22px]"
                                  : "bg-neutral-200 text-neutral-900 dark:bg-[#262626] dark:text-[#F5F5F5] rounded-[22px] border border-neutral-300/30 dark:border-neutral-700/30"
                              }`}
                              style={{
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {renderFormattedMessageContent(msg.content || "", setViewerImageUrl)}
                            </div>
                          )}

                          {(!messages[idx - 1] ||
                            messages[idx - 1].user_id !== msg.user_id) && (
                              <div
                                className={`mt-1 text-[9px] font-medium flex items-center ${isMe ? "mr-1.5 justify-end" : "ml-1.5"}`}
                                style={{ color: "var(--fg-subtle)" }}
                              >
                                <TimeOnlyStr iso={msg.created_at} />
                                {isMe && (
                                  <span className="ml-1 inline-flex items-center" title={msg.is_read ? "Read by all members" : "Sent / Delivered"}>
                                    {msg.is_read ? (
                                      <CheckCheck className="w-3.5 h-3.5 text-[#0095F6] dark:text-sky-400" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5 text-neutral-400" />
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                        </div>

                        {!isMe && <div className="ml-2" style={{ minWidth: 8 }} />}
                      </div>

                      {/* Centered WhatsApp-Style Floating Date Header */}
                      {isFirstMsgOfDate && (
                        <div className="flex justify-center my-3 py-1 shrink-0">
                          <span
                            className="px-3.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide border shadow-xs"
                            style={{
                              background: "var(--bg-card)",
                              borderColor: "var(--border)",
                              color: "var(--fg-muted)",
                            }}
                          >
                            {formatDateHeader(msg.created_at)}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                });
              })()}

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

            {/* Hidden Chat Image File Input */}
            <input
              ref={chatImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSelectChatImageFile}
            />

            {isRecordingAudio ? (
              <div className="shrink-0 z-20 px-3 sm:px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-sm font-bold text-rose-400">Recording Voice Note...</span>
                  <span className="font-mono text-xs text-slate-300">
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCancelVoiceRecording}
                    disabled={isUploadingMedia}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition cursor-pointer"
                    title="Cancel Recording"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSendVoiceRecording}
                    disabled={isUploadingMedia}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer font-bold shadow-md"
                    title="Send Voice Note"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
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
                      if (chatImageInputRef.current) {
                        chatImageInputRef.current.click();
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-[#0095F6] hover:bg-[#0081D6] text-white flex items-center justify-center shrink-0 transition active:scale-90 shadow-xs"
                    title="Send Image File"
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
                        onClick={handleStartVoiceRecording}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-card)] active:scale-90 text-rose-400"
                        title="Record Voice Note"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>

                      {/* Gallery / Image Icon */}
                      <button
                        type="button"
                        onClick={() => {
                          if (chatImageInputRef.current) {
                            chatImageInputRef.current.click();
                          }
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--bg-card)] active:scale-90"
                        title="Attach Image"
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
            )}


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

            {/* ── Proof Cards Feed (flex-1 scrollable with embedded composer) ── */}
            <div className="flex-1 min-h-0 overflow-y-auto styled-scroll p-3 sm:p-4 pb-24 lg:pb-6 space-y-4">
              {/* ── Compact Proof Submission Composer (scrolls upwards with feed) ── */}
              <div
                className="rounded-2xl p-3 shadow-sm transition-all"
                style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
              >
                {hasUserSubmittedInActiveWindow() ? (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 animate-fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-emerald-400 truncate">Today's Proof Verified! 🎉</span>
                      <span className="text-[10px] text-emerald-300/80 hidden sm:inline truncate">Habit streak active</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">✓ Verified</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-black uppercase tracking-wider text-[var(--fg-muted)] flex items-center gap-1.5">
                        <span>Submit Today's Proof</span>
                        {selectedProofPreviewUrl || proofFileName ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">✓ Media Attached</span>
                        ) : null}
                      </span>
                      <span className="font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Due {arenaDeadlineTime}
                      </span>
                    </div>

                    <input ref={proofFileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleProofFileSelect} />

                    <form onSubmit={handleSendProof} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      {/* Compact Image File Picker Button / Preview Pill */}
                      {arenaProofType === "image" && (
                        <div className="shrink-0">
                          {selectedProofPreviewUrl || proofFileName ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--accent)]/40 text-xs font-bold">
                              {selectedProofPreviewUrl && (
                                <img
                                  src={selectedProofPreviewUrl}
                                  alt="Preview"
                                  className="w-5 h-5 rounded-md object-cover border border-[var(--border)] shrink-0"
                                />
                              )}
                              <span className="text-[11px] font-bold text-[var(--fg)] max-w-[90px] truncate">
                                {proofFileName || "Photo"}
                              </span>
                              <button
                                type="button"
                                onClick={() => proofFileInputRef.current?.click()}
                                className="text-[10px] text-[var(--accent)] hover:underline ml-1 cursor-pointer font-extrabold"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => proofFileInputRef.current?.click()}
                              className="px-3 py-1.5 rounded-xl border border-dashed border-[var(--accent)]/50 hover:border-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] cursor-pointer shadow-xs"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Select Photo/Video 📷</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* URL or Text Proof Input */}
                      <input
                        type={arenaProofType === "link" ? "url" : "text"}
                        required={arenaProofType !== "image"}
                        placeholder={arenaProofType === "image" ? "Or paste image URL link…" : arenaProofType === "link" ? "https://example.com/proof" : "Describe your completed task…"}
                        className="flex-1 min-w-[140px] bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)] transition"
                        style={{ color: "var(--fg)" }}
                        value={proofUrl.startsWith("data:") ? "" : proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                      />

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={!proofUrl.trim()}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 transition shadow-sm shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <span>🚀 Submit</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {submissions.length === 0 ? (
                /* Empty State */
                <div
                  className="flex flex-col items-center justify-center py-20 text-center px-6 rounded-3xl mt-2 animate-fade-in"
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
                /* ── Instagram-Style Feed Cards ── */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-w-4xl mx-auto">
                  {submissions.map((sub) => {
                    const memberCount = arenaMembers.length || 1;
                    const downvotes = sub.downvotes || 0;
                    const upvotes = sub.upvotes || 0;
                    const isRejected = downvotes > Math.floor(memberCount / 2);
                    const isMySubmission = sub.user_id === userId;
                    const isVotingClosed = isSubmissionVotingExpired(sub.submitted_at, arenaDeadlineTime);

                    return (
                      <div
                        key={sub.id}
                        className="rounded-2xl flex flex-col animate-fade-in transition-all duration-300 hover:shadow-lg group max-w-md w-full mx-auto"
                        style={{
                          background: "var(--bg-card)",
                          border: isRejected
                            ? "1.5px solid rgba(239,68,68,0.4)"
                            : "1px solid var(--border)",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                          overflow: "hidden",
                        }}
                      >
                        {/* ── Instagram Post Header ── */}
                        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border)]/60 bg-[var(--bg-card)]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Instagram Story Gradient Ring */}
                            <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shrink-0">
                              <div className="p-0.5 rounded-full bg-[var(--bg-card)]">
                                <Avatar name={sub.user_name} imageUrl={sub.user_avatar_url} size={7} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-black truncate text-[var(--fg)] leading-tight">
                                  {sub.user_name}
                                </p>
                                {isMySubmission && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[var(--accent-light)] text-[var(--accent)]">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--fg-muted)] flex items-center gap-1 mt-0.5">
                                <span><TimeStr iso={sub.submitted_at} /></span>
                                <span>•</span>
                                <span className="capitalize">{arenaProofType} Proof</span>
                              </p>
                            </div>
                          </div>

                          {/* Instagram Header Badges */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isVotingClosed ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                🔒 Closed ({arenaDeadlineTime})
                              </span>
                            ) : sub.ai_status === "flagged_suspicious" ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                ⚠️ AI Review
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                🤖 AI Verified
                              </span>
                            )}
                            {isRejected ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/15 text-rose-500 border border-rose-500/30">
                                Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Approved
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Instagram Full-Bleed Media / Content Display ── */}
                        <div className="relative bg-[var(--bg-raised)] overflow-hidden min-h-[110px] flex items-center justify-center">
                          {isImageUrl(sub.proof_url) ? (
                            <button
                              type="button"
                              onClick={() => { setViewerImageUrl(sub.proof_url); setViewerZoom(1); }}
                              className="block w-full group/img relative overflow-hidden cursor-pointer"
                            >
                              <img
                                src={sub.proof_url}
                                alt={`${sub.user_name}'s proof`}
                                className="w-full max-h-[280px] sm:max-h-[320px] object-cover transition-transform duration-500 group-hover/img:scale-[1.02]"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center">
                                <span className="opacity-0 group-hover/img:opacity-100 transition-all transform scale-90 group-hover/img:scale-100 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-bold backdrop-blur-md shadow-lg flex items-center gap-1.5">
                                  🔍 Tap to View Full Screen
                                </span>
                              </div>
                            </button>
                          ) : isHttpUrl(sub.proof_url) ? (
                            <a
                              href={sub.proof_url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full p-4 sm:p-5 flex flex-col justify-between gap-3 group/link transition-all duration-300 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/5 hover:from-indigo-500/20 hover:to-pink-500/15 border-y border-[var(--border)]/40 text-left cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 flex items-center gap-1.5 shrink-0">
                                  🌐 {getDomainName(sub.proof_url)}
                                </span>
                                <span className="text-[10px] font-bold text-[var(--fg-muted)] group-hover/link:text-[var(--accent)] transition flex items-center gap-1">
                                  Open Link <ExternalLink className="w-3 h-3" />
                                </span>
                              </div>
                              <div>
                                <p className="text-xs font-black text-[var(--fg)] group-hover/link:text-[var(--accent)] transition line-clamp-2 leading-snug">
                                  {sub.proof_url}
                                </p>
                                <p className="text-[10px] text-[var(--fg-muted)] mt-1 truncate">
                                  Tap to view external proof on {getDomainName(sub.proof_url)}
                                </p>
                              </div>
                            </a>
                          ) : (
                            <div className="w-full p-4 sm:p-5 relative bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-raised)] to-[var(--accent)]/5 border-y border-[var(--border)]/40 flex flex-col justify-center min-h-[110px]">
                              <span className="absolute top-2 right-3 text-4xl select-none opacity-10 font-serif">“</span>
                              <p className="text-xs sm:text-sm leading-relaxed text-[var(--fg)] font-semibold italic whitespace-pre-wrap relative z-10">
                                "{sub.proof_url}"
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ── Instagram Action Bar & Votes ── */}
                        <div className="px-3.5 py-2 space-y-2 bg-[var(--bg-card)] border-t border-[var(--border)]/40">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              {/* Thumbs Up Button */}
                              <button
                                disabled={isVotingClosed}
                                onClick={() => handleVoteSubmission(sub.id, "upvote")}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                                style={{
                                  background: sub.user_vote === "up" ? "#10b981" : "rgba(16,185,129,0.12)",
                                  color: sub.user_vote === "up" ? "#ffffff" : "#10b981",
                                  border: sub.user_vote === "up" ? "1.5px solid #059669" : "1px solid rgba(16,185,129,0.3)",
                                }}
                                title={isVotingClosed ? `Voting closed at ${arenaDeadlineTime}` : "Thumbs Up"}
                              >
                                <span>👍</span>
                                <span>{upvotes}</span>
                              </button>

                              {/* Thumbs Down Button */}
                              <button
                                disabled={isVotingClosed}
                                onClick={() => handleVoteSubmission(sub.id, "downvote")}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                                style={{
                                  background: sub.user_vote === "down" ? "#ef4444" : "rgba(239,68,68,0.10)",
                                  color: sub.user_vote === "down" ? "#ffffff" : "#ef4444",
                                  border: sub.user_vote === "down" ? "1.5px solid #dc2626" : "1px solid rgba(239,68,68,0.25)",
                                }}
                                title={isVotingClosed ? `Voting closed at ${arenaDeadlineTime}` : "Thumbs Down"}
                              >
                                <span>👎</span>
                                <span>{downvotes}</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => openVotersModal(sub)}
                              className="text-[10px] font-bold text-[var(--fg-muted)] hover:text-[var(--accent)] hover:underline cursor-pointer transition flex items-center gap-1"
                              title="View peer voters (anonymous)"
                            >
                              <span>👥 {upvotes + downvotes} peer votes</span>
                            </button>
                          </div>

                          {/* Instagram Caption & Consensus Bar */}
                          <div className="text-xs pt-1 border-t border-[var(--border)]/30">
                            <p className="text-[11px] text-[var(--fg-subtle)] leading-snug truncate">
                              <span className="font-black text-[var(--fg)] mr-1.5">{sub.user_name}</span>
                              {isImageUrl(sub.proof_url)
                                ? "submitted daily accountability proof."
                                : isHttpUrl(sub.proof_url)
                                  ? `shared external proof link (${getDomainName(sub.proof_url)}).`
                                  : `submitted proof: "${sub.proof_url}"`}
                            </p>

                            {/* Consensus status footer indicator */}
                            <button
                              type="button"
                              onClick={() => openVotersModal(sub)}
                              className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer transition w-full text-left"
                            >
                              <span>
                                {isRejected
                                  ? `❌ Rejected by tribe consensus (>${Math.floor(memberCount / 2)} dislikes)`
                                  : `✓ Verified by Tribe Consensus • View Voters`}
                              </span>
                            </button>
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
                {arenaInviteCode && (
                  <div className="flex items-center justify-center gap-3 w-full pt-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(arenaInviteCode);
                        toast.success(`Invite code copied: ${arenaInviteCode}`);
                      }}
                      className="w-full py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition hover:opacity-80 active:scale-95 cursor-pointer"
                      style={{
                        background: "var(--bg-raised)",
                        color: "var(--fg)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      🔗 Copy Code ({arenaInviteCode})
                    </button>
                  </div>
                )}
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

      {/* ── PEER VOTERS LIST MODAL (ANONYMIZED DISLIKES / UPVOTES) ── */}
      {showVotersModal && (
        <div
          onClick={() => setShowVotersModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl p-5 border shadow-2xl flex flex-col space-y-4 animate-scale-up"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-black text-[var(--fg)] flex items-center gap-2">
                  👥 Peer Review Voters
                </h3>
                <p className="text-[10px] text-[var(--fg-muted)] mt-0.5">
                  Voter choices are anonymous to protect member privacy.
                </p>
              </div>
              <button
                onClick={() => setShowVotersModal(false)}
                className="w-7 h-7 rounded-full bg-[var(--bg-raised)] text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center justify-center cursor-pointer transition font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto styled-scroll space-y-2 py-1">
              {loadingVoters ? (
                <div className="py-8 text-center text-xs text-[var(--fg-muted)] animate-pulse">
                  Loading voter participation list...
                </div>
              ) : votersList.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--fg-muted)]">
                  No votes cast yet on this proof.
                </div>
              ) : (
                votersList.map((voter) => (
                  <div
                    key={voter.user_id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--bg-raised)] border border-[var(--border)]/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={voter.user_name} imageUrl={voter.user_avatar_url} size={7} />
                      <span className="text-xs font-bold text-[var(--fg)] truncate">
                        {voter.user_name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                      ✓ Voted
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowVotersModal(false)}
              className="w-full py-2.5 rounded-2xl text-xs font-bold text-white bg-[var(--accent)] hover:opacity-90 transition cursor-pointer"
            >
              Done
            </button>
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

            {/* WhatsApp-Style Call Participant Cards Grid — Shows ONLY Joined Members */}
            {(() => {
              const selfId = getSelfId();
              const activeIds = Array.from(
                new Set([
                  ...(activeCallState?.participants || []).map((p: any) => Number(p)),
                  ...(selfId ? [selfId] : []),
                  ...Object.keys(remoteStreamsMap).map((id) => Number(id)),
                ])
              ).filter((uid) => Boolean(uid));

              const joinedMembers = activeIds.map((uid) => {
                const memberObj = arenaMembers.find((m) => m.user_id === uid);
                const infoObj = (activeCallState?.participants_info || []).find((p: any) => Number(p.user_id) === uid);
                return {
                  user_id: uid,
                  user_name: memberObj?.user_name || memberObj?.full_name || infoObj?.user_name || (uid === selfId ? "You" : `Member #${uid}`),
                  user_avatar_url: memberObj?.user_avatar_url || null,
                };
              });

              const unjoinedMembers = arenaMembers.filter((m) => !activeIds.includes(m.user_id));

              return (
                <>
                  <div className="grid grid-cols-2 gap-3 my-2 w-full px-1 max-h-[260px] overflow-y-auto styled-scroll">
                    {joinedMembers.map((member, idx) => {
                      const remoteStream = remoteStreamsMap[member.user_id];
                      const isMe = member.user_id === selfId;
                      const isMemberMuted = isMe ? isMuted : Boolean(muteMap[member.user_id]);
                      const isMemberHand = isMe ? isHandRaised : Boolean(handMap[member.user_id]);
                      const isMemberSpeaking = Boolean(speakingMap[member.user_id]) && !isMemberMuted;
                      const nameColors = ["text-emerald-400", "text-amber-400", "text-rose-400", "text-blue-400", "text-purple-400", "text-teal-400"];

                      return (
                        <div
                          key={member.user_id || idx}
                          className={`p-3 rounded-2xl transition-all duration-300 flex flex-col justify-between min-h-[105px] relative overflow-hidden ${
                            isMemberSpeaking
                              ? "bg-[#1E232F] border-2 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-102 z-10"
                              : "bg-[#16181E] border border-white/10"
                          }`}
                        >
                          {remoteStream && <RemoteMediaElement stream={remoteStream} isVideo={false} />}

                          {/* Member Name on Top + Mute/Hand Badges */}
                          <div className="flex items-center justify-between w-full">
                            <h4 className={`text-xs font-black truncate max-w-[95px] ${nameColors[idx % nameColors.length]}`}>
                              {member.user_name}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              {isMemberHand && <span className="text-xs">✋</span>}
                              {isMemberMuted && (
                                <span className="text-[9px] text-red-400 font-extrabold bg-red-500/10 px-1 py-0.2 rounded border border-red-500/20">
                                  🎙️❌
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Avatar + Analog Audio Signal Waveform Bar */}
                          <div className="flex items-center justify-between mt-3">
                            <div className="relative">
                              <Avatar name={member.user_name} imageUrl={member.user_avatar_url || undefined} size={8} />
                            </div>
                            <AnalogAudioSignalIndicator isSpeaking={isMemberSpeaking} volumeLevel={volumeMap[member.user_id] || 0} isMuted={isMemberMuted} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ring Unjoined Arena Members Drawer */}
                  {unjoinedMembers.length > 0 && (
                    <div className="w-full text-left bg-white/5 rounded-2xl p-2.5 border border-white/5 space-y-1.5">
                      <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider px-1">Ring Arena Members ({unjoinedMembers.length})</p>
                      <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 styled-scroll">
                        {unjoinedMembers.map((m) => (
                          <button
                            key={m.user_id}
                            type="button"
                            onClick={() => handleRingMember(m)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-[11px] font-bold text-white shrink-0 active:scale-95 transition cursor-pointer"
                            title={`Ring ${m.user_name}`}
                          >
                            <Avatar name={m.user_name || "Member"} imageUrl={m.user_avatar_url || undefined} size={5} />
                            <span className="truncate max-w-[70px]">{m.user_name || "Member"}</span>
                            <span className="text-amber-400 text-xs">🔔</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Voice Control Buttons */}
            <div className="flex flex-col items-center gap-3 pt-2 w-full">
              <div className="flex items-center justify-center gap-4 w-full">
                {/* Mute Toggle */}
                <button
                  type="button"
                  onClick={toggleLocalMute}
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
                  onClick={toggleHandRaise}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-90 ${isHandRaised ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-white/10 text-white border border-white/10"
                    }`}
                  title="Raise Hand"
                >
                  ✋
                </button>

                {/* Leave Call Button */}
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/50 active:scale-90 transition font-bold cursor-pointer"
                  title="Leave Voice Huddle"
                >
                  📞
                </button>
              </div>

              {/* Call Host Force End Call Button — only shows for call starter OR arena admin */}
              {(isAdmin || (activeCallState?.caller_id && activeCallState.caller_id === getSelfId())) && (
                <button
                  type="button"
                  onClick={handleForceEndCall}
                  className="w-full py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/80 text-[11px] font-black transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  title="End Call for Everyone in Arena"
                >
                  <span>🔴 End Call for Everyone (Host)</span>
                </button>
              )}
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

            {/* Subscribed Joined Members Video Stream Tiles */}
            {(() => {
              const selfId = getSelfId();
              const activeIds = Array.from(
                new Set([
                  ...(activeCallState?.participants || []).map((p: any) => Number(p)),
                  ...(selfId ? [selfId] : []),
                  ...Object.keys(remoteStreamsMap).map((id) => Number(id)),
                ])
              ).filter((uid) => uid && uid !== selfId);

              const remoteJoinedMembers = activeIds.map((uid) => {
                const memberObj = arenaMembers.find((m) => m.user_id === uid);
                const infoObj = (activeCallState?.participants_info || []).find((p: any) => Number(p.user_id) === uid);
                return {
                  user_id: uid,
                  user_name: memberObj?.user_name || memberObj?.full_name || infoObj?.user_name || `Member #${uid}`,
                  user_avatar_url: memberObj?.user_avatar_url || null,
                };
              });

              return remoteJoinedMembers.map((member, idx) => {
                const remoteStream = remoteStreamsMap[member.user_id];
                const isMemberMuted = Boolean(muteMap[member.user_id]);
                const isMemberHand = Boolean(handMap[member.user_id]);

                return (
                  <div
                    key={member.user_id || idx}
                    className="relative rounded-3xl overflow-hidden bg-[#16181E] border border-white/10 shadow-xl flex flex-col items-center justify-center min-h-[220px] group"
                  >
                    {remoteStream ? (
                      <RemoteMediaElement stream={remoteStream} isVideo={true} />
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
                        <div className="relative p-1 rounded-full ring-2 ring-emerald-400/80">
                          <Avatar name={member.user_name} imageUrl={member.user_avatar_url || undefined} size={16} />
                        </div>
                        <p className="text-xs font-extrabold text-white">
                          {member.user_name}
                        </p>
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>Connecting Media Stream...</span>
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/10 z-10">
                      <span className="truncate">{member.user_name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isMemberHand && <span className="text-xs">✋</span>}
                        {isMemberMuted ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-red-500/20 text-red-300 border border-red-500/40 shrink-0">
                            🎙️❌ Muted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                            🟢 In Call
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>


          {/* Floating WhatsApp/Instagram Style Bottom Action Bar */}
          <div className="px-6 py-4 bg-[#12141A]/90 border-t border-white/10 backdrop-blur-xl flex flex-col items-center gap-3 shrink-0 shadow-2xl">
            <div className="flex items-center justify-center gap-4 w-full">
              {/* Mic Button */}
              <button
                type="button"
                onClick={toggleLocalMute}
                className={`w-13 h-13 rounded-2xl flex items-center justify-center text-lg transition active:scale-95 shadow-md cursor-pointer ${isMuted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white border border-white/15 hover:bg-white/20"
                  }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? "🎙️❌" : "🎙️"}
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

              {/* Speaker Button */}
              <button
                type="button"
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`w-13 h-13 rounded-2xl flex items-center justify-center text-lg transition active:scale-95 shadow-md cursor-pointer ${!isSpeakerOn ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white border border-white/15 hover:bg-white/20"
                  }`}
                title="Speaker Toggle"
              >
                {isSpeakerOn ? "🔊" : "🔇"}
              </button>

              {/* Raise Hand Button */}
              <button
                type="button"
                onClick={toggleHandRaise}
                className={`w-13 h-13 rounded-2xl flex items-center justify-center text-lg transition active:scale-95 shadow-md cursor-pointer ${isHandRaised ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-white/10 text-white border border-white/15 hover:bg-white/20"
                  }`}
                title="Raise Hand"
              >
                ✋
              </button>

              {/* Red Pill Leave Call Button */}
              <button
                type="button"
                onClick={handleEndCall}
                className="w-16 h-13 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 transition font-black cursor-pointer text-xl"
                title="Leave Video Call"
              >
                📞
              </button>
            </div>

            {/* Host / Admin Force End Video Call Button */}
            {(isAdmin || (activeCallState?.caller_id && activeCallState.caller_id === getSelfId())) && (
              <button
                type="button"
                onClick={handleForceEndCall}
                className="w-full max-w-sm py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/80 text-[11px] font-black transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                title="End Video Call for Everyone in Arena"
              >
                <span>🔴 End Video Call for Everyone (Host)</span>
              </button>
            )}
          </div>
        </div>
      )}
      {/* ── MONTHLY LOG BOOK MODAL ── */}
      {showLogBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh] border overflow-hidden"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
                  📖
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--fg)]">Monthly Arena Log Book</h3>
                  <p className="text-[11px] text-[var(--fg-muted)]">Proof history, missed cutoffs & Kudos distribution</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogBookModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--bg-raised)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto styled-scroll py-4 space-y-4">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Submitted</p>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">{submissions.length}</p>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Rejected / Missed</p>
                  <p className="text-lg font-black text-rose-400 mt-0.5">
                    {submissions.filter(s => (s.downvotes || 0) > Math.floor((arenaMembers.length || 1) / 2) || s.is_absent).length}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Vault Kudos</p>
                  <p className="text-lg font-black text-amber-400 mt-0.5">
                    {arenaVaultKudos.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Member Detailed Monthly Breakdown */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--fg-muted)]">
                  Member Accountability Breakdown
                </h4>

                {arenaMembers.map((m) => {
                  const memberSubs = submissions.filter(s => s.user_id === m.user_id);
                  const memberRejected = memberSubs.filter(s => (s.downvotes || 0) > Math.floor((arenaMembers.length || 1) / 2)).length;
                  const memberAbsent = memberSubs.filter(s => s.is_absent).length;
                  const memberApproved = memberSubs.length - memberRejected - memberAbsent;

                  return (
                    <div
                      key={m.user_id}
                      className="p-3.5 rounded-2xl bg-[var(--bg-raised)] border border-[var(--border)]/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={m.full_name} imageUrl={m.user_avatar_url} size={9} />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[var(--fg)] truncate">{m.full_name}</p>
                          <p className="text-[10px] text-[var(--fg-muted)] flex items-center gap-2 mt-0.5">
                            <span className="text-emerald-400 font-bold">✓ {memberApproved} Approved</span>
                            <span>•</span>
                            <span className="text-rose-400 font-bold">❌ {memberRejected} Rejected</span>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">⚠️ {memberAbsent} Missed</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-amber-400">
                          🪙 {memberApproved * 100} Kudos
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[var(--border)] shrink-0 text-center">
              <button
                type="button"
                onClick={() => setShowLogBookModal(false)}
                className="w-full py-2.5 rounded-2xl font-black text-xs bg-[var(--accent)] text-white hover:opacity-90 active:scale-95 transition cursor-pointer shadow-md"
              >
                Close Log Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kudos Economy Wallet & Cashout Modal */}
      <KudosWalletModal
        isOpen={showKudosModal}
        onClose={() => setShowKudosModal(false)}
        arenaVaultKudos={arenaVaultKudos}
        kudosDaysRemaining={kudosDaysRemaining}
        arenaVaultTransactions={arenaVaultTransactions}
        arenaLeaderboard={arenaLeaderboard}
        onDistributeRewards={handleDistributeRewards}
        isAdmin={isAdmin}
      />
    </div>
  );
}

