"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../utils/api";
import dataCache from "../utils/dataCache";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";

type ProfileData = {
  id?: number;
  full_name: string;
  username?: string;
  email: string;
  phone_number?: string | null;
  contextual_role: string;
  profile_image_url?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  kudos_balance?: number;
};

const getInitials = (name: string) =>
  (name || "T")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
];

// ----- Minimal icon components -----
const IconArrowLeft = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IconSun = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const IconMoon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);
const IconPencil = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 012.828 2.828L11.828 13.828a4 4 0 01-1.414.94l-3 1 1-3a4 4 0 01.94-1.414z" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconX = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconLogOut = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
const IconLock = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const IconCamera = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl animate-shimmer ${className}`}
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
    />
  );
}

// Inline editable field with save/cancel
function EditableField({
  label,
  value,
  prefix,
  type = "text",
  placeholder,
  onSave,
  saving,
  readOnly = false,
  readOnlyBadge,
}: {
  label: string;
  value: string;
  prefix?: string;
  type?: string;
  placeholder?: string;
  onSave?: (v: string) => Promise<void>;
  saving?: boolean;
  readOnly?: boolean;
  readOnlyBadge?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    if (readOnly || !onSave) return;
    if (draft.trim() === value) {
      setEditing(false);
      return;
    }
    await onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div
      className="p-5 rounded-2xl space-y-2 group relative overflow-hidden transition-all"
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
    >
      {/* Colour Accent Bar */}
      <div
        className="absolute left-0 inset-y-0 w-1 rounded-l-2xl"
        style={{
          background: readOnly
            ? "rgba(163,163,163,0.5)"
            : "var(--accent-gradient)",
        }}
      />
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-extrabold uppercase tracking-[0.12em] flex items-center gap-1.5"
          style={{ color: "var(--fg-muted)" }}
        >
          {readOnly && <IconLock />}
          {label}
        </span>
        {readOnly ? (
          <span
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(163,163,163,0.12)", color: "var(--fg-subtle)" }}
          >
            {readOnlyBadge || "Locked"}
          </span>
        ) : !editing && onSave ? (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: "var(--accent-light)",
              color: "var(--accent)",
              border: "1px solid var(--accent-glow)",
            }}
          >
            <IconPencil /> Edit
          </button>
        ) : null}
      </div>

      {editing && !readOnly ? (
        <div className="flex items-center gap-2">
          {prefix && (
            <span className="text-sm font-bold opacity-60">{prefix}</span>
          )}
          <input
            ref={inputRef}
            type={type}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            className="flex-1 bg-transparent text-sm font-semibold outline-none border-b-2 pb-0.5"
            style={{ color: "var(--fg)", borderColor: "var(--accent)" }}
            disabled={saving}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 rounded-lg transition hover:scale-110 active:scale-90 cursor-pointer"
            style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}
          >
            {saving ? (
              <span className="block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <IconCheck />
            )}
          </button>
          <button
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="p-1.5 rounded-lg transition hover:scale-110 active:scale-90 cursor-pointer"
            style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}
          >
            <IconX />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold break-all" style={{ color: "var(--fg)" }}>
            {prefix && value ? `${prefix}${value}` : value || "—"}
          </p>
          {readOnly && (
            <span className="text-[11px] font-normal" style={{ color: "var(--fg-subtle)" }}>
              Cannot be modified
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentArenaId = searchParams.get("arena_id");
  const { theme, setTheme, isMounted } = useTheme();
  const isDark = theme === "dark";
  const { toast } = useToast();

  const [userId, setUserId] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "appearance" | "security">("overview");
  const [savingField, setSavingField] = useState<"name" | "username" | "phone" | null>(null);

  // Full Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [savingFullProfile, setSavingFullProfile] = useState(false);

  // Camera capture inside Edit Profile Modal
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  // DP viewer / standalone update
  const [showDpViewer, setShowDpViewer] = useState(false);
  const [showDpEdit, setShowDpEdit] = useState(false);
  const [profileImageDraft, setProfileImageDraft] = useState("");
  const [savingImage, setSavingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  // Delete account
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    const storedUserId = localStorage.getItem("tribely_user_id");
    const storedToken = localStorage.getItem("tribely_token");
    if (!storedToken || !storedUserId) {
      router.push("/login");
      return;
    }

    const parsedId = Number(storedUserId);
    setUserId(parsedId);

    const profileUrl = currentArenaId
      ? `/users/profile/${parsedId}?arena_id=${currentArenaId}`
      : `/users/profile/${parsedId}`;

    const cached = dataCache.get<ProfileData>(profileUrl);
    if (cached) {
      setProfileData(cached);
      setLoading(false);
    }

    dataCache.fetchSWR<ProfileData>(
      profileUrl,
      (data) => {
        if (data) {
          setProfileData(data);
        }
        setLoading(false);
      },
      () => {
        toast.error("Could not load profile details.");
        setLoading(false);
      }
    );
  }, [router, currentArenaId]);

  // Sync profile data to edit modal inputs when modal opens
  const openFullEditModal = () => {
    if (!profileData) return;
    setEditFullName(profileData.full_name || "");
    setEditUsername(profileData.username || "");
    setEditPhoneNumber(profileData.phone_number || "");
    setEditAvatarUrl(profileData.profile_image_url || profileData.avatar_url || null);
    setShowEditModal(true);
  };

  const handleUpdateName = async (value: string) => {
    setSavingField("name");
    try {
      const res = await api.patch("/users/profile/details", { full_name: value });
      const updated = res.data?.data;
      setProfileData((cur) => (cur ? { ...cur, full_name: updated?.full_name ?? value } : cur));
      if (typeof window !== "undefined") {
        localStorage.setItem("tribely_user_name", value);
      }
      toast.success("Name updated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update name.");
    } finally {
      setSavingField(null);
    }
  };

  const handleUpdateUsername = async (value: string) => {
    setSavingField("username");
    const cleanUser = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    try {
      const res = await api.patch("/users/profile/details", { username: cleanUser });
      const updated = res.data?.data;
      setProfileData((cur) => (cur ? { ...cur, username: updated?.username ?? cleanUser } : cur));
      toast.success("Username updated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update username.");
    } finally {
      setSavingField(null);
    }
  };

  const handleUpdatePhone = async (value: string) => {
    setSavingField("phone");
    try {
      const res = await api.patch("/users/profile/details", { phone_number: value.trim() });
      const updated = res.data?.data;
      setProfileData((cur) => (cur ? { ...cur, phone_number: updated?.phone_number ?? value } : cur));
      toast.success("Phone number updated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update phone number.");
    } finally {
      setSavingField(null);
    }
  };

  // Full Profile Update Submit (Everything except email)
  const handleSaveFullProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFullProfile(true);
    try {
      const cleanName = editFullName.trim();
      const cleanUser = editUsername.trim().toLowerCase();
      const cleanPhone = editPhoneNumber.trim();

      if (!cleanName) {
        toast.error("Full name cannot be empty.");
        setSavingFullProfile(false);
        return;
      }

      const payload: any = {
        full_name: cleanName,
        username: cleanUser || undefined,
        phone_number: cleanPhone || null,
        profile_image_url: editAvatarUrl || null,
        avatar_url: editAvatarUrl || null,
      };

      const res = await api.patch("/users/profile/details", payload);
      const updated = res.data?.data;

      setProfileData((cur) =>
        cur
          ? {
              ...cur,
              full_name: updated?.full_name ?? cleanName,
              username: updated?.username ?? cleanUser,
              phone_number: updated?.phone_number ?? cleanPhone,
              profile_image_url: updated?.profile_image_url ?? editAvatarUrl,
              avatar_url: updated?.avatar_url ?? editAvatarUrl,
            }
          : cur
      );

      if (typeof window !== "undefined") {
        localStorage.setItem("tribely_user_name", cleanName);
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.full_name = cleanName;
            parsed.username = cleanUser;
            parsed.phone_number = cleanPhone;
            parsed.avatar_url = editAvatarUrl;
            localStorage.setItem("user", JSON.stringify(parsed));
          } catch {}
        }
      }

      toast.success("Profile updated successfully!");
      setShowEditModal(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to save profile changes.");
    } finally {
      setSavingFullProfile(false);
    }
  };

  // Standalone DP Update
  const handleUpdateDp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileImageDraft.trim()) {
      toast.error("Please choose an image or paste a URL.");
      return;
    }
    setSavingImage(true);
    try {
      const res = await api.put("/users/profile/image", {
        profile_image_url: profileImageDraft.trim(),
      });
      const saved = res.data?.data?.profile_image_url || profileImageDraft;
      setProfileData((cur) => (cur ? { ...cur, profile_image_url: saved, avatar_url: saved } : cur));
      setProfileImageDraft("");
      setShowDpEdit(false);
      setShowDpViewer(false);
      toast.success("Profile photo updated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't save photo.");
    } finally {
      setSavingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        setProfileImageDraft(result);
        setEditAvatarUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Camera capture inside Edit Profile Modal
  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast.error("Camera access denied. Please upload an image instead.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const startX = (video.videoWidth - size) / 2;
      const startY = (video.videoHeight - size) / 2;
      ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      setEditAvatarUrl(dataUrl);
      setProfileImageDraft(dataUrl);
    }
    stopCamera();
  };

  const handlePasswordMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    try {
      await api.post("/users/profile/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't update password.");
    }
  };

  const executeDeleteAccount = async () => {
    setShowConfirmDelete(false);
    setDeletingAccount(true);
    try {
      await api.delete("/users/profile");
      toast.success("Account deleted successfully.");
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("tribely_token");
        localStorage.removeItem("tribely_user_id");
        localStorage.clear();
      }
      window.location.href = "/register";
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : err?.response?.data?.detail?.message ||
            err?.response?.data?.message ||
            err?.message ||
            "Couldn't delete the account.";
      toast.error(errorMsg);
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="h-14 glass-header border-b" style={{ borderColor: "var(--border)" }} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div
            className="rounded-3xl p-8 flex gap-6 items-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <Skeleton className="w-24 h-24 !rounded-full shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="h-14" />
          <Skeleton className="h-52" />
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("tribely_token");
    localStorage.removeItem("tribely_user_id");
    localStorage.removeItem("tribely_user_name");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    dataCache.clear();
    router.push("/login");
  };

  const TABS = [
    { id: "overview", label: "Account & Profile", icon: "👤" },
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "security", label: "Security & Password", icon: "🔐" },
  ] as const;

  const activeAvatar = profileData?.profile_image_url || profileData?.avatar_url;

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-30 px-4 sm:px-6 h-14 flex items-center justify-between glass-header">
        <Link
          href="/feed"
          className="flex items-center gap-1.5 text-xs font-bold transition hover:opacity-70 active:scale-95"
          style={{ color: "var(--fg-muted)" }}
        >
          <IconArrowLeft /> Feed
        </Link>
        <span
          className="text-[11px] font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
        >
          Profile & Settings
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-2 rounded-xl transition hover:scale-105 active:scale-90 cursor-pointer"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
            aria-label="Toggle theme"
          >
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 active:scale-95 transition cursor-pointer"
            title="Sign out of Tribely"
          >
            <IconLogOut />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── HERO PROFILE CARD ── */}
        {profileData && (
          <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 animate-fade-in-up shadow-2xl glass-card">
            {/* Fiery Gradient mesh background blob */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
                style={{ background: "var(--accent)" }}
              />
              <div
                className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-15 blur-3xl"
                style={{ background: "#FF2E00" }}
              />
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              {/* Clickable Avatar */}
              <button
                type="button"
                onClick={() => {
                  setShowDpViewer(true);
                  setShowDpEdit(false);
                  setProfileImageDraft("");
                }}
                className="relative group shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                title="View & edit profile photo"
              >
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-3xl font-black text-white overflow-hidden shadow-2xl relative"
                  style={{
                    background: activeAvatar ? "transparent" : "var(--accent-gradient)",
                    border: "4px solid var(--accent-glow)",
                    boxShadow: "0 0 28px var(--accent-glow)",
                  }}
                >
                  {activeAvatar ? (
                    <img src={activeAvatar} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{getInitials(profileData.full_name || "T")}</span>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200 gap-0.5">
                    <span className="text-lg">📷</span>
                    <span className="text-[9px] font-bold text-white tracking-wide">Edit DP</span>
                  </div>
                </div>
              </button>

              {/* Info & Edit Profile Action Button */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2
                      className="text-2xl sm:text-3xl font-black tracking-tight"
                      style={{
                        color: "var(--fg)",
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
                      }}
                    >
                      {profileData.full_name}
                    </h2>
                    {profileData.username && (
                      <p className="text-sm font-bold text-orange-500">
                        @{profileData.username}
                      </p>
                    )}
                  </div>

                  {/* PRIMARY "EDIT PROFILE" BUTTON */}
                  <button
                    onClick={openFullEditModal}
                    className="px-4 py-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg hover:brightness-110 active:scale-95 cursor-pointer self-center sm:self-auto"
                    style={{
                      background: "var(--accent-gradient)",
                      color: "#FFFFFF",
                      boxShadow: "0 4px 16px var(--accent-glow)",
                    }}
                  >
                    <IconPencil />
                    <span>Edit Profile</span>
                  </button>
                </div>

                {/* Email address display */}
                <p className="text-xs font-mono flex items-center justify-center sm:justify-start gap-1.5" style={{ color: "var(--fg-muted)" }}>
                  <IconLock />
                  <span>{profileData.email}</span>
                </p>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-extrabold"
                    style={{
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                      border: "1px solid var(--accent-glow)",
                    }}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] mr-1.5 align-middle animate-pulse" />
                    {profileData.contextual_role || "Member"}
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-extrabold"
                    style={{
                      background: "var(--success-light)",
                      color: "var(--success)",
                      border: "1px solid rgba(16,185,129,0.20)",
                    }}
                  >
                    ✅ Verified Account
                  </span>
                  {profileData.phone_number && (
                    <span
                      className="px-3 py-1 rounded-full text-[11px] font-extrabold"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        color: "#3B82F6",
                        border: "1px solid rgba(59,130,246,0.25)",
                      }}
                    >
                      📱 {profileData.phone_number}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEGMENT TABS ── */}
        <div className="ios-pill-container w-full p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`ios-pill-tab flex-1 py-2.5 cursor-pointer ${activeTab === tab.id ? "active" : ""}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            {/* ─── OVERVIEW TAB (ALL FIELDS EDITABLE EXCEPT EMAIL) ─── */}
            {activeTab === "overview" && profileData && (
              <div className="space-y-4 animate-fade-in">
                <div className="glass-card rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👤</span>
                      <h3 className="text-sm font-extrabold" style={{ color: "var(--fg)" }}>
                        Account Profile Information
                      </h3>
                    </div>
                    <button
                      onClick={openFullEditModal}
                      className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                    >
                      Edit All
                    </button>
                  </div>

                  {/* 1. Full Display Name (Editable) */}
                  <EditableField
                    label="Full Name"
                    value={profileData.full_name}
                    placeholder="Enter your full name"
                    onSave={handleUpdateName}
                    saving={savingField === "name"}
                  />

                  {/* 2. Username / Handle (Editable) */}
                  <EditableField
                    label="Username (@handle)"
                    prefix="@"
                    value={profileData.username || ""}
                    placeholder="alexmercer"
                    onSave={handleUpdateUsername}
                    saving={savingField === "username"}
                  />

                  {/* 3. Phone Number (Editable) */}
                  <EditableField
                    label="Phone Number"
                    value={profileData.phone_number || ""}
                    placeholder="+1 555 123 4567"
                    type="tel"
                    onSave={handleUpdatePhone}
                    saving={savingField === "phone"}
                  />

                  {/* 4. Email Address (STRICTLY LOCKED & READ-ONLY) */}
                  <EditableField
                    label="Email Address"
                    value={profileData.email}
                    readOnly={true}
                    readOnlyBadge="🔒 Security Locked"
                  />
                </div>
              </div>
            )}

            {/* ─── APPEARANCE TAB ─── */}
            {activeTab === "appearance" && (
              <div className="space-y-4 animate-fade-in">
                <div className="glass-card rounded-3xl p-6 space-y-5">
                  <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                    🎨 Interface Theme
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        v: "dark",
                        icon: "🌙",
                        label: "Dark Mode",
                        sub: "Fiery dark workspace",
                        accent: "var(--accent)",
                        accentBg: "var(--accent-light)",
                        accentBorder: "var(--accent-glow)",
                      },
                      {
                        v: "light",
                        icon: "☀️",
                        label: "Light Mode",
                        sub: "Clean & bright",
                        accent: "#F59E0B",
                        accentBg: "rgba(245,158,11,0.10)",
                        accentBorder: "rgba(245,158,11,0.25)",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        onClick={() => setTheme(opt.v as "dark" | "light")}
                        className="p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-200 text-center cursor-pointer"
                        style={{
                          background: theme === opt.v ? opt.accentBg : "var(--bg-raised)",
                          border: `2px solid ${theme === opt.v ? opt.accentBorder : "var(--border)"}`,
                          boxShadow: theme === opt.v ? `0 4px 20px ${opt.accentBg}` : "none",
                        }}
                      >
                        <span className="text-3xl">{opt.icon}</span>
                        <div>
                          <div
                            className="text-xs font-bold"
                            style={{ color: theme === opt.v ? opt.accent : "var(--fg)" }}
                          >
                            {opt.label}
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--fg-subtle)" }}>
                            {opt.sub}
                          </div>
                        </div>
                        {theme === opt.v && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                            style={{ background: opt.accent }}
                          >
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── SECURITY TAB ─── */}
            {activeTab === "security" && (
              <div className="space-y-4 animate-fade-in">
                {/* Password */}
                <div className="glass-card rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                    🔐 Change Password
                  </h3>
                  <form onSubmit={handlePasswordMutation} className="space-y-4">
                    {[
                      {
                        label: "Current Password",
                        value: currentPassword,
                        set: setCurrentPassword,
                        key: "current" as const,
                      },
                      {
                        label: "New Password",
                        value: newPassword,
                        set: setNewPassword,
                        key: "new" as const,
                      },
                      {
                        label: "Confirm New Password",
                        value: confirmPassword,
                        set: setConfirmPassword,
                        key: "confirm" as const,
                      },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <label
                          className="text-[10px] font-extrabold uppercase tracking-widest block"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          {f.label}
                        </label>
                        <div className="relative">
                          <input
                            type={showPw[f.key] ? "text" : "password"}
                            required
                            value={f.value}
                            onChange={(e) => f.set(e.target.value)}
                            className="input-base focus-accent pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((p) => ({ ...p, [f.key]: !p[f.key] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100 cursor-pointer"
                          >
                            {showPw[f.key] ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        className="btn-accent px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md cursor-pointer"
                      >
                        ✓ Update Password
                      </button>
                    </div>
                  </form>
                </div>

                {/* Danger Zone */}
                <div
                  className="rounded-3xl p-6 space-y-3"
                  style={{ background: "var(--danger-light)", border: "1px solid rgba(239,68,68,0.20)" }}
                >
                  <h3 className="text-sm font-extrabold flex items-center gap-2 text-red-500">
                    ⚠️ Danger Zone
                  </h3>
                  <p className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
                    Permanently delete your account, all arena memberships and habit logs. This cannot be undone.
                  </p>
                  <button
                    onClick={() => setShowConfirmDelete(true)}
                    disabled={deletingAccount}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    style={{ background: "var(--danger)" }}
                  >
                    {deletingAccount ? "Deleting…" : "🗑️ Delete My Account"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="space-y-4">
            <div className="glass-card rounded-3xl p-5 space-y-4 sticky top-20">
              <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
                💡 Profile Controls
              </h3>
              <div className="space-y-3 text-xs">
                {[
                  {
                    icon: "✏️",
                    title: "Full Profile Editing",
                    body: "You can freely update your name, username handle, profile picture, and phone number anytime.",
                    accent: "var(--accent)",
                  },
                  {
                    icon: "🔒",
                    title: "Email Locked",
                    body: "Your email address is permanently tied to your verified identity and OTP login credentials.",
                    accent: "#FF5E00",
                  },
                  {
                    icon: "📸",
                    title: "Custom Avatar",
                    body: "Snap a live photo via webcam, upload from device, or pick curated presets.",
                    accent: "#10B981",
                  },
                ].map((t) => (
                  <div
                    key={t.title}
                    className="p-3.5 rounded-2xl space-y-1"
                    style={{
                      background: "var(--accent-light)",
                      border: "1px solid var(--accent-glow)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.icon}</span>
                      <span className="font-extrabold text-[11px]" style={{ color: t.accent }}>
                        {t.title}
                      </span>
                    </div>
                    <p style={{ color: "var(--fg-muted)" }}>{t.body}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <Link
                  href="/feed"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition hover:opacity-80 active:scale-95"
                  style={{
                    background: "var(--bg-raised)",
                    border: "1px solid var(--border)",
                    color: "var(--fg-muted)",
                  }}
                >
                  ← Back to Feed
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── COMPREHENSIVE "EDIT FULL PROFILE" MODAL (EVERYTHING EXCEPT EMAIL) ── */}
      {showEditModal && profileData && (
        <div
          onClick={() => {
            if (isCameraOpen) stopCamera();
            setShowEditModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(9, 13, 22, 0.75)", backdropFilter: "blur(20px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-4 flex items-center justify-between border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">✏️</span>
                <h3 className="text-sm font-black tracking-tight" style={{ color: "var(--fg)" }}>
                  Edit Profile
                </h3>
              </div>
              <button
                onClick={() => {
                  if (isCameraOpen) stopCamera();
                  setShowEditModal(false);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition hover:scale-110 active:scale-90 cursor-pointer"
                style={{ background: "var(--bg-raised)", color: "var(--fg-muted)" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveFullProfile} className="p-6 space-y-4 overflow-y-auto">
              {/* Profile Photo Controls */}
              <div className="flex flex-col items-center justify-center space-y-2.5 pb-2">
                <div className="relative group">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white overflow-hidden shadow-xl"
                    style={{
                      background: editAvatarUrl ? "transparent" : "var(--accent-gradient)",
                      border: "3px solid var(--accent-glow)",
                    }}
                  >
                    {editAvatarUrl ? (
                      <img src={editAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{getInitials(editFullName || "T")}</span>
                    )}
                  </div>
                </div>

                {/* Avatar Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={isCameraOpen ? stopCamera : startCamera}
                    className="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                    style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg)" }}
                  >
                    <IconCamera />
                    <span>{isCameraOpen ? "Close Camera" : "Snap Photo"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    className="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                    style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg)" }}
                  >
                    <span>📁 Upload</span>
                  </button>

                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Camera Viewfinder */}
                {isCameraOpen && (
                  <div className="w-full p-3 rounded-2xl bg-black border border-neutral-800 space-y-2 animate-in zoom-in-95">
                    <div className="relative rounded-xl overflow-hidden aspect-square bg-black">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="w-full py-2 rounded-xl bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition cursor-pointer"
                    >
                      📸 Capture Frame
                    </button>
                  </div>
                )}

                {/* Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold" style={{ color: "var(--fg-subtle)" }}>
                    Presets:
                  </span>
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditAvatarUrl(preset)}
                      className={`w-6 h-6 rounded-full overflow-hidden border transition hover:scale-110 cursor-pointer ${
                        editAvatarUrl === preset ? "ring-2 ring-orange-500" : "border-transparent"
                      }`}
                    >
                      <img src={preset} alt={`P${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Full Display Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--fg-muted)" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="input-base focus-accent w-full text-xs font-semibold"
                />
              </div>

              {/* 2. Username Handle */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--fg-muted)" }}>
                  Username Handle *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-60">@</span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="alexmercer"
                    className="input-base focus-accent w-full pl-7 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* 3. Phone Number */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--fg-muted)" }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="input-base focus-accent w-full text-xs font-semibold"
                />
              </div>

              {/* 4. Email Address (STRICTLY LOCKED & NON-EDITABLE) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--fg-muted)" }}>
                    <IconLock /> Email Address
                  </label>
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Locked / Non-Editable
                  </span>
                </div>
                <input
                  type="email"
                  disabled
                  readOnly
                  value={profileData.email}
                  className="input-base w-full text-xs opacity-60 cursor-not-allowed"
                  style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}
                />
                <p className="text-[10px] italic" style={{ color: "var(--fg-subtle)" }}>
                  Email is locked for account verification & OTP authentication security.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (isCameraOpen) stopCamera();
                    setShowEditModal(false);
                  }}
                  className="btn-ghost flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFullProfile || !editFullName.trim()}
                  className="btn-accent flex-1 py-2.5 rounded-xl text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingFullProfile ? "Saving Changes…" : "✓ Save Changes"}
                </button>
              </div>
            </form>

            {/* Hidden Canvas for Camera Frame Capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* ── DP VIEWER MODAL ── */}
      {showDpViewer && profileData && (
        <div
          onClick={() => {
            setShowDpViewer(false);
            setShowDpEdit(false);
            setProfileImageDraft("");
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(9, 13, 22, 0.75)", backdropFilter: "blur(20px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-3.5 flex items-center justify-between border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-xs font-black tracking-wide" style={{ color: "var(--fg)" }}>
                Profile Picture
              </span>
              <button
                onClick={() => {
                  setShowDpViewer(false);
                  setShowDpEdit(false);
                  setProfileImageDraft("");
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition hover:scale-110 active:scale-90 cursor-pointer"
                style={{ background: "var(--bg-raised)", color: "var(--fg-muted)" }}
              >
                ✕
              </button>
            </div>

            {/* Full-size DP */}
            <div className="flex items-center justify-center bg-slate-950/60 p-8">
              <div
                className="w-44 h-44 rounded-full flex items-center justify-center text-5xl font-black text-white overflow-hidden shadow-2xl"
                style={{
                  background: activeAvatar ? "transparent" : "var(--accent-gradient)",
                  border: "5px solid var(--accent-glow)",
                  boxShadow: "0 0 48px var(--accent-glow)",
                }}
              >
                {profileImageDraft || activeAvatar ? (
                  <img
                    src={profileImageDraft || activeAvatar!}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{getInitials(profileData.full_name || "T")}</span>
                )}
              </div>
            </div>

            {/* Action Area */}
            <div className="p-5 space-y-4">
              {!showDpEdit ? (
                <button
                  type="button"
                  onClick={() => setShowDpEdit(true)}
                  className="btn-accent w-full py-2.5 rounded-xl text-xs font-extrabold shadow-md cursor-pointer"
                >
                  📷 Update Profile Photo
                </button>
              ) : (
                <form onSubmit={handleUpdateDp} className="space-y-3 animate-fade-in">
                  {/* File picker */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl text-xs font-bold transition active:scale-95 border cursor-pointer"
                    style={{
                      background: "var(--bg-raised)",
                      borderColor: "var(--border)",
                      color: "var(--fg)",
                    }}
                  >
                    📁 Choose from Device
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {/* URL Input */}
                  <div className="space-y-1">
                    <label
                      className="text-[10px] font-black uppercase tracking-widest block"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Or paste image URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      className="input-base focus-accent text-xs"
                      value={profileImageDraft.startsWith("data:") ? "" : profileImageDraft}
                      onChange={(e) => setProfileImageDraft(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDpEdit(false);
                        setProfileImageDraft("");
                      }}
                      className="btn-ghost flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingImage}
                      className="btn-accent flex-1 py-2 rounded-xl text-xs font-extrabold disabled:opacity-50 cursor-pointer"
                    >
                      {savingImage ? "Saving…" : "✓ Save Photo"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {showConfirmDelete && (
        <div
          onClick={() => setShowConfirmDelete(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(9, 13, 22, 0.75)", backdropFilter: "blur(20px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl p-7 shadow-2xl space-y-5 text-center animate-scale-in"
            style={{ background: "var(--bg-card)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--fg)" }}
          >
            <div className="text-4xl">⚠️</div>
            <div>
              <h3 className="text-base font-black text-red-500 mb-2">Delete Account?</h3>
              <p className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
                This will permanently remove your profile, arena memberships, and all activity history. This cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="btn-ghost flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteAccount}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white transition active:scale-95 shadow-md cursor-pointer"
                style={{ background: "var(--danger)" }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
