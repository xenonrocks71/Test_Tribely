"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  CheckCircle2,
  Image as ImageIcon,
  Flame,
  Lock,
  Sparkles,
  Link2,
  ExternalLink,
  Clipboard,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  Shield,
  Upload,
  Trophy,
  ChevronRight,
  Info,
} from "lucide-react";
import { useApp, HabitArena } from "@/context/AppContext";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Types & Pure Deadline Timeline Calculator
// ─────────────────────────────────────────────────────────────────────────────

export interface ArenaDeadlineTimeline {
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining: number;
  totalMinutesRemaining: number;
  isPassedToday: boolean;
  isNextDayCycle: boolean;
  targetDayLabel: "Today" | "Tomorrow";
  displayCutoffTime: string;
  countdownFormatted: string;
  progressPercent: number; // 0-100% of the active 24h window elapsed
  urgencyLevel: "urgent" | "active" | "next_day";
}

/**
 * Accurately parses an arena's deadline time string (e.g. "10:00 PM", "06:00 AM", "23:59")
 * and computes remaining time, cycle rollover status, and countdown values.
 */
export function parseArenaDeadline(deadlineStr?: string, referenceDate = new Date()): ArenaDeadlineTimeline {
  const currentHours = referenceDate.getHours();
  const currentMinutes = referenceDate.getMinutes();
  const currentSeconds = referenceDate.getSeconds();
  const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  let targetHours = 23;
  let targetMinutes = 59;

  if (deadlineStr) {
    const trimmed = deadlineStr.trim();
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const period = match12[3].toUpperCase();
      if (period === "PM" && h < 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      targetHours = h;
      targetMinutes = m;
    } else {
      const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
      if (match24) {
        targetHours = parseInt(match24[1], 10);
        targetMinutes = parseInt(match24[2], 10);
      }
    }
  }

  const cutoffTotalMinutes = targetHours * 60 + targetMinutes;
  const cutoffTotalSeconds = cutoffTotalMinutes * 60;

  // Formatted display cutoff string, e.g. "10:00 PM"
  const hDisplay = targetHours % 12 || 12;
  const period = targetHours >= 12 ? "PM" : "AM";
  const mDisplay = targetMinutes < 10 ? `0${targetMinutes}` : `${targetMinutes}`;
  const displayCutoffTime = `${hDisplay}:${mDisplay} ${period}`;

  const isPassedToday = currentTotalMinutes >= cutoffTotalMinutes;

  if (!isPassedToday) {
    // ── ACTIVE TODAY ──
    const diffSeconds = Math.max(0, cutoffTotalSeconds - currentTotalSeconds);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const hours = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    let countdownFormatted = "";
    if (hours > 0) {
      countdownFormatted = `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      countdownFormatted = `${mins}m ${secs}s`;
    } else {
      countdownFormatted = `${secs}s`;
    }

    // 24-hour cycle elapsed progress
    const windowElapsedMinutes = Math.max(0, 1440 - diffMinutes);
    const progressPercent = Math.min(100, Math.max(0, Math.round((windowElapsedMinutes / 1440) * 100)));
    const urgencyLevel: "urgent" | "active" = diffMinutes <= 120 ? "urgent" : "active";

    return {
      hoursRemaining: hours,
      minutesRemaining: mins,
      secondsRemaining: secs,
      totalMinutesRemaining: diffMinutes,
      isPassedToday: false,
      isNextDayCycle: false,
      targetDayLabel: "Today",
      displayCutoffTime,
      countdownFormatted,
      progressPercent,
      urgencyLevel,
    };
  } else {
    // ── CUTOFF PASSED: AUTOMATICALLY ROLL OVER TO NEXT DAY CYCLE ──
    // DO NOT LOCK USER. Target deadline is tomorrow at the same cutoff time.
    const secondsToMidnight = 86400 - currentTotalSeconds;
    const diffSeconds = secondsToMidnight + cutoffTotalSeconds;
    const diffMinutes = Math.floor(diffSeconds / 60);
    const hours = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    const countdownFormatted = `${hours}h ${mins}m ${secs}s`;

    return {
      hoursRemaining: hours,
      minutesRemaining: mins,
      secondsRemaining: secs,
      totalMinutesRemaining: diffMinutes,
      isPassedToday: true,
      isNextDayCycle: true,
      targetDayLabel: "Tomorrow",
      displayCutoffTime: `Tomorrow at ${displayCutoffTime}`,
      countdownFormatted,
      progressPercent: Math.min(100, Math.max(5, Math.round(((86400 - diffSeconds) / 86400) * 100))),
      urgencyLevel: "next_day",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CameraModal Component
// ─────────────────────────────────────────────────────────────────────────────

export const CameraModal: React.FC = () => {
  const {
    isCameraModalOpen,
    closeCamera,
    arenas,
    dropProofOptimistic,
    triggerHaptic,
    showToast,
    completedArenaIdsToday,
    isArenaCompletedToday,
    user,
  } = useApp();

  // ── Live Second-by-Second Ticker ──
  const [tickerTime, setTickerTime] = useState<Date>(new Date());
  useEffect(() => {
    if (!isCameraModalOpen) return;
    const interval = setInterval(() => {
      setTickerTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isCameraModalOpen]);

  // ── Top 3 Proof Modes: Capture, Upload, Link ──
  const [proofMode, setProofMode] = useState<"capture" | "upload" | "link">("capture");

  // Proof content state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [justSubmittedArenaId, setJustSubmittedArenaId] = useState<string | null>(null);

  // Camera & media refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Selected arena ID
  const [selectedArenaId, setSelectedArenaId] = useState<string>("");

  // ── 3. Enrolled Arenas Smart Sorting & Timeline Computation ──
  // Rule 1: Pending squads due Today (sorted by soonest deadline first)
  // Rule 2: Pending squads rolled over to Next Day (sorted by deadline)
  // Rule 3: Completed squads for today (locked at bottom)
  const sortedSquads = useMemo(() => {
    return [...arenas]
      .map((arena) => {
        const isSubmitted = isArenaCompletedToday(arena.id);
        const timeline = parseArenaDeadline(arena.deadlineTime, tickerTime);
        return {
          arena,
          isSubmitted,
          isLocked: isSubmitted, // Lock ONLY when submitted! Passing deadline does NOT lock.
          timeline,
        };
      })
      .sort((a, b) => {
        // 1. Submitted squads strictly at the bottom
        if (a.isSubmitted && !b.isSubmitted) return 1;
        if (!a.isSubmitted && b.isSubmitted) return -1;
        if (a.isSubmitted && b.isSubmitted) return 0;

        // 2. Both unsubmitted: active today strictly before rolled next-day
        if (!a.timeline.isNextDayCycle && b.timeline.isNextDayCycle) return -1;
        if (a.timeline.isNextDayCycle && !b.timeline.isNextDayCycle) return 1;

        // 3. Both in same cycle -> soonest deadline first
        return a.timeline.totalMinutesRemaining - b.timeline.totalMinutesRemaining;
      });
  }, [arenas, completedArenaIdsToday, isArenaCompletedToday, tickerTime]);

  // Auto-select the highest-priority pending arena on open or update
  useEffect(() => {
    if (!isCameraModalOpen) return;

    const currentSelection = sortedSquads.find((s) => s.arena.id === selectedArenaId);

    // If current selection doesn't exist or is completed, auto-pick next pending squad
    if (!currentSelection || currentSelection.isSubmitted) {
      const firstPending = sortedSquads.find((s) => !s.isSubmitted);
      if (firstPending) {
        setSelectedArenaId(firstPending.arena.id);
      } else if (sortedSquads[0]) {
        setSelectedArenaId(sortedSquads[0].arena.id);
      }
    }
  }, [isCameraModalOpen, sortedSquads, selectedArenaId]);

  const selectedSquadMeta = sortedSquads.find((s) => s.arena.id === selectedArenaId);
  const selectedArena = selectedSquadMeta?.arena || arenas[0];
  const isSelectedArenaLocked = Boolean(selectedSquadMeta?.isSubmitted);

  // Count metrics for gamified HUD
  const totalEnrolled = sortedSquads.length;
  const totalCompletedToday = sortedSquads.filter((s) => s.isSubmitted).length;
  const allSquadsSubmitted = totalEnrolled > 0 && totalCompletedToday === totalEnrolled;
  const nextPendingSquad = sortedSquads.find((s) => !s.isSubmitted && s.arena.id !== selectedArenaId);

  // Time remaining to midnight for locked squads (unlock window)
  const unlockCountdown = useMemo(() => {
    const now = tickerTime;
    const currentSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const remaining = 86400 - currentSecs;
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    return `${h}h ${m < 10 ? "0" : ""}${m}m ${s < 10 ? "0" : ""}${s}s`;
  }, [tickerTime]);

  // ── 4. Camera Controls ──
  const startCamera = useCallback(async (facing: "user" | "environment") => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1350 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraError(null);
    } catch {
      setCameraError("Camera permission unavailable. You can upload an image or paste a link.");
    }
  }, []);

  useEffect(() => {
    if (isCameraModalOpen && proofMode === "capture" && !capturedImage && !isSelectedArenaLocked) {
      startCamera(cameraFacing);
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [isCameraModalOpen, proofMode, cameraFacing, capturedImage, isSelectedArenaLocked, startCamera]);

  const handleFlipCamera = () => {
    triggerHaptic([15]);
    const next = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(next);
    startCamera(next);
  };

  const handleCaptureShutter = () => {
    triggerHaptic([35, 55]);
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 960;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (cameraFacing === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(dataUrl);
        return;
      }
    }

    // Fallback: trigger native camera input
    nativeCameraInputRef.current?.click();
  };

  // ── 5. File Upload Handler ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic([20]);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (proofMode === "capture") {
        setCapturedImage(result);
      } else {
        setUploadedImage(result);
      }
      showToast("Photo loaded successfully! 📸", "success");
    };
    reader.readAsDataURL(file);
  };

  // ── 6. Link Detection & Paste ──
  const getLinkMeta = (url: string) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes("leetcode.com")) {
        return {
          platform: "LeetCode",
          badge: "LeetCode Algorithm ⚡",
          color: "#FFA116",
        };
      }
      if (host.includes("github.com")) {
        return {
          platform: "GitHub",
          badge: "GitHub PR / Commit 🐙",
          color: "#A78BFA",
        };
      }
      if (host.includes("youtube.com") || host.includes("youtu.be")) {
        let videoId: string | null = null;
        if (host.includes("youtu.be")) {
          videoId = parsed.pathname.slice(1).split("?")[0];
        } else {
          videoId = parsed.searchParams.get("v");
        }
        return {
          platform: "YouTube",
          badge: "YouTube Video 🔴",
          color: "#EF4444",
          thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
        };
      }
      if (host.includes("strava.com")) {
        return {
          platform: "Strava",
          badge: "Strava Workout 🏃",
          color: "#FC4C02",
        };
      }
      return {
        platform: host.replace("www.", ""),
        badge: "Verified External Link ↗",
        color: "#10B981",
      };
    } catch {
      return null;
    }
  };

  const linkMeta = linkUrl.trim() ? getLinkMeta(linkUrl.trim()) : null;

  const handlePasteClipboard = async () => {
    try {
      setIsPasting(true);
      triggerHaptic([15]);
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith("http") || text.includes(".com") || text.includes(".io"))) {
          const finalUrl = text.startsWith("http") ? text.trim() : `https://${text.trim()}`;
          setLinkUrl(finalUrl);
          setLinkError(null);
          showToast("Link pasted from clipboard!", "success");
        } else {
          showToast("No valid web link in clipboard.", "info");
        }
      } else {
        showToast("Clipboard access not available.", "info");
      }
    } catch {
      showToast("Clipboard read permission denied.", "info");
    } finally {
      setIsPasting(false);
    }
  };

  // Active proof payload
  const currentProofPayload = useMemo(() => {
    if (proofMode === "capture") return capturedImage;
    if (proofMode === "upload") return uploadedImage;
    if (proofMode === "link") return linkUrl.trim();
    return null;
  }, [proofMode, capturedImage, uploadedImage, linkUrl]);

  // ── 7. Submit Proof for Selected Arena ──
  const handleSubmitProof = () => {
    if (!selectedArena) {
      showToast("Please select a squad.", "info");
      return;
    }

    if (selectedSquadMeta?.isSubmitted) {
      showToast(`Proof already verified for ${selectedArena.name} today! ✓`, "info");
      return;
    }

    if (!currentProofPayload) {
      if (proofMode === "capture") showToast("Please snap a photo first.", "info");
      else if (proofMode === "upload") showToast("Please choose an image from gallery.", "info");
      else showToast("Please enter or paste a valid link URL.", "info");
      return;
    }

    if (proofMode === "link" && !currentProofPayload.startsWith("http")) {
      setLinkError("Please enter a valid link starting with http:// or https://");
      return;
    }

    triggerHaptic([40, 80, 50]);
    setIsSubmitting(true);

    const isNextDay = selectedSquadMeta?.timeline.isNextDayCycle;

    setTimeout(() => {
      dropProofOptimistic({
        arenaId: selectedArena.id,
        image: currentProofPayload,
        selfie: user.avatar,
        caption:
          caption ||
          (isNextDay
            ? `Early habit drop locked in for ${selectedArena.tag}! Next-day streak compounded 🌱`
            : `Daily habit drop locked in for ${selectedArena.tag}! Consistency compounded 📈`),
        telemetry:
          proofMode === "link"
            ? `${linkMeta?.platform || "Link"} Verified • ${isNextDay ? "Next Day Cycle" : "On-Time Drop"}`
            : isNextDay
            ? "Photo Verified • Next Day Cycle Active 🌱"
            : "Photo Verified • On-Time Drop ⚡",
        keepOpen: true, // Keep modal open so the user sees this squad lock and next squad auto-selected!
      });

      setJustSubmittedArenaId(selectedArena.id);
      setIsSubmitting(false);

      if (isNextDay) {
        showToast(`🌱 Early drop locked in for tomorrow's cycle in ${selectedArena.name}!`, "success");
      } else {
        showToast(`✓ Proof locked in for ${selectedArena.name}! +1 Day Streak 🔥`, "success");
      }

      // Reset proof inputs for next submission
      setCapturedImage(null);
      setUploadedImage(null);
      setLinkUrl("");
      setCaption("");

      // Auto-switch to next pending squad if available
      const remainingPending = sortedSquads.filter(
        (s) => s.arena.id !== selectedArena.id && !s.isSubmitted
      );
      if (remainingPending[0]) {
        setSelectedArenaId(remainingPending[0].arena.id);
      }
    }, 450);
  };

  if (!isCameraModalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 select-none overflow-hidden"
      >
        <canvas ref={canvasRef} className="hidden" />

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Main Modal Frame */}
        <div className="relative w-full max-w-md h-full bg-neutral-950 border-x border-neutral-900 flex flex-col justify-between shadow-2xl overflow-hidden">
          {/* ── 1. MODAL HEADER & GAMIFIED HUD ── */}
          <div className="p-3.5 border-b border-neutral-900 bg-neutral-950/95 sticky top-0 z-20 space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={closeCamera}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-white">
                  Submit Daily Proof
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Streak Badge in Header */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
                <span>{user.currentStreak}d</span>
              </div>
            </div>

            {/* Gamified HUD: Squad Completion Bar & Bonus Multiplier */}
            <div className="p-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 flex items-center justify-between gap-2">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-neutral-400">Today's Squads</span>
                  <span className="font-black text-white">
                    {totalCompletedToday} / {totalEnrolled} Locked
                  </span>
                </div>
                {/* Segmented Progress Bar */}
                <div className="flex gap-1 h-1.5 w-full">
                  {sortedSquads.map((s, idx) => (
                    <div
                      key={s.arena.id || idx}
                      className={`h-full flex-1 rounded-full transition-all duration-300 ${
                        s.isSubmitted
                          ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                          : s.timeline.isNextDayCycle
                          ? "bg-indigo-500/50"
                          : "bg-neutral-800"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 pl-2 border-l border-neutral-800">
                <div className="text-right">
                  <div className="text-[10px] font-black text-emerald-400 flex items-center gap-0.5 justify-end">
                    <Zap className="w-3 h-3 fill-emerald-400" />
                    <span>+{user.multiplier || 1.0}x XP</span>
                  </div>
                  <div className="text-[9px] font-bold text-neutral-500">
                    🛡️ {user.streakShields || 1} Shield
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 2. SCROLLABLE BODY ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {/* ── ACTIVE ARENA TIMELINE HUD ── */}
            {selectedArena && (
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isSelectedArenaLocked
                    ? "bg-emerald-950/20 border-emerald-500/30"
                    : selectedSquadMeta?.timeline.isNextDayCycle
                    ? "bg-indigo-950/20 border-indigo-500/30"
                    : selectedSquadMeta?.timeline.urgencyLevel === "urgent"
                    ? "bg-amber-950/20 border-amber-500/40"
                    : "bg-neutral-900/90 border-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{selectedArena.emoji || "⚔️"}</span>
                    <div>
                      <h4 className="text-xs font-black text-white leading-tight">
                        {selectedArena.name}
                      </h4>
                      <span className="text-[10px] text-neutral-400 font-bold">
                        {selectedArena.tag}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Status Pill */}
                  {isSelectedArenaLocked ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Dropped Today</span>
                    </div>
                  ) : selectedSquadMeta?.timeline.isNextDayCycle ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-black">
                      <span>🌱</span>
                      <span>Next Day Active</span>
                    </div>
                  ) : selectedSquadMeta?.timeline.urgencyLevel === "urgent" ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black animate-pulse">
                      <Flame className="w-3.5 h-3.5 fill-amber-300" />
                      <span>Urgent: {selectedSquadMeta?.timeline.countdownFormatted}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-bold">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Due {selectedSquadMeta?.timeline.displayCutoffTime}</span>
                    </div>
                  )}
                </div>

                {/* Sub-bar: Timeline explanation & live ticker */}
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-neutral-400 font-medium">
                    {isSelectedArenaLocked
                      ? "Stake Protected • Streak Safe"
                      : selectedSquadMeta?.timeline.isNextDayCycle
                      ? `Deadline passed today • Reset to ${selectedSquadMeta?.timeline.displayCutoffTime}`
                      : `Deadline closes at ${selectedSquadMeta?.timeline.displayCutoffTime}`}
                  </span>
                  <span className="font-mono font-bold text-white">
                    {isSelectedArenaLocked
                      ? `Next window in ${unlockCountdown}`
                      : selectedSquadMeta?.timeline.countdownFormatted}
                  </span>
                </div>
              </div>
            )}

            {/* ── IF SELECTED ARENA IS LOCKED: SHOW GAMIFIED COMPLETED CARD ── */}
            {isSelectedArenaLocked ? (
              <div className="p-6 rounded-3xl bg-neutral-900/90 border border-emerald-500/30 text-center space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Flame className="w-9 h-9 fill-emerald-400 animate-bounce" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-white">
                    {selectedArena.name} Locked for Today! 🔥
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                    You already verified today's habit proof. Your streak of{" "}
                    <span className="text-emerald-400 font-bold">{user.currentStreak} days</span> is
                    compounded and your stake is safe.
                  </p>
                </div>

                {/* Live Countdown to Next Drop Window */}
                <div className="p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Next Daily Window Unlocks In
                  </div>
                  <div className="text-lg font-mono font-black text-emerald-400">
                    {unlockCountdown}
                  </div>
                </div>

                {/* Switch to pending squad CTA if any pending */}
                {nextPendingSquad ? (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([15]);
                      setSelectedArenaId(nextPendingSquad.arena.id);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] cursor-pointer"
                  >
                    <span>Switch to {nextPendingSquad.arena.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    <span>Grand Slam! All Enrolled Squads Completed Today.</span>
                  </div>
                )}
              </div>
            ) : (
              /* ── IF ARENA IS ACTIVE (TODAY OR NEXT-DAY ROLLED): SHOW MEDIA CAPTURE ── */
              <div className="space-y-4">
                {/* ── TOP 3 PROOF TABS ── */}
                <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-neutral-900/90 border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setProofMode("capture");
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      proofMode === "capture"
                        ? "bg-white text-neutral-950 shadow-md scale-[1.02]"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setProofMode("upload");
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      proofMode === "upload"
                        ? "bg-white text-neutral-950 shadow-md scale-[1.02]"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setProofMode("link");
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      proofMode === "link"
                        ? "bg-white text-neutral-950 shadow-md scale-[1.02]"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Paste Link</span>
                  </button>
                </div>

                {/* ── PROOF INPUT / PREVIEW AREA ── */}
                {/* Mode 1: Capture Mode */}
                {proofMode === "capture" && (
                  <div className="space-y-2">
                    {capturedImage ? (
                      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-xl">
                        <img
                          src={capturedImage}
                          alt="Captured Proof"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic([15]);
                            setCapturedImage(null);
                          }}
                          className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-bold border border-white/20 backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retake Photo</span>
                        </button>
                      </div>
                    ) : (
                      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 flex flex-col justify-between p-3">
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          className={`w-full h-full object-cover absolute inset-0 rounded-3xl ${
                            cameraFacing === "user" ? "-scale-x-100" : ""
                          }`}
                        />

                        {/* Top Viewfinder Controls */}
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-mono border border-white/10 backdrop-blur">
                            LIVE CAMERA
                          </span>
                          <button
                            type="button"
                            onClick={handleFlipCamera}
                            className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition border border-white/10 cursor-pointer"
                            title="Flip Camera"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>

                        {cameraError && (
                          <div className="relative z-10 my-auto text-center p-4 text-xs text-neutral-400">
                            <p>{cameraError}</p>
                          </div>
                        )}

                        {/* Bottom Circular Shutter Bar */}
                        <div className="relative z-10 flex items-center justify-center pb-2">
                          <motion.button
                            whileTap={{ scale: 0.88 }}
                            onClick={handleCaptureShutter}
                            className="w-18 h-18 rounded-full p-1 border-4 border-white/80 flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition"
                            title="Snap Photo"
                          >
                            <div className="w-full h-full rounded-full bg-white active:bg-neutral-300" />
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 2: Upload Mode */}
                {proofMode === "upload" && (
                  <div className="space-y-2">
                    {uploadedImage ? (
                      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-xl">
                        <img
                          src={uploadedImage}
                          alt="Uploaded Proof"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-bold border border-white/20 backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Change Photo</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[4/5] rounded-3xl border-2 border-dashed border-neutral-800 hover:border-emerald-500/50 bg-neutral-900/60 flex flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer transition group"
                      >
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-white">
                            Select Photo from Gallery
                          </h4>
                          <p className="text-[11px] text-neutral-400 max-w-xs">
                            Upload screenshot or proof photo (.jpg, .png, .webp).
                          </p>
                        </div>
                        <span className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition">
                          Browse Files 📁
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 3: Paste Link Mode */}
                {proofMode === "link" && (
                  <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3.5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        Verification Link
                      </span>
                      <button
                        type="button"
                        onClick={handlePasteClipboard}
                        disabled={isPasting}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-emerald-400 border border-neutral-700 transition cursor-pointer"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        <span>{isPasting ? "Pasting..." : "Paste Link"}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => {
                          setLinkUrl(e.target.value);
                          setLinkError(null);
                        }}
                        placeholder="https://leetcode.com/... or github, youtube, strava"
                        className="w-full px-3.5 py-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/60 font-mono transition"
                      />
                    </div>

                    {linkError && (
                      <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{linkError}</span>
                      </p>
                    )}

                    {/* Detected Platform Chip / Preview */}
                    {linkMeta && (
                      <div className="p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2.5 py-1 rounded-lg text-[10px] font-black"
                            style={{ background: `${linkMeta.color}20`, color: linkMeta.color }}
                          >
                            {linkMeta.badge}
                          </span>
                          <span className="text-xs font-bold text-white truncate max-w-[160px]">
                            {linkMeta.platform}
                          </span>
                        </div>

                        {linkMeta.thumbnail && (
                          <img
                            src={linkMeta.thumbnail}
                            alt="YouTube Thumbnail"
                            className="w-12 h-8 object-cover rounded-lg border border-white/10"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Optional Caption / Reflection Input */}
                <div>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add reflection or note (optional)..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition"
                  />
                </div>
              </div>
            )}

            {/* ── 3. ENROLLED SQUADS SELECTOR (SMART SORTED & GAMIFIED) ── */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                    Select Squad
                  </h4>
                  <p className="text-[10px] text-neutral-500 font-medium">
                    Deadlines tick live • Completed squads locked at bottom
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {arenas.length} Squads
                </span>
              </div>

              {sortedSquads.length === 0 ? (
                <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center text-xs text-neutral-400">
                  You haven't joined any squads yet. Discover squads to submit proof.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedSquads.map(({ arena, isSubmitted, isLocked, timeline }) => {
                    const isSelected = selectedArenaId === arena.id;

                    // Badge text & color logic
                    let badgeColor = "bg-neutral-800 text-neutral-300 border-neutral-700";
                    let badgeText = `Due ${timeline.displayCutoffTime}`;

                    if (isSubmitted) {
                      badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                      badgeText = "✓ Dropped Today";
                    } else if (timeline.isNextDayCycle) {
                      badgeColor = "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
                      badgeText = "🌱 Next Day Active";
                    } else if (timeline.urgencyLevel === "urgent") {
                      badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse";
                      badgeText = `⏳ ${timeline.countdownFormatted}`;
                    }

                    return (
                      <div
                        key={arena.id}
                        onClick={() => {
                          triggerHaptic([15]);
                          setSelectedArenaId(arena.id);
                        }}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? isSubmitted
                              ? "bg-neutral-900/90 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                              : "bg-neutral-900 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            : isSubmitted
                            ? "opacity-60 bg-neutral-950/40 border-neutral-900 hover:opacity-80"
                            : "bg-neutral-900/70 border-neutral-800/80 hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Arena Emoji / Emblem */}
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 transition ${
                              isSelected
                                ? isSubmitted
                                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                                  : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                                : "bg-neutral-800/80 border border-neutral-700/80 text-white"
                            }`}
                          >
                            {arena.emoji || "⚔️"}
                          </div>

                          {/* Squad Name & Tag */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-black text-white truncate leading-tight">
                                {arena.name}
                              </h5>
                              {isSubmitted && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                              {timeline.isNextDayCycle && !isSubmitted && (
                                <span className="text-[10px] shrink-0">🌱</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-neutral-400 truncate">
                                {arena.tag}
                              </span>
                              <span className="text-[10px] text-amber-400 font-bold">
                                ⚡ {arena.penaltyAmount || 50} Stake
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Deadline / Status Badge & Selection Indicator */}
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${badgeColor}`}
                          >
                            {badgeText}
                          </span>

                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                              isSelected
                                ? isSubmitted
                                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                                  : "border-emerald-500 bg-emerald-500 text-neutral-950"
                                : "border-neutral-700 bg-transparent"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── 4. STICKY SUBMIT FOOTER ── */}
          <div className="p-4 border-t border-neutral-900 bg-neutral-950/95 sticky bottom-0 z-20 space-y-2">
            {allSquadsSubmitted ? (
              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-1.5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>All Enrolled Squads Completed Today! 🎉</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  All streaks are safe and compounded. Next submission windows open tomorrow.
                </p>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="mt-2 w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : isSelectedArenaLocked ? (
              /* If currently selected arena is locked but other squads are pending */
              nextPendingSquad ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic([15]);
                    setSelectedArenaId(nextPendingSquad.arena.id);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <span>Switch to {nextPendingSquad.arena.name}</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={closeCamera}
                  className="w-full py-3.5 px-4 rounded-2xl bg-neutral-900 text-neutral-400 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              )
            ) : (
              /* If currently selected arena is pending (today or next-day cycle) */
              <button
                type="button"
                onClick={handleSubmitProof}
                disabled={isSubmitting || !currentProofPayload || !selectedArena}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer active:scale-98 ${
                  !currentProofPayload
                    ? "bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying & Compounding Streak...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {selectedSquadMeta?.timeline.isNextDayCycle
                        ? `Lock In Next Day Drop for ${selectedArena?.name || "Squad"} 🌱`
                        : `Lock In Daily Proof for ${selectedArena?.name || "Squad"} ⚡`}
                    </span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
