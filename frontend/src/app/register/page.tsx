"use client";

import React, { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { dataCache } from "@/app/utils/dataCache";
import { useTheme } from "@/context/ThemeContext";
import { Eye, EyeOff, Flame, Sun, Moon, Sparkles, Coins, Check, ArrowRight } from "lucide-react";

function RegisterContent() {
  const router = useRouter();
  const { theme, toggleTheme, isMounted } = useTheme();
  const isDark = theme === "dark";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password || !cleanName) {
      setError("Please fill out all required fields.");
      return;
    }

    setLoading(true);
    try {
      await authService.register({
        email: cleanEmail,
        password,
        full_name: cleanName,
      });
      dataCache.prefetch("/api/arenas/").catch(() => {});
      router.prefetch("/dashboard");
      router.push("/dashboard");
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      let msg = "Could not create account. That email may already be in use.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        msg = detail[0].msg;
      } else if (status === 502 || status === 503) {
        msg = "Server is temporarily waking up (502). Please retry in a few moments.";
      } else if (status === 500) {
        msg = "Server encountered an internal error. Please try again.";
      } else if (!err.response) {
        msg = "Network error: Unable to reach backend server. Please verify your connection.";
      }
      setError(msg);
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
              href="/login"
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 transition cursor-pointer"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* ── CENTERED REGISTRATION CARD ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[420px] bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Header */}
          <div className="space-y-1.5 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-500 mb-1">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
              Create Account
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Join accountability squads with real stakes and proof drops.
            </p>
          </div>

          {/* 1,000 Kudos Welcome Bonus Callout */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-500 shrink-0 mt-0.5">
              <Coins className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-left">
              <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                1,000 Kudos Welcome Bonus
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-snug">
                Instantly credited to your wallet upon registration to stake in your first squads.
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl text-xs font-bold bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Alex Mercer"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
              />
            </div>

            <div className="space-y-1">
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

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Password
              </label>
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Claim 1,000 Kudos & Start →</span>
              )}
            </button>
          </form>

          {/* Switcher to Login */}
          <div className="pt-2 text-center border-t border-neutral-100 dark:border-neutral-800/80">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Sign in here →
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="py-6 text-center border-t border-neutral-200/60 dark:border-neutral-900">
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          © {new Date().getFullYear()} Tribely Technologies • Where habits become social status.
        </p>
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs font-semibold bg-white dark:bg-[#0A0A0A] text-neutral-500">
          Loading Tribely...
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
