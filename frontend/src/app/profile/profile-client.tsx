"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../utils/api";

type ProfileData = {
  full_name: string;
  email: string;
  contextual_role: string;
  profile_image_url?: string | null;
};

export default function UserProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentArenaId = searchParams.get("arena_id");

  const [userId, setUserId] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [activePanel, setActivePanel] = useState<"profile" | "settings">(
    "profile",
  );
  const [savingImage, setSavingImage] = useState(false);
  const [profileImageDraft, setProfileImageDraft] = useState("");
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const storedUserId = localStorage.getItem("tribely_user_id");
    const storedToken = localStorage.getItem("tribely_token");

    if (!storedToken || !storedUserId) {
      router.push("/login");
      return;
    }

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

  const handlePasswordMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setError("New password inputs mismatch.");
      return;
    }

    try {
      await api.post("/users/profile/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccessMsg("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      const detail =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { detail?: string } } }).response
          ?.data?.detail === "string"
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : "Credential alteration failure encountered.";
      setError(detail ?? "Credential alteration failure encountered.");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleProfileImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!profileImageDraft.trim()) {
      setError("Please choose a profile image or paste an image URL.");
      return;
    }

    setSavingImage(true);
    try {
      const res = await api.put("/users/profile/image", {
        profile_image_url: profileImageDraft.trim(),
      });

      const savedUrl = res.data?.data?.profile_image_url || profileImageDraft;
      setProfileImagePreview(savedUrl);
      setProfileImageDraft(savedUrl);
      setProfileData((current) =>
        current ? { ...current, profile_image_url: savedUrl } : current,
      );
      setSuccessMsg("Profile image updated successfully.");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      const detail =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { detail?: string } } }).response
          ?.data?.detail === "string"
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : "Could not save profile image.";
      setError(detail ?? "Could not save profile image.");
      setTimeout(() => setError(""), 5000);
    } finally {
      setSavingImage(false);
    }
  };

  const handleProfileFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        setProfileImageDraft(result);
        setProfileImagePreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAccount = async () => {
    setError("");
    setSuccessMsg("");

    const confirmed = window.confirm(
      "Delete your Tribely account? This removes your profile, memberships, and activity history.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingAccount(true);
    try {
      await api.delete("/users/profile");
      localStorage.removeItem("tribely_token");
      localStorage.removeItem("tribely_user_id");
      router.push("/register");
    } catch (err: unknown) {
      const detail =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { detail?: string } } }).response
          ?.data?.detail === "string"
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : "Could not delete the account.";
      setError(detail ?? "Could not delete the account.");
      setTimeout(() => setError(""), 5000);
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Header Skeleton */}
        <div className="border-b border-slate-200 bg-white/80 backdrop-blur px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="h-6 w-20 rounded-lg bg-slate-200 animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
        </div>

        {/* Main Content Skeleton */}
        <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
          {/* Profile Header Skeleton */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <div className="h-24 w-24 rounded-2xl bg-slate-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-3 w-full">
                <div className="h-6 w-32 rounded-lg bg-slate-200 animate-pulse" />
                <div className="h-4 w-48 rounded-lg bg-slate-200 animate-pulse" />
                <div className="h-4 w-40 rounded-lg bg-slate-200 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Tabs Skeleton */}
          <div className="flex gap-3 mb-6">
            <div className="h-10 w-24 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-10 w-24 rounded-xl bg-slate-200 animate-pulse" />
          </div>

          {/* Content Cards Skeleton */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 h-48 animate-pulse" />
            <div className="rounded-2xl border border-slate-200 bg-white p-6 h-32 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur px-4 md:px-6 py-3 flex justify-between items-center shadow-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          ← Back
        </Link>
        <h1 className="text-sm font-bold tracking-widest text-slate-400 uppercase">
          Tribely Profile
        </h1>
        <div className="w-6" />
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-red-200 bg-red-50 p-4 flex gap-3 items-start">
            <span className="text-xl leading-none mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-600 transition"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-green-200 bg-green-50 p-4 flex gap-3 items-start">
            <span className="text-xl leading-none mt-0.5">✓</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">Success</p>
              <p className="text-sm text-green-700 mt-0.5">{successMsg}</p>
            </div>
            <button
              onClick={() => setSuccessMsg("")}
              className="text-green-400 hover:text-green-600 transition"
            >
              ✕
            </button>
          </div>
        )}

        {/* Profile Header Card */}
        {profileData && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-[#5B4DFF] to-[#2F80ED] flex items-center justify-center text-3xl font-bold text-white overflow-hidden border-2 border-slate-200 shadow-md">
                  {profileImagePreview ? (
                    <img
                      src={profileImagePreview}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{(profileData.full_name || "T").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-950">
                    {profileData.full_name}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#5B4DFF]/10 border border-[#5B4DFF]/20 text-xs font-bold text-[#5B4DFF] uppercase tracking-wide w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5B4DFF]" />
                    {profileData.contextual_role || "Member"}
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-medium">
                  {profileData.email}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Account verified and active
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {[
            { id: "profile", label: "Profile & Photo", icon: "👤" },
            { id: "settings", label: "Security & Settings", icon: "🔒" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActivePanel(tab.id as "profile" | "settings")
              }
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                activePanel === tab.id
                  ? "border-[#5B4DFF] text-[#5B4DFF]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {activePanel === "profile" ? (
              <>
                {/* Profile Photo Section */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                      <span>🖼️</span> Profile Photo
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Your profile image appears across Tribely and in all arenas.
                    </p>
                  </div>

                  {/* Photo Preview */}
                  <div className="mb-6 p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center min-h-48">
                    {profileImagePreview ? (
                      <img
                        src={profileImagePreview}
                        alt="Preview"
                        className="max-h-48 max-w-full rounded-2xl object-cover shadow-md"
                      />
                    ) : (
                      <div className="text-center">
                        <span className="text-4xl block mb-2">📸</span>
                        <p className="text-sm text-slate-500">
                          Upload or paste an image to see preview
                        </p>
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={handleProfileImageSubmit}
                    className="space-y-5"
                  >
                    {/* File Upload */}
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#5B4DFF] hover:bg-[#4B3EEB] px-5 py-3 text-sm font-semibold text-white transition active:scale-95">
                        <span>📁</span> Choose Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfileFileChange}
                        />
                      </label>
                      <span className="ml-3 text-xs text-slate-500 font-medium">
                        PNG, JPG, WEBP (Max 5MB)
                      </span>
                    </div>

                    {/* URL Input */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Image URL or Data URL
                      </label>
                      <input
                        type="text"
                        value={profileImageDraft}
                        onChange={(e) => setProfileImageDraft(e.target.value)}
                        placeholder="Paste a direct image link or select a file above"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5B4DFF] focus:ring-4 focus:ring-[#5B4DFF]/10"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <p className="text-xs text-slate-500">
                        💡 Preview updates instantly. Save when ready.
                      </p>
                      <button
                        type="submit"
                        disabled={savingImage}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B4DFF] hover:bg-[#4B3EEB] px-6 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingImage ? (
                          <>
                            <span className="animate-spin">⟳</span> Saving...
                          </>
                        ) : (
                          <>
                            <span>✓</span> Save Photo
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Profile Details */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950 mb-5">
                    Profile Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Display Name
                      </p>
                      <p className="text-base font-semibold text-slate-950">
                        {profileData?.full_name || "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Email Address
                      </p>
                      <p className="text-base font-semibold text-slate-950 break-all">
                        {profileData?.email || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Change Password Section */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                      <span>🔐</span> Change Password
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Update your password to keep your account secure.
                    </p>
                  </div>

                  <form
                    onSubmit={handlePasswordMutation}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5B4DFF] focus:ring-4 focus:ring-[#5B4DFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5B4DFF] focus:ring-4 focus:ring-[#5B4DFF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5B4DFF] focus:ring-4 focus:ring-[#5B4DFF]/10"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-3">
                      <p className="text-xs text-slate-500">
                        🔒 Use a strong, unique password.
                      </p>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B4DFF] hover:bg-[#4B3EEB] px-6 py-3 text-sm font-bold text-white transition active:scale-95"
                      >
                        <span>✓</span> Update Password
                      </button>
                    </div>
                  </form>
                </div>

                {/* Delete Account - Danger Zone */}
                <div className="rounded-3xl border border-red-200 bg-red-50/50 p-6 md:p-8 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                      <span>⚠️</span> Danger Zone
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      This action is permanent and cannot be undone.
                    </p>
                  </div>

                  <p className="text-sm text-red-700 mb-5 leading-relaxed">
                    Deleting your account will permanently remove your profile,
                    all arena memberships, and activity history. You will not
                    be able to recover this data.
                  </p>

                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-6 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deletingAccount ? (
                      <>
                        <span className="animate-spin">⟳</span> Deleting...
                      </>
                    ) : (
                      <>
                        <span>🗑️</span> Delete Account
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sidebar - Quick Info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sticky top-24">
              <h3 className="text-sm font-bold text-slate-950 mb-4">
                💡 Quick Tips
              </h3>
              <div className="space-y-3">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <p className="text-xs text-blue-900 leading-relaxed">
                    <span className="font-bold">Profile Photo:</span> Used across
                    all arenas and your profile.
                  </p>
                </div>
                <div className="rounded-xl bg-purple-50 border border-purple-100 p-3">
                  <p className="text-xs text-purple-900 leading-relaxed">
                    <span className="font-bold">Strong Password:</span> Use
                    uppercase, numbers & symbols.
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                  <p className="text-xs text-green-900 leading-relaxed">
                    <span className="font-bold">Stay Secure:</span> Never share
                    your password.
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                  <p className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold">Account Deletion:</span> This is
                    permanent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
