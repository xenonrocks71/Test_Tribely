"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../utils/api";
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

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

// ── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl animate-shimmer ${className}`}
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
    />
  );
}

export default function UserProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentArenaId = searchParams.get("arena_id");
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [userId, setUserId] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [activePanel, setActivePanel] = useState<"profile" | "settings">("profile");

  const [savingImage, setSavingImage] = useState(false);
  const [profileImageDraft, setProfileImageDraft] = useState("");
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    const storedUserId = localStorage.getItem("tribely_user_id");
    const storedToken = localStorage.getItem("tribely_token");
    if (!storedToken || !storedUserId) { router.push("/login"); return; }

    const parsedId = Number(storedUserId);
    setUserId(parsedId);

    const fetchProfile = async () => {
      try {
        const url = currentArenaId
          ? `/users/profile/${parsedId}?arena_id=${currentArenaId}`
          : `/users/profile/${parsedId}`;
        const res = await api.get(url);
        const data = res.data?.data || null;
        setProfileData(data);
        setProfileImagePreview(data?.profile_image_url || "");
        setProfileImageDraft(data?.profile_image_url || "");
      } catch {
        setError("Could not load profile details.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router, currentArenaId]);

  const { toast } = useToast();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const showSuccess = (msg: string) => {
    toast.success(msg);
  };
  const showError = (msg: string) => {
    toast.error(msg);
  };

  const handlePasswordMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { showError("New password inputs do not match."); return; }
    try {
      await api.post("/users/profile/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      showSuccess("Password updated successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Credential alteration failed.");
    }
  };

  const handleProfileImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileImageDraft.trim()) { showError("Please choose an image or paste an image URL."); return; }
    setSavingImage(true);
    try {
      const res = await api.put("/users/profile/image", {
        profile_image_url: profileImageDraft.trim(),
      });
      const savedUrl = res.data?.data?.profile_image_url || profileImageDraft;
      setProfileImagePreview(savedUrl);
      setProfileImageDraft(savedUrl);
      setProfileData((cur) => cur ? { ...cur, profile_image_url: savedUrl } : cur);
      showSuccess("Profile photo updated successfully.");
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Could not save profile photo.");
    } finally {
      setSavingImage(false);
    }
  };

  const handleProfileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) { setProfileImageDraft(result); setProfileImagePreview(result); }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAccount = () => {
    setShowConfirmDelete(true);
  };

  const executeDeleteAccount = async () => {
    setShowConfirmDelete(false);
    setDeletingAccount(true);
    try {
      await api.delete("/users/profile");
      localStorage.clear();
      toast.success("Account deleted successfully.");
      router.push("/register");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not delete the account.");
    } finally {
      setDeletingAccount(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {/* header skeleton */}
        <div className="h-14 glass border-b" style={{ borderColor: "var(--border)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 space-y-6">
          <div className="rounded-3xl p-8 flex gap-6 items-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <Skeleton className="w-24 h-24 !rounded-2xl shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Skeleton className="h-64" />
              <Skeleton className="h-44" />
            </div>
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "profile", label: "Profile & Photo", icon: "👤" },
    { id: "settings", label: "Security & Settings", icon: "🔒" },
  ] as const;

  const pwInputCls = "input-base focus-accent pr-12";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-30 px-5 md:px-8 h-14 flex items-center justify-between glass"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold transition hover:opacity-70"
          style={{ color: "var(--fg-muted)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>

        <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--fg-subtle)" }}>
          Your Profile
        </span>

        {/* theme toggle */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-2 rounded-full transition hover:scale-110"
          style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6">

        {/* ── ALERTS ── */}
        {error && (
          <div
            className="flex items-start gap-3 px-5 py-4 rounded-2xl text-sm animate-fade-in"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "var(--danger)" }}
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="font-bold hover:opacity-70 shrink-0">✕</button>
          </div>
        )}
        {successMsg && (
          <div
            className="flex items-start gap-3 px-5 py-4 rounded-2xl text-sm animate-fade-in"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "var(--success)" }}
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="flex-1">{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="font-bold hover:opacity-70 shrink-0">✕</button>
          </div>
        )}

        {/* ── PROFILE HERO CARD ── */}
        {profileData && (
          <div
            className="rounded-3xl p-6 md:p-8 overflow-hidden relative animate-fade-in-up"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* background glow */}
            <div
              className="absolute top-0 right-0 w-64 h-32 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at top right, var(--accent-glow2) 0%, transparent 70%)",
                filter: "blur(24px)",
              }}
            />

            <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              {/* avatar */}
              <div className="relative shrink-0">
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white overflow-hidden shadow-lg"
                  style={{
                    background: profileImagePreview
                      ? "transparent"
                      : "linear-gradient(135deg, var(--accent), #0095F6)",
                    border: "3px solid var(--accent)",
                    boxShadow: "0 0 0 4px var(--accent-glow2)",
                  }}
                >
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{getInitials(profileData.full_name || "T")}</span>
                  )}
                </div>
                {/* online dot */}
                <span
                  className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2"
                  style={{ background: "var(--success)", borderColor: "var(--bg-card)" }}
                />
              </div>

              {/* info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--fg)" }}>
                    {profileData.full_name}
                  </h2>
                  <span
                    className="pill"
                    style={{
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                      border: "1px solid rgba(0,122,204,0.25)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                    {profileData.contextual_role || "Member"}
                  </span>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--fg-muted)" }}>{profileData.email}</p>
                <p className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{ color: "var(--fg-subtle)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
                  Account verified and active
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TABS ── */}
        <div
          className="flex gap-1 p-1 rounded-2xl"
          style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: activePanel === tab.id ? "var(--bg-card)" : "transparent",
                color: activePanel === tab.id ? "var(--accent)" : "var(--fg-muted)",
                boxShadow: activePanel === tab.id ? "0 1px 8px var(--accent-glow2)" : "none",
                border: activePanel === tab.id ? "1px solid rgba(0,122,204,0.18)" : "1px solid transparent",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CONTENT GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-16">
          <div className="lg:col-span-2 space-y-5">

            {/* ───────────────── PROFILE TAB ───────────────── */}
            {activePanel === "profile" && (
              <>
                {/* Photo Upload */}
                <div
                  className="rounded-3xl p-6 md:p-8 animate-fade-in-up"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <div className="mb-6">
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                      🖼️ Profile Photo
                    </h3>
                    <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                      Your photo appears across all arenas and in group chats.
                    </p>
                  </div>

                  {/* preview box */}
                  <div
                    className="mb-5 flex items-center justify-center rounded-2xl min-h-44 overflow-hidden"
                    style={{
                      background: "var(--bg-raised)",
                      border: "2px dashed var(--border)",
                    }}
                  >
                    {profileImagePreview ? (
                      <img
                        src={profileImagePreview}
                        alt="Preview"
                        className="max-h-44 max-w-full object-contain rounded-xl"
                      />
                    ) : (
                      <div className="text-center py-6">
                        <span className="text-4xl block mb-2">📸</span>
                        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          Upload or paste a URL to see preview
                        </p>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleProfileImageSubmit} className="space-y-4">
                    {/* file picker */}
                    <div className="flex flex-wrap items-center gap-3">
                      <label
                        className="btn-accent cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold"
                        style={{ boxShadow: "0 4px 16px var(--accent-glow2)" }}
                      >
                        📁 Choose Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfileFileChange}
                        />
                      </label>
                      <span className="text-[11px]" style={{ color: "var(--fg-subtle)" }}>
                        PNG, JPG, WEBP · Max 5 MB
                      </span>
                    </div>

                    {/* or URL */}
                    <div className="space-y-1.5">
                      <label
                        className="text-[10px] font-bold uppercase tracking-widest block"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        Or paste image URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://example.com/photo.jpg"
                        className="input-base focus-accent"
                        value={profileImageDraft.startsWith("data:") ? "" : profileImageDraft}
                        onChange={(e) => {
                          setProfileImageDraft(e.target.value);
                          setProfileImagePreview(e.target.value);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                      <p className="text-[11px]" style={{ color: "var(--fg-subtle)" }}>
                        💡 Preview updates instantly. Click Save when ready.
                      </p>
                      <button
                        type="submit"
                        disabled={savingImage}
                        className="btn-accent flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold disabled:opacity-50"
                      >
                        {savingImage ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Saving…
                          </>
                        ) : "✓ Save Photo"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Profile Details */}
                <div
                  className="rounded-3xl p-6 md:p-8 animate-fade-in-up delay-100"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <h3 className="text-base font-bold mb-5" style={{ color: "var(--fg)" }}>
                    Profile Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Display Name", value: profileData?.full_name },
                      { label: "Email Address", value: profileData?.email },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="p-5 rounded-2xl"
                        style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
                      >
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest mb-2"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          {field.label}
                        </p>
                        <p className="text-sm font-semibold break-all" style={{ color: "var(--fg)" }}>
                          {field.value || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ───────────────── SETTINGS TAB ───────────────── */}
            {activePanel === "settings" && (
              <>
                {/* Theme Toggle */}
                <div
                  className="rounded-3xl p-6 md:p-8 animate-fade-in-up"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <div className="mb-6">
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                      🎨 Appearance & Theme
                    </h3>
                    <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                      Choose your preferred interface theme across Tribely.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { v: "dark", icon: "🌙", label: "Dark Mode", sub: "Sleek dark surface" },
                      { v: "light", icon: "☀️", label: "Light Mode", sub: "Clean light surface" },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setTheme(opt.v as "dark" | "light")}
                        className="flex flex-col items-center gap-2 p-5 rounded-2xl transition-all duration-200"
                        style={{
                          background: theme === opt.v ? "var(--accent-light)" : "var(--bg-raised)",
                          border: `2px solid ${theme === opt.v ? "var(--accent)" : "var(--border)"}`,
                          color: theme === opt.v ? "var(--accent)" : "var(--fg-muted)",
                          boxShadow: theme === opt.v ? "0 4px 16px var(--accent-glow2)" : "none",
                        }}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <span className="text-sm font-bold" style={{ color: theme === opt.v ? "var(--accent)" : "var(--fg)" }}>
                          {opt.label}
                        </span>
                        <span className="text-[11px]" style={{ color: "var(--fg-subtle)" }}>{opt.sub}</span>
                        {theme === opt.v && (
                          <span
                            className="pill"
                            style={{ background: "var(--accent)", color: "#fff", border: "none" }}
                          >
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change Password */}
                <div
                  className="rounded-3xl p-6 md:p-8 animate-fade-in-up delay-100"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <div className="mb-6">
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--fg)" }}>
                      🔐 Change Password
                    </h3>
                    <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                      Use a strong, unique password to protect your account.
                    </p>
                  </div>

                  <form onSubmit={handlePasswordMutation} className="space-y-4">
                    {[
                      { label: "Current Password", value: currentPassword, setter: setCurrentPassword, show: showCurrentPw, toggle: () => setShowCurrentPw(!showCurrentPw) },
                      { label: "New Password", value: newPassword, setter: setNewPassword, show: showNewPw, toggle: () => setShowNewPw(!showNewPw) },
                      { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword, show: showConfirmPw, toggle: () => setShowConfirmPw(!showConfirmPw) },
                    ].map((field) => (
                      <div key={field.label} className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: "var(--fg-muted)" }}>
                          {field.label}
                        </label>
                        <div className="relative">
                          <input
                            type={field.show ? "text" : "password"}
                            required
                            value={field.value}
                            onChange={(e) => field.setter(e.target.value)}
                            className={pwInputCls}
                          />
                          <button
                            type="button"
                            onClick={field.toggle}
                            className="absolute right-4 top-1/2 -translate-y-1/2 transition hover:opacity-70"
                            style={{ color: "var(--fg-muted)" }}
                          >
                            {field.show ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.657-.657A9.97 9.97 0 0112 6c2.708 0 5.168 1.075 6.976 2.818M3 3l18 18" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between gap-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                      <p className="text-[11px]" style={{ color: "var(--fg-subtle)" }}>
                        🔒 Use uppercase, numbers & symbols.
                      </p>
                      <button
                        type="submit"
                        className="btn-accent flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold"
                      >
                        ✓ Update Password
                      </button>
                    </div>
                  </form>
                </div>

                {/* Danger Zone */}
                <div
                  className="rounded-3xl p-6 md:p-8 animate-fade-in-up delay-200"
                  style={{
                    background: "rgba(239,68,68,0.04)",
                    border: "1px solid rgba(239,68,68,0.22)",
                  }}
                >
                  <div className="mb-4">
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--danger)" }}>
                      ⚠️ Danger Zone
                    </h3>
                    <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                      This action is permanent and cannot be undone.
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--fg-muted)" }}>
                    Deleting your account will permanently remove your profile, all arena memberships, and activity history. You will not be able to recover this data.
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50"
                    style={{ background: "var(--danger)" }}
                  >
                    {deletingAccount ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Deleting…
                      </>
                    ) : "🗑️ Delete My Account"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="lg:col-span-1">
            <div
              className="rounded-3xl p-6 sticky top-20 space-y-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h3 className="text-sm font-bold" style={{ color: "var(--fg)" }}>💡 Quick Tips</h3>
              <div className="space-y-3">
                {[
                  { color: "rgba(0,122,204,0.10)", border: "rgba(0,122,204,0.20)", text: "#007ACC", title: "Profile Photo", body: "Used across all arenas and visible in group chats." },
                  { color: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.20)", text: "#8B5CF6", title: "Strong Password", body: "Use uppercase, numbers & symbols for safety." },
                  { color: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)", text: "#10B981", title: "Stay Secure", body: "Never share your password with anyone." },
                  { color: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.18)", text: "#EF4444", title: "Account Deletion", body: "Permanent — all data will be erased." },
                ].map((tip) => (
                  <div
                    key={tip.title}
                    className="p-3.5 rounded-2xl text-xs leading-relaxed"
                    style={{ background: tip.color, border: `1px solid ${tip.border}` }}
                  >
                    <span className="font-bold block mb-0.5" style={{ color: tip.text }}>{tip.title}</span>
                    <span style={{ color: "var(--fg-muted)" }}>{tip.body}</span>
                  </div>
                ))}
              </div>

              {/* Quick nav back */}
              <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <Link
                  href="/dashboard"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition hover:opacity-80"
                  style={{
                    background: "var(--bg-raised)",
                    border: "1px solid var(--border)",
                    color: "var(--fg-muted)",
                  }}
                >
                  ← Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      {showConfirmDelete && (
        <div
          onClick={() => setShowConfirmDelete(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(12px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold flex items-center gap-2 text-red-500">
                ⚠️ Delete Account
              </h3>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition hover:bg-[var(--bg-raised)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Are you sure you want to permanently delete your Tribely account? All profile data, arena memberships, and activity logs will be permanently erased.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition hover:bg-[var(--bg-raised)] border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteAccount}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white transition shadow-lg"
                style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
