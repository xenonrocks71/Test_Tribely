"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon,
  Sun,
  Laptop,
  Check,
  X,
  Lock,
  KeyRound,
  User,
  Shield,
  Zap,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  Camera,
  Upload,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";
import { authService } from "@/services/auth.service";
import { apiClient, resolveBackendUrl } from "@/lib/api-client";
import { tribelyService } from "@/services/tribely.service";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: "main" | "edit-profile" | "change-password";
}

type ModalView = "main" | "edit-profile" | "change-password";

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  initialView = "main",
}) => {
  const router = useRouter();
  const { theme, themeMode, setThemeMode, toggleTheme } = useTheme();
  const { user, updateUserProfile, triggerHaptic, showToast } = useApp();

  const [activeView, setActiveView] = useState<ModalView>(initialView);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Edit Profile Form State
  const [fullNameDraft, setFullNameDraft] = useState(user.name);
  const [usernameDraft, setUsernameDraft] = useState(user.username || "");
  const [phoneDraft, setPhoneDraft] = useState(user.phone || "");
  const [bioDraft, setBioDraft] = useState(user.bio || "Building daily habits with Tribely 🚀");
  const [avatarDraft, setAvatarDraft] = useState(user.avatar);
  const [uploadedServerUrl, setUploadedServerUrl] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isUpdatingPw, setIsUpdatingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Reset view when opened
  React.useEffect(() => {
    if (isOpen) {
      setActiveView(initialView || "main");
      setShowLogoutConfirm(false);
      setFullNameDraft(user.name);
      setUsernameDraft(user.username || "");
      setPhoneDraft(user.phone || "");
      setBioDraft(user.bio || "Building daily habits with Tribely 🚀");
      setAvatarDraft(user.avatar);
      setUploadedServerUrl(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwError(null);
    }
  }, [isOpen, initialView, user.name, user.username, user.phone, user.bio, user.avatar]);

  // 1-Tap Theme Inversion Handler: If light -> dark; If dark -> light
  const handleToggleTheme = () => {
    triggerHaptic([15, 25]);
    const nextResolved = theme === "dark" ? "light" : "dark";
    toggleTheme();
    showToast(
      nextResolved === "dark"
        ? "🌙 Switched to Dark Theme"
        : "☀️ Switched to Light Theme",
      "info"
    );
  };

  // Handle System Default
  const handleSetSystem = () => {
    triggerHaptic([15]);
    setThemeMode("system");
    showToast("💻 Theme set to System Default", "info");
  };

  // Handle Logout
  const handleLogout = () => {
    triggerHaptic([30, 40]);
    authService.logout();
    showToast("👋 Logged out successfully. See you tomorrow!", "info");
    onClose();
    router.push("/login");
  };

  // Handle Avatar Direct File Upload & Preview
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file (PNG, JPG, or WebP)", "info");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Photo must be less than 5MB", "info");
      return;
    }

    triggerHaptic([15]);

    // Fast optimistic preview: immediately show on the avatar circle!
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarDraft(reader.result);
      }
    };
    reader.readAsDataURL(file);

    setIsUploadingAvatar(true);
    try {
      const res = await authService.uploadAvatar(file, file.name);
      if (res && res.url) {
        const fullResolvedUrl = resolveBackendUrl(res.url);
        setUploadedServerUrl(fullResolvedUrl);
        setAvatarDraft(fullResolvedUrl);
        showToast("📸 Actual photo ready! Click Save Profile to apply.", "success");
      }
    } catch (err) {
      console.warn("Avatar direct upload error, using local preview:", err);
      showToast("Photo selected! Click Save Profile to apply.", "info");
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullNameDraft.trim()) {
      showToast("Please enter your display name", "info");
      return;
    }

    setIsSavingProfile(true);
    triggerHaptic([20]);

    try {
      const rawDraft = avatarDraft.trim();
      let finalAvatar = "";
      if (uploadedServerUrl) {
        finalAvatar = uploadedServerUrl;
      } else if (rawDraft) {
        finalAvatar = rawDraft.startsWith("data:") ? rawDraft : resolveBackendUrl(rawDraft);
      } else {
        finalAvatar = user.avatar;
      }

      const payload: Record<string, any> = {
        full_name: fullNameDraft.trim(),
        username: usernameDraft.trim() || undefined,
        phone_number: phoneDraft.trim() || undefined,
        bio: bioDraft.trim(),
      };

      // Attach profile avatar URL (server URL or base64 data URI fallback)
      if (finalAvatar) {
        payload.profile_image_url = finalAvatar;
        payload.avatar_url = finalAvatar;
      }

      const result = await tribelyService.updateProfileDetails(payload);
      if (!result.success) {
        showToast(result.message || "Failed to update profile", "info");
        setIsSavingProfile(false);
        return;
      }

      // Use avatar from server response if available, else use our local value
      const rawConfirmed =
        result.data?.profile_image_url ||
        result.data?.avatar_url ||
        finalAvatar ||
        "";
      const confirmedAvatar = rawConfirmed ? resolveBackendUrl(rawConfirmed) : "";

      // Update local app context with confirmed values — this immediately updates sidebar/nav
      updateUserProfile({
        name: fullNameDraft.trim(),
        username: usernameDraft.trim() || user.username,
        phone: phoneDraft.trim(),
        bio: bioDraft.trim(),
        avatar: confirmedAvatar,
      });

      showToast("✨ Profile updated successfully!", "success");
      setActiveView("main");
      onClose();
    } catch {
      showToast("Could not save profile to database", "info");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Update
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);

    if (!currentPassword) {
      setPwError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }

    setIsUpdatingPw(true);
    triggerHaptic([20]);

    try {
      const res = await tribelyService.changePassword(currentPassword, newPassword);
      if (res.success) {
        showToast("🔒 Password changed successfully in database!", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setActiveView("main");
      } else {
        setPwError(res.message);
        showToast(res.message, "info");
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to update password. Check current password.";
      setPwError(msg);
      showToast(msg, "info");
    } finally {
      setIsUpdatingPw(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Google Material 3 Settings Sheet / Dialog */}
          <motion.div
            initial={{ y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-t-[32px] sm:rounded-[28px] p-5 sm:p-6 text-neutral-900 dark:text-neutral-100 shadow-2xl z-10 max-h-[88vh] overflow-y-auto no-scrollbar scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Grab Handle for mobile */}
            <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto mb-3 sm:hidden" />

            {/* ── VIEW 1: MAIN SETTINGS & ACTIVITY ── */}
            {activeView === "main" && (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#E8EAED] dark:border-[#303134]">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                      Settings & activity
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      @{user.username} • Account preferences
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 1. Google Material 3 Appearance & Theme Segment Selector */}
                <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                      <span>Appearance Theme</span>
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 capitalize">
                      {themeMode === "system" ? "System Default" : `${theme} Mode`}
                    </span>
                  </div>

                  {/* 3-Way Segmented Control */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-[#1A1A1A] border border-neutral-200/80 dark:border-neutral-700/80 rounded-full text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic([10]);
                        setThemeMode("light");
                        showToast("☀️ Light Theme enabled", "info");
                      }}
                      className={`py-2 px-3 rounded-full font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        themeMode === "light"
                          ? "bg-[#1A73E8] text-white shadow-xs font-semibold"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#282A2D]"
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic([10]);
                        setThemeMode("dark");
                        showToast("🌙 Dark Theme enabled", "info");
                      }}
                      className={`py-2 px-3 rounded-full font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        themeMode === "dark"
                          ? "bg-[#1A73E8] text-white dark:bg-[#8AB4F8] dark:text-[#202124] shadow-xs font-semibold"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#282A2D]"
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic([10]);
                        setThemeMode("system");
                        showToast("💻 Set to System Default", "info");
                      }}
                      className={`py-2 px-3 rounded-full font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        themeMode === "system"
                          ? "bg-[#1A73E8] text-white dark:bg-[#8AB4F8] dark:text-[#202124] shadow-xs font-semibold"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#282A2D]"
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>System</span>
                    </button>
                  </div>
                </div>

                {/* 2. Google Material Account Options Tiles */}
                <div className="space-y-2">
                  {/* Edit Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setActiveView("edit-profile");
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] hover:bg-neutral-50 dark:hover:bg-[#282A2D] transition cursor-pointer text-left group shadow-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center transition">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                          Edit Profile
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Update your name, bio, and profile avatar
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition" />
                  </button>

                  {/* Change Password */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setActiveView("change-password");
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] hover:bg-neutral-50 dark:hover:bg-[#282A2D] transition cursor-pointer text-left group shadow-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center transition">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                          Change Password
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Manage account security and credentials
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition" />
                  </button>

                  {/* Habit Vault Balance Card */}
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                          Habit Vault Balance
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          ⚡ {user.kudosBalance} Kudos available
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] border border-[#CEEAD6] dark:border-[#0F9D58]/30 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  </div>
                </div>

                {/* 3. Log Out Button */}
                <div className="pt-3 border-t border-[#E8EAED] dark:border-[#303134]">
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="w-full py-3 px-4 rounded-full border border-[#FAD2CF] dark:border-[#652525] bg-[#FCE8E6]/40 dark:bg-[#3C1E1E]/40 hover:bg-[#FCE8E6] dark:hover:bg-[#3C1E1E] text-[#C5221F] dark:text-[#F28B82] text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out (@{user.username})</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── VIEW 2: EDIT PROFILE ── */}
            {activeView === "edit-profile" && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] dark:border-[#303134]">
                  <button
                    type="button"
                    onClick={() => setActiveView("main")}
                    className="flex items-center gap-1 text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Edit Profile
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Avatar Picker (Direct Click or Upload - Zero Link Pasting) */}
                  <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] transition">
                    <div className="flex items-center gap-4">
                      {/* Interactive Avatar Circle with Hover Overlay */}
                      <div
                        onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                        className="relative group shrink-0 w-20 h-20 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8]"
                        title="Click to change profile photo"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            avatarInputRef.current?.click();
                          }
                        }}
                      >
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#1A73E8] dark:border-[#8AB4F8] bg-neutral-100 dark:bg-neutral-800 relative shadow-xs">
                          <AvatarWithFallback
                            avatarUrl={avatarDraft && !avatarDraft.includes("dicebear.com") ? avatarDraft : ""}
                            name={fullNameDraft || user.name}
                            sizeClass="w-full h-full"
                            textClass="text-2xl font-bold"
                            className={`transition-transform duration-200 group-hover:scale-105 ${isUploadingAvatar ? "opacity-40" : "opacity-100"}`}
                          />

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                            <Camera className="w-5 h-5 drop-shadow-xs mb-0.5" />
                            <span className="text-[10px] font-semibold tracking-tight">Change</span>
                          </div>

                          {/* Uploading Spinner Overlay */}
                          {isUploadingAvatar && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-1">
                              <Loader2 className="w-5 h-5 animate-spin text-[#8AB4F8]" />
                              <span className="text-[9px] font-medium tracking-tight">Uploading...</span>
                            </div>
                          )}
                        </div>

                        {/* Camera Badge Pip */}
                        <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white border-2 border-white dark:border-[#202124] shadow-xs group-hover:scale-110 transition">
                          <Camera className="w-3 h-3 stroke-[2.5]" />
                        </div>
                      </div>

                      {/* Photo Actions & Details */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-neutral-900 dark:text-white">
                              Profile Photo
                            </h4>
                            {avatarDraft !== user.avatar && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                New Photo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                            Click the photo or button below to choose an image from your device.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium shadow-xs transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                          >
                            {isUploadingAvatar ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload Photo</span>
                              </>
                            )}
                          </button>

                          {avatarDraft !== user.avatar && (
                            <button
                              type="button"
                              onClick={() => {
                                setAvatarDraft(user.avatar);
                                setUploadedServerUrl(null);
                                showToast("Restored original profile photo", "info");
                              }}
                              className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
                          Supports PNG, JPG, WebP (up to 5MB)
                        </div>
                      </div>
                    </div>

                    {/* Hidden Native File Input */}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                    />
                  </div>


                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullNameDraft}
                      onChange={(e) => setFullNameDraft(e.target.value)}
                      placeholder="Your full name"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                    />
                  </div>

                  {/* Username Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Username Handle
                      </label>
                      <span className="text-[10px] text-neutral-400">
                        Letters, numbers, underscores
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-bold text-neutral-400">@</span>
                      <input
                        type="text"
                        value={usernameDraft}
                        onChange={(e) => setUsernameDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        placeholder="username"
                        minLength={3}
                        maxLength={30}
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-xl text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                      />
                    </div>
                  </div>

                  {/* Email (Permanent Account Identifier) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-neutral-400" />
                        <span>Email Address</span>
                      </label>
                      <span className="text-[10px] font-medium text-[#0F9D58] bg-[#E6F4EA] dark:bg-[#0F9D58]/15 px-2 py-0.5 rounded-md border border-[#CEEAD6] dark:border-[#0F9D58]/30">
                        Verified Primary
                      </span>
                    </div>
                    <input
                      type="email"
                      value={user.email || "Registered account email"}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-[#F1F3F4] dark:bg-[#282A2D] border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed select-all"
                    />
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Primary email is bound to your account reputation and cannot be changed.
                    </p>
                  </div>

                  {/* Phone Number Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                    />
                  </div>

                  {/* Bio Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Bio
                      </label>
                      <span className="text-[10px] text-neutral-400">
                        {bioDraft.length}/150
                      </span>
                    </div>
                    <textarea
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value.slice(0, 150))}
                      rows={3}
                      placeholder="Write something about your habits and goals..."
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition resize-none"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="pt-2 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveView("main")}
                      className="flex-1 py-2.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#282A2D] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile || isUploadingAvatar}
                      className="flex-1 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] text-white dark:text-[#202124] text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <div className="w-4 h-4 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save Profile</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── VIEW 3: CHANGE PASSWORD ── */}
            {activeView === "change-password" && (
              <form onSubmit={handleSavePassword} className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] dark:border-[#303134]">
                  <button
                    type="button"
                    onClick={() => setActiveView("main")}
                    className="flex items-center gap-1 text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Change Password
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3.5">
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Your new password must be at least 6 characters and should include a combination of numbers and letters.
                  </p>

                  {pwError && (
                    <div className="p-3.5 rounded-xl bg-[#FCE8E6] dark:bg-[#3C1E1E] border border-[#FAD2CF] dark:border-[#652525] text-[#C5221F] dark:text-[#F28B82] text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{pwError}</span>
                    </div>
                  )}

                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveView("main")}
                      className="flex-1 py-2.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#282A2D] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingPw}
                      className="flex-1 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] text-white dark:text-[#202124] text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isUpdatingPw ? (
                        <div className="w-4 h-4 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── LOGOUT CONFIRMATION POPUP ── */}
            <AnimatePresence>
              {showLogoutConfirm && (
                <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    className="w-full max-w-xs bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-3xl p-6 text-center shadow-2xl space-y-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#FCE8E6] dark:bg-[#3C1E1E] text-[#C5221F] dark:text-[#F28B82] flex items-center justify-center mx-auto">
                      <LogOut className="w-6 h-6" />
                    </div>

                    <h4 className="text-base font-semibold text-neutral-900 dark:text-white">
                      Sign out of Tribely?
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      You will need to enter your credentials to access your squads again.
                    </p>

                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-2.5 rounded-full bg-[#D93025] hover:bg-[#B3261E] text-white text-xs font-medium transition cursor-pointer shadow-xs"
                      >
                        Sign Out
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(false)}
                        className="w-full py-2.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#282A2D] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
