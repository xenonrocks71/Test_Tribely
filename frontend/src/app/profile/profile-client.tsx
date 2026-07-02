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
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] text-slate-500 flex items-center justify-center font-sans text-xs">
        Loading your profile...
      </div>
    );
  }

  const avatarSource =
    profileImagePreview || profileData?.profile_image_url || "";
  const avatarInitials = (profileData?.full_name || "U")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 bg-linear-to-b from-white via-[#F5F7FB] to-transparent pointer-events-none" />
      <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full bg-[#2F80ED]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-44 -left-24 h-80 w-80 rounded-full bg-[#10B981]/10 blur-3xl pointer-events-none" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-6">
          <Link
            href={currentArenaId ? `/arena/${currentArenaId}` : "/dashboard"}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-900"
          >
            <span>←</span>
            <span>Back</span>
          </Link>
          <span className="text-[11px] font-medium tracking-[0.22em] text-slate-400 uppercase">
            Tribely Profile
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[30px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-inner">
                  {avatarSource ? (
                    <img
                      src={avatarSource}
                      alt="Profile photo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-900 to-slate-700 text-xl font-bold text-white">
                      {avatarInitials}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Signed in
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    {profileData?.full_name}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {profileData?.email}
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  profileData?.contextual_role === "Admin"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {profileData?.contextual_role}
                {currentArenaId ? ` · Arena #${currentArenaId}` : " · Network"}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Account
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {profileData?.full_name}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Email
                </p>
                <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                  {profileData?.email}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Mode
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {currentArenaId ? "Arena-linked" : "Standalone"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActivePanel("profile")}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activePanel === "profile"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("settings")}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activePanel === "settings"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Settings
              </button>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMsg}
              </div>
            )}

            {activePanel === "profile" ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[28px] border border-slate-200 bg-[#F8FAFC] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                        Profile Photo
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        Make it yours
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                        Upload a clean image or paste a direct image URL.
                        Tribely saves it to your account and shows it across the
                        profile surface.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleProfileImageSubmit}
                    className="mt-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                        Choose image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfileFileChange}
                        />
                      </label>
                      <span className="text-sm text-slate-500">
                        PNG, JPG, WEBP
                      </span>
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Image URL or Data URL
                      </label>
                      <input
                        type="text"
                        value={profileImageDraft}
                        onChange={(e) => setProfileImageDraft(e.target.value)}
                        placeholder="Paste a direct image link or select a file above"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs leading-5 text-slate-500">
                        The preview updates immediately. Save when you’re happy
                        with it.
                      </p>
                      <button
                        type="submit"
                        disabled={savingImage}
                        className="inline-flex items-center justify-center rounded-full bg-[#2F80ED] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingImage ? "Saving..." : "Save photo"}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Profile details
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Display name
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {profileData?.full_name}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Email address
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {profileData?.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Security
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    Change password
                  </h2>
                  <form
                    onSubmit={handlePasswordMutation}
                    className="mt-5 space-y-4"
                  >
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Current password
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        New password
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Confirm new password
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <p className="text-xs leading-5 text-slate-500">
                        Keep this strong and unique. It is used across your
                        Tribely session.
                      </p>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Update password
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose-400">
                    Danger zone
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-rose-900">
                    Delete account
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-rose-700">
                    This permanently removes your profile and related account
                    data.
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deletingAccount ? "Deleting..." : "Delete account"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-[30px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Quick summary
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Clean, private, and easy to manage
            </h2>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                Your profile image is stored on your account and shown in the
                profile UI.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                The settings panel keeps password changes and account deletion
                in one place.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                The whole screen uses a light iOS-style surface to match the
                rest of Tribely’s polished feel.
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
