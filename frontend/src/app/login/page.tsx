"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../utils/api";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.657-.657A9.97 9.97 0 0112 6c2.708 0 5.168 1.075 6.976 2.818M3 3l18 18" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams?.get("registered") === "true") {
      setSuccess("Account created — you can sign in now.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
    try {
      const response = await api.post("/api/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const { access_token, user_id, full_name } = response.data;
      localStorage.setItem("tribely_token", access_token);
      localStorage.setItem("tribely_user_id", user_id.toString());
      localStorage.setItem("tribely_user_name", full_name);
      router.push(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* ── LEFT BRAND PANEL ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] relative overflow-hidden p-12"
        style={{
          background: "linear-gradient(135deg, #0d1117 0%, #0f1f35 60%, #101010 100%)",
        }}
      >
        {/* animated orbs */}
        <div
          className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(0,122,204,0.20) 0%, transparent 70%)",
            animation: "float 7s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-60px] right-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(0,122,204,0.14) 0%, transparent 70%)",
            animation: "float 5s ease-in-out infinite reverse",
          }}
        />

        {/* logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 group w-fit">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-lg"
              style={{ background: "var(--accent)" }}
            >
              T
            </div>
            <span className="font-extrabold text-xl text-white tracking-tight">TRIBELY</span>
          </Link>
        </div>

        {/* headline */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
            Build habits that<br />
            <span style={{ color: "var(--accent)" }}>actually stick.</span>
          </h2>
          <p className="text-sm" style={{ color: "rgba(204,204,204,0.7)", lineHeight: "1.8" }}>
            Join accountability arenas. Submit daily proof before strict deadlines.
            Stay consistent with real stakes on the line.
          </p>

          {/* feature bullets */}
          {[
            "📋  Live proof ledger with peer verification",
            "💬  Real-time group chat",
            "🔒  Private arenas with admin approval",
          ].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "var(--accent)" }}
              />
              <span className="text-xs" style={{ color: "rgba(204,204,204,0.65)" }}>{f}</span>
            </div>
          ))}
        </div>

        {/* bottom tagline */}
        <p className="relative z-10 text-[11px]" style={{ color: "rgba(204,204,204,0.35)" }}>
          © {new Date().getFullYear()} Tribely Technologies
        </p>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* mobile logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-8 w-fit">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm"
              style={{ background: "var(--accent)" }}
            >T</div>
            <span className="font-extrabold text-base tracking-tight" style={{ color: "var(--fg)" }}>TRIBELY</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--fg)" }}>
              Welcome back
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
              Sign in to check your arenas and drop your daily proof.
            </p>
          </div>

          {success && (
            <div
              className="mb-5 px-4 py-3 rounded-2xl text-sm text-center animate-fade-in"
              style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "var(--success)" }}
            >
              {success}
            </div>
          )}
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-2xl text-sm text-center animate-fade-in"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "var(--danger)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
                Email
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="input-base focus-accent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="input-base focus-accent pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: "var(--fg-muted)" }}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-accent w-full py-3.5 rounded-2xl text-sm font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
            No account?{" "}
            <Link href="/register" className="font-semibold hover:opacity-80 transition" style={{ color: "var(--accent)" }}>
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}>
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
