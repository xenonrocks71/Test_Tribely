"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../utils/api";
import dataCache from "../utils/dataCache";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";

type ProfileData = {
  full_name: string;
  email: string;
  contextual_role: string;
  profile_image_url?: string | null;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl animate-shimmer ${className}`}
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }} />
  );
}

// Inline editable field with save/cancel
function EditableField({
  label,
  value,
  type = "text",
  onSave,
  saving,
}: {
  label: string;
  value: string;
  type?: string;
  onSave: (v: string) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSave = async () => {
    if (!draft.trim() || draft.trim() === value) { setEditing(false); return; }
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
        style={{ background: "var(--accent-gradient)" }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--fg-muted)" }}>
          {label}
        </span>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent-glow)" }}
          >
            <IconPencil /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            className="flex-1 bg-transparent text-sm font-semibold outline-none border-b-2 pb-0.5"
            style={{ color: "var(--fg)", borderColor: "var(--accent)" }}
            disabled={saving}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 rounded-lg transition hover:scale-110 active:scale-90"
            style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}
          >
            {saving ? <span className="block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <IconCheck />}
          </button>
          <button
            onClick={() => { setDraft(value); setEditing(false); }}
            className="p-1.5 rounded-lg transition hover:scale-110 active:scale-90"
            style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}
          >
            <IconX />
          </button>
        </div>
      ) : (
        <p className="text-sm font-semibold break-all" style={{ color: "var(--fg)" }}>
          {value || "—"}
        </p>
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
  const [savingField, setSavingField] = useState<"name" | "email" | null>(null);

  // DP viewer / update
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
    if (!storedToken || !storedUserId) { router.push("/login"); return; }

    const parsedId = Number(storedUserId);
    setUserId(parsedId);

    const profileUrl = currentArenaId
      ? `/users/profile/${parsedId}?arena_id=${currentArenaId}`
      : `/users/profile/${parsedId}`;

    const cached = dataCache.get<ProfileData>(profileUrl);
    if (cached) { setProfileData(cached); setLoading(false); }

    dataCache.fetchSWR<ProfileData>(
      profileUrl,
      (data) => { if (data) setProfileData(data); setLoading(false); },
      () => { toast.error("Could not load profile details."); setLoading(false); }
    );
  }, [router, currentArenaId]);

  const handleUpdateName = async (value: string) => {
    setSavingField("name");
    try {
      const res = await api.patch("/users/profile/details", { full_name: value });
      const updated = res.data?.data;
      setProfileData((cur) => cur ? { ...cur, full_name: updated?.full_name ?? value } : cur);
      toast.success("Name updated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update name.");
    } finally { setSavingField(null); }
  };

  const handleUpdateEmail = async (value: string) => {
    setSavingField("email");
    try {
      const res = await api.patch("/users/profile/details", { email: value });
      const updated = res.data?.data;
      setProfileData((cur) => cur ? { ...cur, email: updated?.email ?? value } : cur);
      toast.success("Email updated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update email.");
    } finally { setSavingField(null); }
  };

  const handleUpdateDp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileImageDraft.trim()) { toast.error("Please choose an image or paste a URL."); return; }
    setSavingImage(true);
    try {
      const res = await api.put("/users/profile/image", { profile_image_url: profileImageDraft.trim() });
      const saved = res.data?.data?.profile_image_url || profileImageDraft;
      setProfileData((cur) => cur ? { ...cur, profile_image_url: saved } : cur);
      setProfileImageDraft("");
      setShowDpEdit(false);
      setShowDpViewer(false);
      toast.success("Profile photo updated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't save photo.");
    } finally { setSavingImage(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) setProfileImageDraft(result);
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match."); return; }
    try {
      await api.post("/users/profile/change-password", { current_password: currentPassword, new_password: newPassword });
      toast.success("Password updated!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
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
          <div className="rounded-3xl p-8 flex gap-6 items-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <Skeleton className="w-24 h-24 !rounded-full shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="h-14" /><Skeleton className="h-52" />
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
    { id: "overview", label: "Account", icon: "👤" },
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "security", label: "Security", icon: "🔐" },
  ] as const;

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg)", color: "var(--fg)" }}>

      {/* ── TOPBAR ── */}
      <header
        className="sticky top-0 z-30 px-4 sm:px-6 h-14 flex items-center justify-between glass-header"
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs font-bold transition hover:opacity-70 active:scale-95"
          style={{ color: "var(--fg-muted)" }}
        >
          <IconArrowLeft /> Dashboard
        </Link>
        <span className="text-[11px] font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}>
          Profile & Settings
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-2 rounded-xl transition hover:scale-105 active:scale-90"
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

        {/* ── HERO CARD ── */}
        {profileData && (
          <div
            className="relative rounded-3xl overflow-hidden p-6 sm:p-8 animate-fade-in-up shadow-2xl glass-card"
          >
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
                onClick={() => { setShowDpViewer(true); setShowDpEdit(false); setProfileImageDraft(""); }}
                className="relative group shrink-0 transition-transform hover:scale-105 active:scale-95"
                title="View profile picture"
              >
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-3xl font-black text-white overflow-hidden shadow-2xl relative"
                  style={{
                    background: profileData.profile_image_url
                      ? "transparent"
                      : "var(--accent-gradient)",
                    border: "4px solid var(--accent-glow)",
                    boxShadow: "0 0 28px var(--accent-glow)",
                  }}
                >
                  {profileData.profile_image_url ? (
                    <img src={profileData.profile_image_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{getInitials(profileData.full_name || "T")}</span>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200 gap-0.5">
                    <span className="text-lg">👁️</span>
                    <span className="text-[9px] font-bold text-white tracking-wide">View</span>
                  </div>
                </div>
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <h2
                  className="text-2xl sm:text-3xl font-black tracking-tight"
                  style={{ color: "var(--fg)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
                >
                  {profileData.full_name}
                </h2>
                <p className="text-xs font-mono" style={{ color: "var(--fg-muted)" }}>
                  {profileData.email}
                </p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                  <span className="px-3 py-1 rounded-full text-[11px] font-extrabold"
                    style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent-glow)" }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] mr-1.5 align-middle animate-pulse" />
                    {profileData.contextual_role || "Member"}
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-extrabold"
                    style={{ background: "var(--success-light)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.20)" }}>
                    ✅ Verified
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-extrabold"
                    style={{ background: "var(--warning-light)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.20)" }}>
                    🔥 Habit Tracker
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEGMENT TABS ── */}
        <div
          className="ios-pill-container w-full p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`ios-pill-tab flex-1 py-2.5 ${activeTab === tab.id ? "active" : ""}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">

            {/* ─── OVERVIEW TAB ─── */}
            {activeTab === "overview" && profileData && (
              <div className="space-y-4 animate-fade-in">
                <div
                  className="glass-card rounded-3xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">👤</span>
                    <h3 className="text-sm font-extrabold" style={{ color: "var(--fg)" }}>Account Details</h3>
                    <span className="text-[10px] ml-auto font-medium" style={{ color: "var(--fg-subtle)" }}>Hover a field to edit</span>
                  </div>

                  <EditableField
                    label="Display Name"
                    value={profileData.full_name}
                    onSave={handleUpdateName}
                    saving={savingField === "name"}
                  />
                  <EditableField
                    label="Email Address"
                    value={profileData.email}
                    type="email"
                    onSave={handleUpdateEmail}
                    saving={savingField === "email"}
                  />
                </div>
              </div>
            )}

            {/* ─── APPEARANCE TAB ─── */}
            {activeTab === "appearance" && (
              <div className="space-y-4 animate-fade-in">
                <div
                  className="glass-card rounded-3xl p-6 space-y-5"
                >
                  <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                    🎨 Interface Theme
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        v: "dark", icon: "🌙", label: "Dark Mode", sub: "Fiery dark workspace",
                        accent: "var(--accent)", accentBg: "var(--accent-light)", accentBorder: "var(--accent-glow)",
                      },
                      {
                        v: "light", icon: "☀️", label: "Light Mode", sub: "Clean & bright",
                        accent: "#F59E0B", accentBg: "rgba(245,158,11,0.10)", accentBorder: "rgba(245,158,11,0.25)",
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
                          <div className="text-xs font-bold" style={{ color: theme === opt.v ? opt.accent : "var(--fg)" }}>
                            {opt.label}
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--fg-subtle)" }}>{opt.sub}</div>
                        </div>
                        {theme === opt.v && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                            style={{ background: opt.accent }}>
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
                <div
                  className="glass-card rounded-3xl p-6 space-y-4"
                >
                  <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                    🔐 Change Password
                  </h3>
                  <form onSubmit={handlePasswordMutation} className="space-y-4">
                    {[
                      { label: "Current Password", value: currentPassword, set: setCurrentPassword, key: "current" as const },
                      { label: "New Password", value: newPassword, set: setNewPassword, key: "new" as const },
                      { label: "Confirm New Password", value: confirmPassword, set: setConfirmPassword, key: "confirm" as const },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest block"
                          style={{ color: "var(--fg-muted)" }}>
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100"
                          >
                            {showPw[f.key] ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        className="btn-accent px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md"
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
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
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
            <div
              className="glass-card rounded-3xl p-5 space-y-4 sticky top-20"
            >
              <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
                💡 Quick Tips
              </h3>
              <div className="space-y-3 text-xs">
                {[
                  {
                    icon: "✏️", title: "Edit on hover",
                    body: "Hover over any detail field to reveal the Edit button and update it inline.",
                    accent: "var(--accent)",
                  },
                  {
                    icon: "🔥", title: "Build your streak",
                    body: "Submit daily proofs in your arenas to maintain consistency badges.",
                    accent: "#FF5E00",
                  },
                  {
                    icon: "🔒", title: "Strong passwords",
                    body: "Mix uppercase, numbers & symbols to keep your account secure.",
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
                      <span className="font-extrabold text-[11px]" style={{ color: t.accent }}>{t.title}</span>
                    </div>
                    <p style={{ color: "var(--fg-muted)" }}>{t.body}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <Link
                  href="/dashboard"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition hover:opacity-80 active:scale-95"
                  style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
                >
                  ← Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── DP VIEWER MODAL ── */}
      {showDpViewer && profileData && (
        <div
          onClick={() => { setShowDpViewer(false); setShowDpEdit(false); setProfileImageDraft(""); }}
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
                onClick={() => { setShowDpViewer(false); setShowDpEdit(false); setProfileImageDraft(""); }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition hover:scale-110 active:scale-90"
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
                  background: profileData.profile_image_url
                    ? "transparent"
                    : "var(--accent-gradient)",
                  border: "5px solid var(--accent-glow)",
                  boxShadow: "0 0 48px var(--accent-glow)",
                }}
              >
                {(profileImageDraft || profileData.profile_image_url) ? (
                  <img
                    src={profileImageDraft || profileData.profile_image_url!}
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
                  className="btn-accent w-full py-2.5 rounded-xl text-xs font-extrabold shadow-md"
                >
                  📷 Update Profile Photo
                </button>
              ) : (
                <form onSubmit={handleUpdateDp} className="space-y-3 animate-fade-in">
                  {/* File picker */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl text-xs font-bold transition active:scale-95 border"
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
                    <label className="text-[10px] font-black uppercase tracking-widest block" style={{ color: "var(--fg-muted)" }}>
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
                      onClick={() => { setShowDpEdit(false); setProfileImageDraft(""); }}
                      className="btn-ghost flex-1 py-2 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingImage}
                      className="btn-accent flex-1 py-2 rounded-xl text-xs font-extrabold disabled:opacity-50"
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
                className="btn-ghost flex-1 py-2.5 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteAccount}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white transition active:scale-95 shadow-md"
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
