"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { dataCache } from "@/app/utils/dataCache";
import { apiClient } from "@/lib/api-client";
import { useTheme } from "@/context/ThemeContext";
import { Eye, EyeOff, Flame, Sun, Moon, Sparkles, ArrowRight, X, Lock, Check, Mail, KeyRound, RotateCcw } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect") || "/feed";
  const { theme, toggleTheme, isMounted } = useTheme();
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<"login" | "reset">("login");
  const [resetStep, setResetStep] = useState<"enter_email" | "enter_code" | "enter_password">("enter_email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetCooldown, setResetCooldown] = useState(0);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);
  const [showResetConfirmPw, setShowResetConfirmPw] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // Redirect already authenticated users directly to their feed (Google-standard persistent session)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("tribely_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token");
      if (token) {
        try {
          const payloadBase64 = token.split(".")[1];
          if (payloadBase64) {
            const payload = JSON.parse(atob(payloadBase64));
            if (!payload.exp || payload.exp * 1000 > Date.now()) {
              const target = redirectTo.startsWith("/") ? redirectTo : "/feed";
              router.replace(target);
              return;
            }
          }
        } catch {
          const target = redirectTo.startsWith("/") ? redirectTo : "/feed";
          router.replace(target);
          return;
        }
      }
    }
  }, [redirectTo, router]);

  // Cooldown countdown effect for OTP resend
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResetCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resetCooldown]);

  // Step 1: Send OTP to email
  const handleSendResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setResetError("Please enter a valid email address.");
      return;
    }
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);

    try {
      await authService.forgotPassword(cleanEmail);
      setResetSuccess(`Verification code sent to ${cleanEmail}. Please check your inbox.`);
      setResetStep("enter_code");
      setResetCooldown(60);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setResetError(
        typeof detail === "string"
          ? detail
          : "Failed to send reset code. Please check the email and try again."
      );
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: Verify OTP code
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    const code = resetOtp.trim();
    if (code.length !== 6) {
      setResetError("Please enter the complete 6-digit verification code.");
      return;
    }
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);

    try {
      const res = await authService.verifyOtp({
        identifier: cleanEmail,
        code,
        purpose: "password_reset",
      });

      if ((res.status !== "verified" && !res.verified) || !res.reset_token) {
        setResetError(res.message || "Invalid or expired verification code.");
        setResetLoading(false);
        return;
      }

      setResetToken(res.reset_token);
      setResetSuccess("Code verified! Enter your new password below.");
      setResetStep("enter_password");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setResetError(
        typeof detail === "string"
          ? detail
          : "Invalid or expired verification code. Please check and try again."
      );
    } finally {
      setResetLoading(false);
    }
  };

  // Step 3: Set new password with verified token
  const handleCompleteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (resetNewPassword.length < 6) {
      setResetError("Password must be at least 6 characters long.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match. Please re-enter.");
      return;
    }
    if (!resetToken) {
      setResetError("Session expired. Please request a new verification code.");
      setResetStep("enter_email");
      return;
    }

    setResetLoading(true);
    try {
      const cleanEmail = resetEmail.trim().toLowerCase();
      const res = await authService.resetPassword({
        email: cleanEmail,
        new_password: resetNewPassword,
        reset_token: resetToken,
      });

      if (res?.access_token) {
        setResetSuccess("Password successfully updated! Signing you in...");
        localStorage.setItem("tribely_token", res.access_token);
        localStorage.setItem("token", res.access_token);
        localStorage.setItem("tribely_user_id", String(res.user_id));
        localStorage.setItem("tribely_user_name", res.full_name || "");
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: res.user_id,
            full_name: res.full_name,
            email: cleanEmail,
          })
        );
        dataCache.prefetch("/api/arenas/").catch(() => {});
        setTimeout(() => {
          router.push("/feed");
        }, 1200);
      } else {
        setResetSuccess("Password updated! Returning to sign in...");
        setTimeout(() => {
          setView("login");
          setResetStep("enter_email");
        }, 1500);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setResetError(
        typeof detail === "string"
          ? detail
          : "Failed to reset password. Please verify your details."
      );
      setResetLoading(false);
    }
  };

  useEffect(() => {
    router.prefetch("/feed");
    if (searchParams?.get("registered") === "true") {
      setSuccess("Account created successfully! Sign in below to enter your squads.");
    }
  }, [searchParams, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await authService.login(cleanEmail, password);
      dataCache.prefetch("/api/arenas/").catch(() => {});
      const target = redirectTo.startsWith("/") ? redirectTo : "/feed";
      router.prefetch(target);
      router.push(target);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      let message = "Incorrect email or password.";
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        message = detail[0].msg;
      } else if (status === 502 || status === 503) {
        message = "Server is temporarily waking up (502). Please retry in a few seconds.";
      } else if (status === 500) {
        message = "Server encountered an internal error. Please try again.";
      } else if (!err.response) {
        message = "Network error: Unable to reach backend server. Please verify your connection.";
      }
      setError(message);
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
              href="/register"
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-medium text-[#1A73E8] dark:text-[#8AB4F8] border border-neutral-300 dark:border-neutral-700 hover:bg-[#1A73E8]/8 dark:hover:bg-[#8AB4F8]/8 transition cursor-pointer"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN VIEWPORT CONTAINER (STABLE) ── */}
      <main className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
        {view === "login" ? (
          /* ── SIGN-IN CARD (COMPACT, NO SCROLL NEEDED) ── */
          <div className="w-full max-w-[440px] bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-800 rounded-[28px] p-6 sm:p-8 shadow-[0_1px_3px_0_rgba(60,64,67,0.08),0_1px_2px_0_rgba(60,64,67,0.04)] dark:shadow-none space-y-4 sm:space-y-5 overflow-hidden transition-colors">
            {/* Card Header (Google Identity Style) */}
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center bg-[#F1F3F4] dark:bg-[#282A2D] p-2 mb-1.5 transition-colors">
                <img src="/icons/BrandNewLook.png" alt="Tribely" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl sm:text-[26px] font-normal text-neutral-900 dark:text-neutral-100 tracking-tight">
                Sign in
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                to continue to Tribely
              </p>
            </div>

            {/* Alert Banners (Google Material Alert Style) */}
            {success && (
              <div className="p-3.5 rounded-xl text-xs font-medium bg-[#E6F4EA] dark:bg-[#133824] border border-[#CEEAD6] dark:border-[#1E6539] text-[#137333] dark:text-[#81C995] text-center flex items-center justify-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="p-3.5 rounded-xl text-xs font-medium bg-[#FCE8E6] dark:bg-[#3C1E1E] border border-[#FAD2CF] dark:border-[#652525] text-[#C5221F] dark:text-[#F28B82] text-center">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 sm:py-3 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] text-sm font-normal transition"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email.trim());
                      setResetStep("enter_email");
                      setResetOtp("");
                      setResetToken("");
                      setResetError("");
                      setResetSuccess("");
                      setView("reset");
                    }}
                    className="text-xs sm:text-sm font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 pr-11 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] text-sm font-normal transition"
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

              {/* Google Material Filled Primary Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 sm:py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] dark:text-[#202124] font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>

            {/* Footer Switcher */}
            <div className="pt-3 text-center border-t border-neutral-200/80 dark:border-neutral-800">
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
                >
                  Create account
                </Link>
              </p>
            </div>
          </div>
        ) : (
          /* ── FORGOT PASSWORD / ACCOUNT RECOVERY (INNER WINDOW IS SCROLLABLE) ── */
          <div className="w-full max-w-[450px] max-h-full bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-800 rounded-[28px] shadow-[0_1px_3px_0_rgba(60,64,67,0.08),0_1px_2px_0_rgba(60,64,67,0.04)] dark:shadow-none flex flex-col overflow-hidden transition-colors">
            {/* Scrollable Inner Window */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 sm:p-8 space-y-4 sm:space-y-5"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: isDark ? "rgba(255,255,255,0.18) transparent" : "rgba(0,0,0,0.18) transparent",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* Header */}
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center bg-[#1A73E8]/10 dark:bg-[#8AB4F8]/10 text-[#1A73E8] dark:text-[#8AB4F8] p-2 mb-1 transition-colors">
                  {resetStep === "enter_email" ? (
                    <Lock className="w-6 h-6" />
                  ) : resetStep === "enter_code" ? (
                    <KeyRound className="w-6 h-6" />
                  ) : (
                    <Check className="w-6 h-6" />
                  )}
                </div>
                <h1 className="text-2xl sm:text-[26px] font-normal text-neutral-900 dark:text-neutral-100 tracking-tight">
                  {resetStep === "enter_email"
                    ? "Account recovery"
                    : resetStep === "enter_code"
                    ? "Enter verification code"
                    : "Create new password"}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {resetStep === "enter_email"
                    ? "Enter your account email to receive a secure 6-digit verification code."
                    : resetStep === "enter_code"
                    ? "Check your inbox for a 6-digit code sent from Tribely."
                    : "Enter your new password to regain access to your account."}
                </p>
              </div>

              {/* Status alerts */}
              {resetSuccess && (
                <div className="p-3.5 rounded-xl text-xs font-medium bg-[#E6F4EA] dark:bg-[#133824] border border-[#CEEAD6] dark:border-[#1E6539] text-[#137333] dark:text-[#81C995] text-center flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}
              {resetError && (
                <div className="p-3.5 rounded-xl text-xs font-medium bg-[#FCE8E6] dark:bg-[#3C1E1E] border border-[#FAD2CF] dark:border-[#652525] text-[#C5221F] dark:text-[#F28B82] text-center">
                  {resetError}
                </div>
              )}

              {/* Step 1: Enter Email */}
              {resetStep === "enter_email" && (
                <form onSubmit={handleSendResetOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Account email
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full px-4 py-2.5 sm:py-3 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm font-normal focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                    />
                  </div>

                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal pl-0.5">
                    We will send a 6-digit one-time code to this address. Check your spam folder if it doesn't arrive within a minute.
                  </p>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-2.5 sm:py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] dark:text-[#202124] font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
                  >
                    {resetLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                        <span>Sending verification code...</span>
                      </>
                    ) : (
                      <span>Send verification code</span>
                    )}
                  </button>
                </form>
              )}

              {/* Step 2: Enter 6-digit Code */}
              {resetStep === "enter_code" && (
                <form onSubmit={handleVerifyResetOtp} className="space-y-4">
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8] shrink-0" />
                      <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                        {resetEmail}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep("enter_email");
                        setResetError("");
                        setResetSuccess("");
                      }}
                      className="text-[#1A73E8] dark:text-[#8AB4F8] hover:underline font-medium ml-2 shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      6-digit verification code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                      className="w-full px-4 py-2.5 sm:py-3 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-center text-lg sm:text-xl font-mono tracking-widest font-semibold focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Didn't get the code?
                    </span>
                    {resetCooldown > 0 ? (
                      <span className="text-neutral-400 dark:text-neutral-500 font-medium">
                        Resend in {resetCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendResetOtp()}
                        disabled={resetLoading}
                        className="text-[#1A73E8] dark:text-[#8AB4F8] hover:underline font-medium cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Resend code
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading || resetOtp.length !== 6}
                    className="w-full py-2.5 sm:py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] dark:text-[#202124] font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
                  >
                    {resetLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                        <span>Verifying code...</span>
                      </>
                    ) : (
                      <span>Verify code</span>
                    )}
                  </button>
                </form>
              )}

              {/* Step 3: Enter New Password */}
              {resetStep === "enter_password" && (
                <form onSubmit={handleCompleteResetPassword} className="space-y-3.5 sm:space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        type={showResetPw ? "text" : "password"}
                        required
                        autoFocus
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-4 py-2.5 sm:py-3 pr-11 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm font-normal focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPw(!showResetPw)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
                        aria-label={showResetPw ? "Hide password" : "Show password"}
                      >
                        {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Confirm new password
                    </label>
                    <div className="relative">
                      <input
                        type={showResetConfirmPw ? "text" : "password"}
                        required
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-4 py-2.5 sm:py-3 pr-11 rounded-xl bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm font-normal focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#1A73E8] dark:focus:ring-[#8AB4F8] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetConfirmPw(!showResetConfirmPw)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
                        aria-label={showResetConfirmPw ? "Hide password" : "Show password"}
                      >
                        {showResetConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal pl-0.5">
                    Use at least 6 characters. Once confirmed, your session will be restored.
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-2.5 sm:py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] dark:text-[#202124] font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
                  >
                    {resetLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white dark:border-[#202124] border-t-transparent rounded-full animate-spin" />
                        <span>Updating password...</span>
                      </>
                    ) : (
                      <span>Update password & sign in</span>
                    )}
                  </button>
                </form>
              )}

              <div className="pt-3 text-center border-t border-neutral-200/80 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setResetError("");
                    setResetSuccess("");
                    setView("login");
                    setResetStep("enter_email");
                  }}
                  className="font-medium text-xs sm:text-sm text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer"
                >
                  ← Back to sign in
                </button>
              </div>
            </div>
          </div>
        )}
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs font-semibold bg-[#F8F9FA] dark:bg-[#121212] text-neutral-500">
          Loading Tribely...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
