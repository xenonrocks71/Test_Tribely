"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { formatErrorMessage } from "@/app/utils/api";
import { Eye, EyeOff, Trophy, Zap, DollarSign } from "lucide-react";
import Image from "next/image";

import { dataCache } from "@/app/utils/dataCache";

function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await authService.register({ email, password, full_name: fullName });
      dataCache.prefetch("/api/arenas/").catch(() => {});
      router.prefetch("/dashboard");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      setError(formatErrorMessage(msg, "Could not create account. That email may already be in use."));
      setLoading(false);
    }
  };


  const features = [
    { icon: <Trophy className="w-4 h-4" />, text: "Earn streak rewards & consistency badges" },
    { icon: <Zap className="w-4 h-4" />, text: "Never miss a deadline again" },
    { icon: <DollarSign className="w-4 h-4" />, text: "Real financial stakes keep you honest" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* ── LEFT FIERY BRAND PANEL ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] relative overflow-hidden p-12"
        style={{ background: "linear-gradient(135deg, #0B0E14 0%, #190F0B 50%, #0D0604 100%)" }}
      >
        <div
          className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none opacity-30 blur-3xl animate-pulse-glow"
          style={{ background: "radial-gradient(circle, #FF5E00 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #FF2E00 0%, transparent 70%)" }}
        />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 group w-fit">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition transform group-hover:scale-105 overflow-hidden border border-white/20 relative"
              style={{ background: "#FFFFFF" }}
            >
              <Image src="/logo.png" alt="Tribely" fill priority sizes="44px" style={{ objectFit: "contain" }} />
            </div>
            <span
              className="font-black text-2xl text-white tracking-tight"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
            >
              TRIBELY
            </span>
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <h2
            className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
          >
            Your tribe is<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-500 to-amber-500">
              waiting for you.
            </span>
          </h2>
          <p className="text-sm font-medium" style={{ color: "rgba(248,250,252,0.7)", lineHeight: "1.8" }}>
            Create your account in seconds. Join or create arenas, set your daily habit goals, and start building streaks with real accountability.
          </p>
          <div className="space-y-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,94,0,0.18)", color: "#FF7A30" }}>
                  {f.icon}
                </div>
                <span className="text-xs font-semibold" style={{ color: "rgba(248,250,252,0.75)" }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[11px] font-medium" style={{ color: "rgba(248,250,252,0.35)" }}>
          © {new Date().getFullYear()} Tribely Technologies. All rights reserved.
        </p>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* mobile logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-8 w-fit">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md overflow-hidden border border-[var(--border)] relative" style={{ background: "#FFFFFF" }}>
              <Image src="/logo.png" alt="Tribely" fill priority sizes="36px" style={{ objectFit: "contain" }} />
            </div>
            <span
              className="font-black text-xl tracking-tight"
              style={{ color: "var(--fg)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
            >
              TRIBELY
            </span>
          </Link>

          <div className="mb-8">
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ color: "var(--fg)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}
            >
              Join Tribely
            </h1>
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--fg-muted)" }}>
              Create an account to join arenas with your group.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-2xl text-xs font-semibold text-center animate-fade-in"
              style={{ background: "var(--danger-light)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Full Name</label>
              <input
                type="text" required placeholder="Alex Kumar"
                className="input-base focus-accent font-medium"
                value={fullName} onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Email</label>
              <input
                type="email" required placeholder="you@example.com"
                className="input-base focus-accent font-medium"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required placeholder="••••••••"
                  className="input-base focus-accent pr-12 font-medium"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="btn-accent w-full py-3.5 rounded-2xl text-sm font-extrabold mt-2 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </>
              ) : "Create account"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-bold hover:opacity-80 transition" style={{ color: "var(--accent)" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
