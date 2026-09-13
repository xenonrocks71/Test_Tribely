"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { dataCache } from "@/app/utils/dataCache";
import { apiClient } from "@/lib/api-client";
import { useTheme } from "@/context/ThemeContext";
import { Eye, EyeOff, Flame, Sun, Moon, Sparkles, ArrowRight, X, Lock, Check } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect") || "/dashboard";
  const { theme, toggleTheme, isMounted } = useTheme();
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetLoading(true);
    try {
      const cleanEmail = resetEmail.trim().toLowerCase();
      const forgotRes = await apiClient.post<any>("/api/auth/forgot-password", {
        email: cleanEmail,
      });

      const resetToken = forgotRes?.reset_token;
      if (!resetToken) {
        setResetError("No active account found with this email address.");
        setResetLoading(false);
        return;
      }

      const res = await apiClient.post<any>("/api/auth/reset-password", {
        email: cleanEmail,
        new_password: resetNewPassword,
        reset_token: resetToken,
      });

      if (res?.access_token) {
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
        router.push("/dashboard");
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
    router.prefetch("/dashboard");
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
      const target = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
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
    <div className="min-h-screen w-full bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between transition-colors duration-200">
      {/* ── TOP 56PX INSTAGRAM/THREADS HEADER ── */}
      <header className="sticky top-0 z-40 h-14 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/85 dark:bg-[#0A0A0A]/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF5E00] to-[#FF2E00] flex items-center justify-center shadow-[0_0_16px_rgba(255,94,0,0.4)] group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="font-black text-lg tracking-tight text-neutral-900 dark:text-white">
              TRIBELY
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
              title="Switch Appearance"
              aria-label="Toggle theme"
            >
              {isMounted && isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-600" />
              )}
            </button>

            <Link
              href="/register"
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 transition cursor-pointer"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* ── CENTERED AUTH FORM ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[420px] bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 mb-1">
              <Flame className="w-6 h-6 fill-emerald-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
              Welcome back
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Sign in to check your squads and drop your daily proof.
            </p>
          </div>

          {/* Alert Banners */}
          {success && (
            <div className="p-3.5 rounded-2xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-center flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="p-3.5 rounded-2xl text-xs font-bold bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email.trim());
                    setShowResetModal(true);
                  }}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Forgot?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-2xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition cursor-pointer"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-sm transition shadow-lg shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to Tribely</span>
              )}
            </button>
          </form>

          {/* Footer Switcher */}
          <div className="pt-2 text-center border-t border-neutral-100 dark:border-neutral-800/80">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Don't have an account?{" "}
              <Link
                href="/register"
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Create one free →
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* ── PASSWORD RESET MODAL ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                  Reset Password
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetError("");
                }}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Enter your account email and a new password to immediately update your credentials and sign in.
            </p>

            {resetError && (
              <div className="p-3 rounded-xl text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs transition cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {resetLoading ? "Updating Password..." : "Update Password & Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className="py-6 text-center border-t border-neutral-200/60 dark:border-neutral-900">
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          © {new Date().getFullYear()} Tribely Technologies • Where habits become social status.
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs font-semibold bg-white dark:bg-[#0A0A0A] text-neutral-500">
          Loading Tribely...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
