"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { dataCache } from "@/app/utils/dataCache";
import { useTheme } from "@/context/ThemeContext";
import {
  Eye,
  EyeOff,
  Flame,
  Sun,
  Moon,
  Coins,
  Check,
  CheckCircle2,
  XCircle,
  Camera,
  Upload,
  ArrowRight,
  RefreshCw,
  User,
  Mail,
  Trash2,
  Sparkles,
  ShieldCheck
} from "lucide-react";

// Curated avatar presets for 1-click fallback selection
const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
];

function RegisterContent() {
  const router = useRouter();
  const { theme, toggleTheme, isMounted } = useTheme();
  const isDark = theme === "dark";

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Profile Picture (DP)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameMsg, setUsernameMsg] = useState("");

  // OTP Verification state
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [cooldown, setCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // General loading, error, and success state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // 60-second cooldown timer for resending OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Real-time debounced username checker
  useEffect(() => {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setUsernameStatus("idle");
      setUsernameMsg("");
      return;
    }
    if (cleanUser.length < 3) {
      setUsernameStatus("taken");
      setUsernameMsg("Minimum 3 characters.");
      return;
    }

    setUsernameStatus("checking");
    const handler = setTimeout(async () => {
      try {
        const res = await authService.checkUsername(cleanUser);
        if (res.available) {
          setUsernameStatus("available");
          setUsernameMsg("Available");
        } else {
          setUsernameStatus("taken");
          setUsernameMsg(res.message || "Taken");
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [username]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // -------------------------------------------------------------
  // CAMERA / WEBCAM HELPERS
  // -------------------------------------------------------------
  const openCamera = async () => {
    setCameraError(null);
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
    } catch (err) {
      setCameraError("Camera permission denied. You can upload a photo instead.");
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

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    stopCamera();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setUploadingAvatar(true);
      try {
        const res = await authService.uploadAvatar(blob, `snap_${Date.now()}.jpg`);
        setAvatarUrl(res.url);
      } catch {
        setError("Failed to save captured photo.");
      } finally {
        setUploadingAvatar(false);
      }
    }, "image/jpeg", 0.88);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be less than 5MB.");
      return;
    }

    setUploadingAvatar(true);
    setError("");
    try {
      const res = await authService.uploadAvatar(file, file.name);
      setAvatarUrl(res.url);
    } catch {
      setError("Failed to upload image. Please try another file.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // -------------------------------------------------------------
  // REALISTIC EMAIL OTP DISPATCH
  // -------------------------------------------------------------
  const handleSendOtp = async () => {
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address first.");
      return;
    }

    setSendingOtp(true);
    try {
      await authService.sendOtp({ email: cleanEmail, purpose: "registration" });
      setIsOtpSent(true);
      setCooldown(60);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Could not send verification code.";
      setError(typeof detail === "string" ? detail : "Failed to send code.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setError("Please enter the complete 6-digit confirmation code.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await authService.verifyOtp({
        identifier: email.trim().toLowerCase(),
        code: cleanCode,
        purpose: "registration"
      });
      setVerificationToken(res.verification_token);
      setIsEmailVerified(true);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Incorrect confirmation code.";
      setError(typeof detail === "string" ? detail : "Verification failed.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // -------------------------------------------------------------
  // FORM REGISTRATION SUBMIT
  // -------------------------------------------------------------
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanUser = username.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setError("Please fill out all required fields.");
      return;
    }

    if (usernameStatus === "taken") {
      setError("Please choose an available username.");
      return;
    }

    // Realistic flow: If user hasn't sent/verified OTP yet, trigger sending OTP
    if (!isEmailVerified) {
      if (!isOtpSent) {
        await handleSendOtp();
        setError("We sent a 6-digit confirmation code to your email. Enter it below to complete registration.");
        return;
      }
      if (otpCode.trim().length === 6) {
        // Auto-verify code and continue
        try {
          const res = await authService.verifyOtp({
            identifier: cleanEmail,
            code: otpCode.trim(),
            purpose: "registration"
          });
          setVerificationToken(res.verification_token);
          setIsEmailVerified(true);
        } catch (err: any) {
          setError(err.response?.data?.detail || "Incorrect confirmation code.");
          return;
        }
      } else {
        setError("Please enter the 6-digit code sent to your email to verify your account.");
        return;
      }
    }

    setLoading(true);
    try {
      await authService.register({
        email: cleanEmail,
        full_name: cleanName,
        username: cleanUser || cleanEmail.split("@")[0],
        password,
        avatar_url: avatarUrl || undefined,
        verification_token: verificationToken || undefined,
      });

      dataCache.prefetch("/api/arenas/").catch(() => {});
      router.prefetch("/feed");
      setIsSuccess(true);

      setTimeout(() => {
        router.push("/feed");
      }, 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = "Could not create account. That email or handle may already be in use.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        msg = detail[0].msg;
      }
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#F8F9FA] dark:bg-[#121212] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between overflow-hidden overscroll-none transition-colors duration-200">
      {/* ── TOP GOOGLE-STYLE APP HEADER (STABLE AT TOP) ── */}
      <header className="shrink-0 z-40 h-14 sm:h-16 w-full border-b border-neutral-200/70 dark:border-neutral-800/70 bg-[#F8F9FA]/90 dark:bg-[#121212]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-[#282A2D] border border-neutral-200/60 dark:border-neutral-700/60 p-0.5 group-hover:scale-105 transition-transform shadow-xs">
              <img src="/icons/BrandNewLook.png" alt="Tribely" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-neutral-900 dark:text-neutral-100">
              Tribely
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Switch Appearance"
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {isMounted && isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-600" />
              )}
            </button>

            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-medium text-[#1A73E8] dark:text-[#8AB4F8] border border-neutral-300 dark:border-neutral-700 hover:bg-[#1A73E8]/8 dark:hover:bg-[#8AB4F8]/8 transition cursor-pointer"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN REGISTRATION CONTAINER (STABLE VIEWPORT) ── */}
      <main className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
        {/* ── SCROLLABLE INNER WINDOW (SIGNUP CARD) ── */}
        <div className="w-full max-w-[460px] max-h-full bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-800 rounded-[28px] shadow-[0_1px_3px_0_rgba(60,64,67,0.08),0_1px_2px_0_rgba(60,64,67,0.04)] dark:shadow-none flex flex-col overflow-hidden transition-colors">
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 sm:p-8 space-y-5"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: isDark ? "rgba(255,255,255,0.18) transparent" : "rgba(0,0,0,0.18) transparent",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* WELCOME BONUS CALLOUT (GOOGLE ACCENT STYLE) */}
          <div className="p-3 rounded-2xl bg-[#E8F0FE] dark:bg-[#1A2742] border border-[#D2E3FC] dark:border-[#2C4375] flex items-center gap-2.5 transition-colors">
            <div className="p-1.5 rounded-xl bg-[#1A73E8]/15 dark:bg-[#8AB4F8]/15 text-[#1A73E8] dark:text-[#8AB4F8] shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-xs font-semibold text-[#1A73E8] dark:text-[#8AB4F8]">
                1,000 Kudos Welcome Bonus
              </span>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-tight">
                Instantly credited upon registration.
              </p>
            </div>
          </div>

          {/* HEADER (GOOGLE IDENTITY STYLE) */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center bg-[#F1F3F4] dark:bg-[#282A2D] p-2 mb-1 transition-colors">
              <img src="/icons/BrandNewLook.png" alt="Tribely" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl sm:text-[26px] font-normal text-neutral-900 dark:text-neutral-100 tracking-tight">
              Create a Tribely Account
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Join habit squads with real stakes and proof drops
            </p>
          </div>

          {/* ERROR ALERT (GOOGLE MATERIAL STYLE) */}
          {error && (
            <div className="p-3 rounded-xl text-xs font-medium bg-[#FCE8E6] dark:bg-[#3C1E1E] border border-[#FAD2CF] dark:border-[#652525] text-[#C5221F] dark:text-[#F28B82] text-center animate-in fade-in">
              {error}
            </div>
          )}

          {/* SUCCESS OVERLAY */}
          {isSuccess ? (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#E6F4EA] dark:bg-[#133824] border border-[#CEEAD6] dark:border-[#1E6539] flex items-center justify-center text-[#137333] dark:text-[#81C995]">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-medium text-neutral-900 dark:text-neutral-100">
                  Welcome, {fullName}!
                </h2>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Account verified. 1,000 Kudos bonus credited.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-[#1A73E8] dark:text-[#8AB4F8] font-medium pt-2">
                <div className="w-3.5 h-3.5 border-2 border-[#1A73E8] dark:border-[#8AB4F8] border-t-transparent rounded-full animate-spin" />
                Entering Tribely Feed...
              </div>
            </div>
          ) : (
            /* STANDARD USER REGISTRATION FORM */
            <form onSubmit={handleRegister} className="space-y-4">
              
              {/* PROFILE PICTURE (DP) PICKER */}
              <div className="flex flex-col items-center justify-center space-y-2 py-1">
                <div className="relative group">
                  <div className="p-[2px] rounded-full border-2 border-[#1A73E8] dark:border-[#8AB4F8] shadow-xs">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center relative border border-white dark:border-[#1E1E1E]">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="DP" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-neutral-400" />
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="absolute -bottom-1 -right-1 p-1 rounded-full bg-rose-500 text-white shadow hover:bg-rose-600 transition cursor-pointer"
                      title="Remove DP"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* DP Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openCamera}
                    className="px-3 py-1.5 rounded-full bg-[#F1F3F4] dark:bg-[#282A2D] hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                    Take Photo
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-full bg-[#F1F3F4] dark:bg-[#282A2D] hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                    Upload
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {/* Preset Avatars */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium mr-1">Presets:</span>
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-6 h-6 rounded-full overflow-hidden border transition hover:scale-110 cursor-pointer ${
                        avatarUrl === preset ? "border-[#1A73E8] dark:border-[#8AB4F8] ring-2 ring-[#1A73E8]/30" : "border-transparent"
                      }`}
                    >
                      <img src={preset} alt={`P${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* CAMERA VIEWFINDER MODAL */}
              {isCameraOpen && (
                <div className="p-3.5 rounded-2xl bg-neutral-950 text-white space-y-2.5 animate-in zoom-in-95">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Camera Viewfinder
                    </span>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="text-neutral-400 hover:text-white cursor-pointer text-xs"
                    >
                      Close
                    </button>
                  </div>

                  <div className="relative rounded-xl overflow-hidden aspect-square bg-black border border-neutral-800">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 border-2 border-white/30 rounded-full pointer-events-none m-4" />
                  </div>

                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="w-full py-2 rounded-xl bg-white text-neutral-950 font-medium text-xs hover:bg-neutral-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" /> Snap Photo
                  </button>
                </div>
              )}

              {/* FULL NAME */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Full name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Alex Mercer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] text-sm font-normal transition"
                />
              </div>

              {/* USERNAME */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Username
                  </label>
                  {usernameStatus === "checking" && (
                    <span className="text-[10px] text-neutral-400">Checking...</span>
                  )}
                  {usernameStatus === "available" && (
                    <span className="text-[10px] font-medium text-[#137333] dark:text-[#81C995] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </span>
                  )}
                  {usernameStatus === "taken" && (
                    <span className="text-[10px] font-medium text-rose-500 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> {usernameMsg}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-medium text-neutral-400 text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="alexmercer"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] text-sm font-normal transition"
                  />
                </div>
              </div>

              {/* EMAIL & OTP VERIFICATION */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Email address
                  </label>
                  {isEmailVerified && (
                    <span className="text-[10px] font-medium text-[#137333] dark:text-[#81C995] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Email Verified
                    </span>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    type="email"
                    required
                    disabled={isEmailVerified}
                    placeholder="alex@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setIsOtpSent(false);
                      setIsEmailVerified(false);
                    }}
                    className={`w-full pl-4 py-2.5 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] text-sm font-normal transition ${
                      isEmailVerified ? "pr-10 bg-[#E6F4EA]/40 dark:bg-[#133824]/40 border-[#CEEAD6] dark:border-[#1E6539]" : "pr-24"
                    }`}
                  />

                  {!isEmailVerified && (
                    <button
                      type="button"
                      disabled={sendingOtp || cooldown > 0 || !email.includes("@")}
                      onClick={handleSendOtp}
                      className="absolute right-2 px-3 py-1.5 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] disabled:opacity-40 text-white dark:text-[#202124] font-medium text-xs transition cursor-pointer"
                    >
                      {sendingOtp ? (
                        <div className="w-3.5 h-3.5 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                      ) : cooldown > 0 ? (
                        `${cooldown}s`
                      ) : isOtpSent ? (
                        "Resend"
                      ) : (
                        "Send OTP"
                      )}
                    </button>
                  )}

                  {isEmailVerified && (
                    <span className="absolute right-3 text-[#137333] dark:text-[#81C995]">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                </div>

                {/* INLINE OTP CONFIRMATION BOX */}
                {isOtpSent && !isEmailVerified && (
                  <div className="p-3.5 rounded-2xl bg-[#E8F0FE]/70 dark:bg-[#1A2742]/70 border border-[#D2E3FC] dark:border-[#2C4375] space-y-2.5 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                        Enter 6-digit code sent to your email
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        className="flex-1 px-3 py-2 text-center tracking-widest font-mono text-base font-bold rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8]"
                      />
                      <button
                        type="button"
                        disabled={verifyingOtp || otpCode.length !== 6}
                        onClick={handleVerifyOtp}
                        className="px-4 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] text-white dark:text-[#202124] font-medium text-xs disabled:opacity-50 transition cursor-pointer"
                      >
                        {verifyingOtp ? "Checking..." : "Verify"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* PASSWORD */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-11 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] text-sm font-normal transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* SUBMIT BUTTON (GOOGLE MATERIAL FILLED PILL) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] dark:text-[#202124] font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create account & claim 1,000 Kudos</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Hidden Canvas for Camera Frame Capture */}
              <canvas ref={canvasRef} className="hidden" />
            </form>
          )}

          {/* Switcher to Login */}
          {!isSuccess && (
            <div className="pt-3 text-center border-t border-neutral-200/80 dark:border-neutral-800">
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
          </div>
        </div>
      </main>

      {/* ── GOOGLE-STYLE UNDERSTATED FOOTER (STABLE AT BOTTOM) ── */}
      <footer className="shrink-0 py-3 sm:py-4 px-6 max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 gap-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
        <div>
          <span>© {new Date().getFullYear()} Tribely Technologies</span>
          <span className="mx-2 hidden sm:inline">•</span>
          <span className="hidden sm:inline">Habit Cohorts & Accountability</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/protocol" className="hover:underline hover:text-neutral-700 dark:hover:text-neutral-200">
            Help & Protocol
          </Link>
          <Link href="/privacy" className="hover:underline hover:text-neutral-700 dark:hover:text-neutral-200">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline hover:text-neutral-700 dark:hover:text-neutral-200">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs font-semibold bg-[#F8F9FA] dark:bg-[#121212] text-neutral-500">
          Loading Tribely...
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
