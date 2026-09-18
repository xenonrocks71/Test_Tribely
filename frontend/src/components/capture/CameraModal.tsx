"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Upload,
  Link2,
  FileText,
  Video,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Trophy,
  Sparkles,
  AlertCircle,
  Clipboard,
  Image as ImageIcon,
  ExternalLink,
  Shield,
  ChevronRight,
  Send,
  Loader2,
} from "lucide-react";
import { useApp, HabitArena } from "@/context/AppContext";
import { tribelyService } from "@/services/tribely.service";
import { offlineProofQueue } from "@/utils/offlineProofQueue";

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
  progressPercent: number;
  urgencyLevel: "urgent" | "active" | "next_day";
}

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

  const hDisplay = targetHours % 12 || 12;
  const period = targetHours >= 12 ? "PM" : "AM";
  const mDisplay = targetMinutes < 10 ? `0${targetMinutes}` : `${targetMinutes}`;
  const displayCutoffTime = `${hDisplay}:${mDisplay} ${period}`;

  const isPassedToday = currentTotalMinutes >= cutoffTotalMinutes;

  if (!isPassedToday) {
    const diffSeconds = Math.max(0, cutoffTotalSeconds - currentTotalSeconds);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const hours = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    let countdownFormatted = "";
    if (hours > 0) {
      countdownFormatted = `${hours}h ${mins}m`;
    } else if (mins > 0) {
      countdownFormatted = `${mins}m ${secs}s`;
    } else {
      countdownFormatted = `${secs}s`;
    }

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
    const secondsToMidnight = 86400 - currentTotalSeconds;
    const diffSeconds = secondsToMidnight + cutoffTotalSeconds;
    const diffMinutes = Math.floor(diffSeconds / 60);
    const hours = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    const countdownFormatted = `${hours}h ${mins}m`;

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
// 2. CameraModal Component (Proof Submission Portal)
// ─────────────────────────────────────────────────────────────────────────────

export const CameraModal: React.FC = () => {
  const {
    isCameraModalOpen,
    closeCamera,
    initialCameraArenaId,
    arenas,
    dropProofOptimistic,
    triggerHaptic,
    showToast,
    completedArenaIdsToday,
    isArenaCompletedToday,
    user,
    refreshUser,
  } = useApp();

  // ── Navigation Flow State: "select_arena" (Stage 1) or "input_proof" (Stage 2) ──
  const [viewMode, setViewMode] = useState<"select_arena" | "input_proof">("select_arena");
  const [selectedArenaId, setSelectedArenaId] = useState<string>("");

  // ── Live Second-by-Second Ticker ──
  const [tickerTime, setTickerTime] = useState<Date>(new Date());
  useEffect(() => {
    if (!isCameraModalOpen) return;
    const interval = setInterval(() => {
      setTickerTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isCameraModalOpen]);

  // ── Sorted Squads with Completion & Urgency Status ──
  const squadItems = useMemo(() => {
    return arenas.map((arena) => {
      const isCompleted = isArenaCompletedToday(arena.id);
      const timeline = parseArenaDeadline(arena.deadlineTime, tickerTime);
      const normProofType = (arena.proofType || "image").toLowerCase();

      let proofCategory: "link" | "image" | "video" | "text" = "image";
      if (normProofType.includes("link") || normProofType.includes("url")) proofCategory = "link";
      else if (normProofType.includes("video") || normProofType.includes("clip")) proofCategory = "video";
      else if (normProofType.includes("text") || normProofType.includes("reflection")) proofCategory = "text";
      else proofCategory = "image";

      return {
        arena,
        isCompleted,
        timeline,
        proofCategory,
      };
    }).sort((a, b) => {
      // Pending squads first, completed squads last
      if (a.isCompleted && !b.isCompleted) return 1;
      if (!a.isCompleted && b.isCompleted) return -1;
      return a.timeline.totalMinutesRemaining - b.timeline.totalMinutesRemaining;
    });
  }, [arenas, completedArenaIdsToday, isArenaCompletedToday, tickerTime]);

  // Total completed counts
  const totalSquads = squadItems.length;
  const totalCompleted = squadItems.filter((s) => s.isCompleted).length;
  const isGrandSlam = totalSquads > 0 && totalCompleted === totalSquads;

  // Track modal open/close transition so viewMode is ONLY set when modal opens
  const wasOpenRef = useRef(false);
  const [fallbackArena, setFallbackArena] = useState<HabitArena | null>(null);

  useEffect(() => {
    if (isCameraModalOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      if (initialCameraArenaId) {
        setSelectedArenaId(String(initialCameraArenaId));
        setViewMode("input_proof");
        const target = arenas.find(
          (a) =>
            String(a.id) === String(initialCameraArenaId) ||
            String(a.rawId) === String(initialCameraArenaId)
        );
        if (!target) {
          const numId = Number(initialCameraArenaId);
          if (!isNaN(numId) && numId > 0) {
            tribelyService.fetchArenaDetail(numId).then((detail) => {
              if (detail) {
                setFallbackArena({
                  id: String(detail.id),
                  rawId: detail.id,
                  name: detail.name,
                  tag: detail.tag || `#${detail.name}`,
                  emoji: "🔥",
                  description: detail.description || "",
                  memberCount: detail.member_count || 1,
                  penaltyAmount: detail.penalty_amount || 50,
                  deadlineTime: detail.deadline_time || "11:59 PM",
                  countdownMinutesLeft: 60,
                  vaultPoolKudos: detail.sprint_vault || 0,
                  multiplierActive: true,
                  multiplierValue: 1.5,
                  bannerImage: "",
                  proofType:
                    detail.proof_type === "link" || detail.proof_type === "text" || detail.proof_type === "video"
                      ? detail.proof_type
                      : "image",
                  inviteCode: detail.invite_code,
                  isPrivate: detail.is_private,
                });
              }
            }).catch(() => {});
          }
        }
        return;
      }
      // Default to squad selector
      setSelectedArenaId("");
      setViewMode("select_arena");
    } else if (!isCameraModalOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      setSelectedArenaId("");
      setViewMode("select_arena");
    }
  }, [isCameraModalOpen, initialCameraArenaId, arenas]);

  const activeSquadItem = useMemo(() => {
    if (!selectedArenaId) return null;
    const item = squadItems.find(
      (s) =>
        String(s.arena.id) === String(selectedArenaId) ||
        String(s.arena.rawId) === String(selectedArenaId)
    );
    if (item) return item;
    if (
      fallbackArena &&
      (String(fallbackArena.id) === String(selectedArenaId) ||
        String(fallbackArena.rawId) === String(selectedArenaId))
    ) {
      const normProofType = (fallbackArena.proofType || "image").toLowerCase();
      let proofCategory: "link" | "image" | "video" | "text" = "image";
      if (normProofType.includes("link") || normProofType.includes("url")) proofCategory = "link";
      else if (normProofType.includes("video") || normProofType.includes("clip")) proofCategory = "video";
      else if (normProofType.includes("text") || normProofType.includes("reflection")) proofCategory = "text";
      else proofCategory = "image";

      return {
        arena: fallbackArena,
        isCompleted: false,
        timeline: parseArenaDeadline(fallbackArena.deadlineTime, tickerTime),
        proofCategory,
      };
    }
    return null;
  }, [squadItems, selectedArenaId, fallbackArena, tickerTime]);

  const selectedArena = useMemo(() => {
    if (activeSquadItem?.arena) return activeSquadItem.arena;
    if (!selectedArenaId) return null;
    const found = arenas.find(
      (a) =>
        String(a.id) === String(selectedArenaId) ||
        String(a.rawId) === String(selectedArenaId)
    );
    if (found) return found;
    if (
      fallbackArena &&
      (String(fallbackArena.id) === String(selectedArenaId) ||
        String(fallbackArena.rawId) === String(selectedArenaId))
    ) {
      return fallbackArena;
    }
    return null;
  }, [activeSquadItem, arenas, selectedArenaId, fallbackArena]);

  const selectedProofCategory =
    activeSquadItem?.proofCategory ||
    selectedArena?.proofType ||
    (selectedArena as any)?.proof_type ||
    "image";

  // ── Tailored Proof Input State ──
  // For Image / Photo
  const [imageSubMode, setImageSubMode] = useState<"upload" | "camera">("upload");
  const [imageProofUrl, setImageProofUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // For Link
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);

  // For Video
  const [videoProofUrl, setVideoProofUrl] = useState<string | null>(null);

  // For Text
  const [textProof, setTextProof] = useState("");

  // Caption / reflection note
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Media Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Clean up camera on unmount or view change
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // When leaving Stage 2 or closing modal, shut down camera
  useEffect(() => {
    if (!isCameraModalOpen || viewMode !== "input_proof" || imageSubMode !== "camera") {
      stopCameraStream();
    }
  }, [isCameraModalOpen, viewMode, imageSubMode, stopCameraStream]);

  // Start Camera ONLY when user explicitly clicks "Take Photo with Camera"
  const startCamera = useCallback(async (facing: "user" | "environment") => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported on this browser.");
      return;
    }

    stopCameraStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      setCameraError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError("Camera access denied or unavailable. Please choose 'Upload Photo' instead.");
      setIsCameraActive(false);
    }
  }, [stopCameraStream]);

  // Toggle Camera Facing
  const handleFlipCamera = () => {
    triggerHaptic([15]);
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Synthetic shutter click sound
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  };

  // Snap photo from live camera
  const handleSnapPhoto = () => {
    playShutterSound();
    triggerHaptic([35, 55]);
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 90);

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
        setImageProofUrl(dataUrl);
        stopCameraStream();
        showToast("Photo captured! 📸", "success");
      }
    }
  };

  // Handle Photo File Upload
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic([20]);
    setIsUploadingMedia(true);

    // Read preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setImageProofUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to backend storage
    try {
      const uploadRes = await tribelyService.uploadMediaFile(file);
      if (uploadRes.success && uploadRes.url) {
        setImageProofUrl(uploadRes.url);
        showToast("Photo uploaded successfully! 📁", "success");
      } else {
        showToast("Photo loaded for verification.", "info");
      }
    } catch {
      showToast("Photo loaded for verification.", "info");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Handle Video File Upload
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast("Video exceeds 25MB limit. Please choose a shorter clip.", "info");
      return;
    }

    triggerHaptic([20]);
    setIsUploadingMedia(true);

    const reader = new FileReader();
    reader.onload = () => {
      setVideoProofUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const uploadRes = await tribelyService.uploadMediaFile(file);
      if (uploadRes.success && uploadRes.url) {
        setVideoProofUrl(uploadRes.url);
        showToast("Video clip loaded! 📹", "success");
      }
    } catch {
      showToast("Video loaded.", "info");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // ── Link Domain Recognition Helper ──
  const getLinkMeta = (url: string) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes("leetcode.com")) {
        return { platform: "LeetCode", badge: "LeetCode ⚡", color: "#FFA116", icon: "⚡" };
      }
      if (host.includes("github.com")) {
        return { platform: "GitHub", badge: "GitHub 🐙", color: "#A78BFA", icon: "🐙" };
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
          badge: "YouTube 🔴",
          color: "#EF4444",
          icon: "🔴",
          thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
        };
      }
      if (host.includes("strava.com")) {
        return { platform: "Strava", badge: "Strava 🏃", color: "#FC4C02", icon: "🏃" };
      }
      return { platform: host.replace("www.", ""), badge: "Verified Link ↗", color: "#10B981", icon: "↗" };
    } catch {
      return null;
    }
  };

  const linkMeta = linkUrl.trim() ? getLinkMeta(linkUrl.trim()) : null;

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      setIsPasting(true);
      triggerHaptic([15]);
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith("http") || text.includes(".com") || text.includes(".io") || text.includes(".org"))) {
          const finalUrl = text.startsWith("http") ? text.trim() : `https://${text.trim()}`;
          setLinkUrl(finalUrl);
          setLinkError(null);
          showToast("Link pasted from clipboard! 📋", "success");
        } else {
          showToast("No valid web link in clipboard.", "info");
        }
      } else {
        showToast("Clipboard not accessible.", "info");
      }
    } catch {
      showToast("Clipboard permission required.", "info");
    } finally {
      setIsPasting(false);
    }
  };

  // Determine current active proof payload based on selected arena's proof type
  const currentProofPayload = useMemo(() => {
    if (selectedProofCategory === "link") return linkUrl.trim();
    if (selectedProofCategory === "image") return imageProofUrl;
    if (selectedProofCategory === "video") return videoProofUrl;
    if (selectedProofCategory === "text") return textProof.trim();
    return null;
  }, [selectedProofCategory, linkUrl, imageProofUrl, videoProofUrl, textProof]);

  const isProofReady = Boolean(currentProofPayload && currentProofPayload.length > 0);

  // Transition from Stage 1 to Stage 2 for a specific arena
  const handleSelectSquad = (arenaId: string | number) => {
    triggerHaptic([20]);
    const cleanId = String(arenaId);
    setSelectedArenaId(cleanId);
    // Reset inputs for clean state
    setImageProofUrl(null);
    setVideoProofUrl(null);
    setLinkUrl("");
    setTextProof("");
    setCaption("");
    setLinkError(null);
    setImageSubMode("upload");
    stopCameraStream();
    setViewMode("input_proof");
  };

  // Return from Stage 2 back to Stage 1 Squad Selector
  const handleBackToSquads = () => {
    triggerHaptic([15]);
    stopCameraStream();
    setViewMode("select_arena");
  };

  // ── Single-Button Proof Submission ──
  const handleSubmitProof = async () => {
    if (!selectedArena) {
      showToast("Please select a habit squad.", "info");
      return;
    }

    if (activeSquadItem?.isCompleted) {
      showToast(`Proof already verified for ${selectedArena.name} today! ✓`, "info");
      return;
    }

    if (!currentProofPayload) {
      if (selectedProofCategory === "link") showToast("Please paste your verification link.", "info");
      else if (selectedProofCategory === "image") showToast("Please upload or take a photo.", "info");
      else if (selectedProofCategory === "video") showToast("Please upload a video clip.", "info");
      else showToast("Please write your habit reflection.", "info");
      return;
    }

    if (selectedProofCategory === "link" && !currentProofPayload.startsWith("http")) {
      setLinkError("Please enter a valid link starting with http:// or https://");
      return;
    }

    triggerHaptic([40, 80, 50]);
    setIsSubmitting(true);

    const isNextDay = activeSquadItem?.timeline.isNextDayCycle;
    const captureMoment = new Date().toISOString();

    const userCaption = caption?.trim();
    const defaultDateCaption = new Date().toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
    const finalCaption = userCaption || defaultDateCaption;

    // 1. Instant Optimistic update to mark user present
    dropProofOptimistic({
      arenaId: selectedArena.id,
      image: currentProofPayload,
      selfie: user.avatar,
      caption: finalCaption,
      telemetry:
        selectedProofCategory === "link"
          ? `${linkMeta?.platform || "Link"} Verified • ${isNextDay ? "Next Day Cycle" : "On-Time Drop"}`
          : selectedProofCategory === "video"
          ? "Video Verified • On-Time Drop 📹"
          : selectedProofCategory === "text"
          ? "Reflection Verified • On-Time Drop 📝"
          : isNextDay
          ? "Photo Verified • Next Day Cycle 🌱"
          : "Photo Verified • On-Time Drop ⚡",
      keepOpen: true,
    });

    // Offline check: If offline, queue locally immediately
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (selectedArena.rawId) {
        offlineProofQueue.enqueueProof(
          selectedArena.rawId,
          currentProofPayload,
          finalCaption,
          captureMoment
        );
      }
      showToast(`Offline: Proof saved locally with capture timestamp! Will auto-sync to ${selectedArena.name} when online 💾`, "info");
      setImageProofUrl(null);
      setVideoProofUrl(null);
      setLinkUrl("");
      setTextProof("");
      setCaption("");
      stopCameraStream();
      setViewMode("select_arena");
      setIsSubmitting(false);
      return;
    }

    try {
      // 2. Direct real API submission for this arena only
      if (selectedArena.rawId) {
        const subRes = await tribelyService.submitProof({
          arena_id: selectedArena.rawId,
          proof_url: currentProofPayload,
          caption: finalCaption,
          client_submitted_at: captureMoment,
        });

        if (!subRes.success) {
          // If network / connectivity issue occurred, queue offline
          if (
            subRes.message?.includes("Network") ||
            subRes.message?.includes("Failed to fetch") ||
            subRes.message?.includes("connection")
          ) {
            offlineProofQueue.enqueueProof(
              selectedArena.rawId,
              currentProofPayload,
              caption || `Daily proof drop for ${selectedArena.name}.`,
              captureMoment
            );
            showToast(`Connection interrupted: Proof stored locally with timestamp and queued for sync 💾`, "info");
          } else {
            showToast(subRes.message || `Proof submission issue for ${selectedArena.name}`, "info");
          }
        } else {
          showToast(`✓ Proof verified for ${selectedArena.name}! Marked Present for Today 🔥`, "success");
          refreshUser().catch(() => {});
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("refresh_wallet"));
          }
        }
      }

      // Reset inputs
      setImageProofUrl(null);
      setVideoProofUrl(null);
      setLinkUrl("");
      setTextProof("");
      setCaption("");
      stopCameraStream();

      // Return to Stage 1 or close if opened directly for a specific arena
      if (initialCameraArenaId) {
        closeCamera();
      } else {
        setViewMode("select_arena");
      }
    } catch (err: any) {
      if (selectedArena.rawId) {
        offlineProofQueue.enqueueProof(
          selectedArena.rawId,
          currentProofPayload,
          caption || `Daily proof drop for ${selectedArena.name}.`,
          captureMoment
        );
      }
      showToast(`Saved offline: Will sync automatically to ${selectedArena.name} when connected 💾`, "info");
      if (initialCameraArenaId) {
        closeCamera();
      } else {
        setViewMode("select_arena");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCameraModalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-0 sm:p-4 select-none overflow-hidden"
      >
        <canvas ref={canvasRef} className="hidden" />

        {/* Hidden File Pickers */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileChange}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoFileChange}
        />

        {/* Main Proof Submission Window */}
        <div className="relative w-full max-w-lg h-full sm:h-[92vh] sm:max-h-[820px] sm:rounded-[36px] bg-[#1E1E1E] border border-[#303134] flex flex-col justify-between shadow-2xl overflow-hidden text-white">

          {/* ── TOP PROGRESS TRACKER ── */}
          <div className="px-4 pt-3 pb-1 flex gap-1.5 w-full bg-[#1E1E1E] shrink-0">
            {squadItems.map((s, idx) => (
              <div
                key={s.arena.id || idx}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  s.isCompleted
                    ? "bg-[#0F9D58]"
                    : "bg-neutral-800"
                }`}
                title={`${s.arena.name}: ${s.isCompleted ? "Completed" : "Pending"}`}
              />
            ))}
          </div>

          {/* ── HEADER BAR ── */}
          <header className="px-5 py-3 flex items-center justify-between gap-3 border-b border-[#303134] shrink-0 bg-[#1E1E1E]">
            {viewMode === "input_proof" ? (
              <button
                type="button"
                onClick={handleBackToSquads}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#202124] hover:bg-[#303134] text-xs font-medium text-neutral-300 hover:text-white transition cursor-pointer border border-[#303134]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Squads</span>
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#8AB4F8]/15 border border-[#D2E3FC] dark:border-[#8AB4F8]/30 flex items-center justify-center text-[#1A73E8] dark:text-[#8AB4F8]">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight leading-tight">Habit Check-In</h2>
                  <p className="text-[11px] text-neutral-400">
                    {totalCompleted} of {totalSquads} habits locked in today
                  </p>
                </div>
              </div>
            )}

            {/* Right: Streak status & Close Button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF7E0] dark:bg-[#F9AB00]/15 border border-[#FEEFC3] dark:border-[#F9AB00]/25 text-amber-600 dark:text-amber-400 text-xs font-medium">
                <Flame className="w-3.5 h-3.5 fill-amber-500" />
                <span>{user.currentStreak}d Streak</span>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="w-8 h-8 rounded-full bg-[#202124] hover:bg-[#303134] text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-[#303134]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ── STAGE 1: ARENA / SQUAD SELECTOR PORTAL ── */}
          {viewMode === "select_arena" && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Encouragement Banner */}
              {isGrandSlam ? (
                <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/10 border border-emerald-500/30 flex items-center gap-3.5 shadow-lg shadow-emerald-500/10">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Trophy className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">Grand Slam Achieved! 🏆</h3>
                    <p className="text-xs text-neutral-200 mt-0.5 leading-relaxed">
                      All your habit squads are 100% verified today. Consistency compounded!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-base font-black text-white">Select a Habit Squad</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Click a squad below to open its tailored proof verification window.
                  </p>
                </div>
              )}

              {/* Squads List */}
              {squadItems.length === 0 ? (
                <div className="py-12 px-6 rounded-3xl border border-neutral-900 bg-neutral-950/60 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto text-orange-400">
                    <Shield className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white">No Habit Squads Enrolled</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                    Join or create an accountability squad to start verifying habits and earning consistency rewards.
                  </p>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Explore Arenas
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {squadItems.map(({ arena, isCompleted, timeline, proofCategory }) => {
                    const isUrgent = !isCompleted && timeline.urgencyLevel === "urgent";
                    const arenaKey = String(arena.id || arena.rawId);

                    return (
                      <motion.div
                        key={arenaKey}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          if (isCompleted) {
                            showToast(`✓ Today's proof already verified for ${arena.name}!`, "info");
                          } else {
                            handleSelectSquad(arenaKey);
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3.5 ${
                          isCompleted
                            ? "bg-[#202124]/50 border-[#137333]/30"
                            : isUrgent
                            ? "bg-[#202124] border-[#D93025]/40 shadow-xs"
                            : "bg-[#202124] border-[#303134] hover:border-[#3C4043] shadow-xs"
                        }`}
                      >
                        {/* Left: Emoji + Info */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                              isCompleted
                                ? "bg-[#137333]/20 border-[#137333]/30 text-[#81C995]"
                                : "bg-[#2C2D30] border-[#3C4043] text-white"
                            }`}
                          >
                            {arena.emoji || "⚔️"}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white truncate">{arena.name}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2C2D30] font-mono text-neutral-400 shrink-0">
                                {arena.tag}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              {/* Proof Type Badge */}
                              <span className="flex items-center gap-1 font-medium text-neutral-300">
                                {proofCategory === "link" && <Link2 className="w-3 h-3 text-[#8AB4F8]" />}
                                {proofCategory === "image" && <ImageIcon className="w-3 h-3 text-[#81C995]" />}
                                {proofCategory === "video" && <Video className="w-3 h-3 text-[#C58AF9]" />}
                                {proofCategory === "text" && <FileText className="w-3 h-3 text-[#FDD663]" />}
                                <span className="capitalize">{proofCategory} Proof</span>
                              </span>

                              <span className="text-neutral-600">·</span>

                              {/* Stake */}
                              <span className="font-mono text-amber-400 font-medium">
                                ⚡ ₹{arena.penaltyAmount || 50} Stake
                              </span>

                              <span className="text-neutral-600">·</span>

                              {/* Deadline remaining */}
                              <span
                                className={`flex items-center gap-1 font-mono ${
                                  isUrgent ? "text-rose-400 font-medium" : "text-neutral-400"
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>{isCompleted ? "Closed" : timeline.countdownFormatted + " left"}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Action / Status */}
                        <div className="shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#137333]/20 border border-[#137333]/30 text-[#81C995] text-xs font-medium">
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>Done</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSquad(arenaKey);
                              }}
                              className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition cursor-pointer shadow-xs active:scale-95"
                            >
                              <span>Submit</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STAGE 2: TAILORED PROOF INPUT WINDOW ── */}
          {viewMode === "input_proof" && selectedArena && (
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col justify-between space-y-4">
              {/* Selected Arena Header Banner */}
              <div className="p-4 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedArena.emoji || "⚔️"}</span>
                    <div>
                      <h3 className="text-sm font-black text-white">{selectedArena.name}</h3>
                      <p className="text-[11px] text-neutral-400">
                        Deadline: {selectedArena.deadlineTime} • {activeSquadItem?.timeline.countdownFormatted} remaining
                      </p>
                    </div>
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-[11px] font-bold text-neutral-300 capitalize flex items-center gap-1.5">
                    {selectedProofCategory === "link" && <Link2 className="w-3 h-3 text-cyan-400" />}
                    {selectedProofCategory === "image" && <ImageIcon className="w-3 h-3 text-emerald-400" />}
                    {selectedProofCategory === "video" && <Video className="w-3 h-3 text-purple-400" />}
                    {selectedProofCategory === "text" && <FileText className="w-3 h-3 text-amber-400" />}
                    <span>{selectedProofCategory} Proof</span>
                  </div>
                </div>
              </div>

              {/* ── FORM A: LINK PROOF INPUT (LeetCode, GitHub, Strava, Web) ── */}
              {selectedProofCategory === "link" && (
                <div className="flex-1 flex flex-col justify-center space-y-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Link2 className="w-4 h-4 text-cyan-400" />
                        <span>Verification Link</span>
                      </label>
                      <button
                        type="button"
                        onClick={handlePasteClipboard}
                        disabled={isPasting}
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-xs font-bold text-emerald-400 border border-neutral-800 transition cursor-pointer"
                      >
                        <Clipboard className="w-3 h-3" />
                        <span>{isPasting ? "Pasting..." : "Paste Link"}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Paste the link to your GitHub PR, LeetCode submission, Strava workout, or article.
                    </p>
                  </div>

                  {/* URL Input Box */}
                  <div className="space-y-1.5">
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => {
                        setLinkUrl(e.target.value);
                        setLinkError(null);
                      }}
                      placeholder="https://leetcode.com/... or github.com/..."
                      className="w-full px-4 py-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-xs text-white placeholder-neutral-500 font-mono transition"
                    />

                    {linkError && (
                      <p className="text-xs text-rose-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{linkError}</span>
                      </p>
                    )}
                  </div>

                  {/* Detected Platform Card */}
                  {linkMeta && (
                    <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base"
                        style={{ backgroundColor: `${linkMeta.color}20`, color: linkMeta.color }}
                      >
                        {linkMeta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-mono font-bold" style={{ color: linkMeta.color }}>
                          {linkMeta.badge}
                        </span>
                        <p className="text-xs text-white truncate font-medium">{linkUrl}</p>
                      </div>
                    </div>
                  )}

                  {/* YouTube Thumbnail Preview if detected */}
                  {linkMeta?.thumbnail && (
                    <div className="rounded-2xl overflow-hidden border border-neutral-800 aspect-video max-h-40 mx-auto">
                      <img src={linkMeta.thumbnail} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}

              {/* ── FORM B: IMAGE PROOF INPUT (Upload or Live Camera) ── */}
              {selectedProofCategory === "image" && (
                <div className="flex-1 flex flex-col space-y-3">
                  {/* Option Tabs: Upload Photo vs Take Photo */}
                  {!imageProofUrl && (
                    <div className="flex items-center p-1 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic([10]);
                          setImageSubMode("upload");
                          stopCameraStream();
                        }}
                        className={`flex-1 py-2 rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
                          imageSubMode === "upload"
                            ? "bg-white text-neutral-950 shadow-sm"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo / File</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic([10]);
                          setImageSubMode("camera");
                          startCamera(cameraFacing);
                        }}
                        className={`flex-1 py-2 rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
                          imageSubMode === "camera"
                            ? "bg-white text-neutral-950 shadow-sm"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Take Photo (Camera)</span>
                      </button>
                    </div>
                  )}

                  {/* If Photo is Selected/Snapped: Display Preview */}
                  {imageProofUrl ? (
                    <div className="relative flex-1 min-h-[260px] rounded-3xl overflow-hidden border border-neutral-800 bg-black flex items-center justify-center">
                      <img src={imageProofUrl} alt="Proof preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic([15]);
                          setImageProofUrl(null);
                          if (imageSubMode === "camera") {
                            startCamera(cameraFacing);
                          }
                        }}
                        className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer shadow-lg"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Change / Retake Photo</span>
                      </button>
                    </div>
                  ) : imageSubMode === "upload" ? (
                    /* Upload Drag & Drop Viewport */
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 min-h-[240px] rounded-3xl border-2 border-dashed border-neutral-800 hover:border-emerald-500/60 bg-neutral-950 flex flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer transition group"
                    >
                      <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition shadow-[0_0_24px_rgba(16,185,129,0.2)]">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white">Choose Photo from Device</h4>
                        <p className="text-[11px] text-neutral-400 max-w-xs">
                          Upload screenshot, gym selfie, or habit photo proof (.jpg, .png, .webp).
                        </p>
                      </div>
                      <span className="px-4 py-2 rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white text-xs font-bold transition flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Browse Files</span>
                      </span>
                    </div>
                  ) : (
                    /* Live Camera Viewport */
                    <div className="relative flex-1 min-h-[260px] rounded-3xl overflow-hidden border border-neutral-800 bg-black flex flex-col justify-between">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className={`w-full h-full object-cover absolute inset-0 rounded-3xl transition-transform duration-300 ${
                          cameraFacing === "user" ? "-scale-x-100" : ""
                        }`}
                      />

                      {/* Shutter flash overlay */}
                      <AnimatePresence>
                        {shutterFlash && (
                          <motion.div
                            initial={{ opacity: 0.95 }}
                            animate={{ opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.09 }}
                            className="absolute inset-0 bg-white z-40 pointer-events-none"
                          />
                        )}
                      </AnimatePresence>

                      {/* Camera Overlays */}
                      <div className="relative z-10 p-3 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/15 backdrop-blur-md text-white text-[10px] font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>CAMERA READY</span>
                        </div>
                      </div>

                      {cameraError ? (
                        <div className="relative z-10 my-auto text-center p-4 text-xs text-rose-300 bg-black/80 mx-4 rounded-2xl border border-rose-500/30 backdrop-blur-md">
                          <p>{cameraError}</p>
                        </div>
                      ) : (
                        /* Shutter & Flip Dock */
                        <div className="relative z-20 p-4 flex items-center justify-around bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                          <button
                            type="button"
                            onClick={handleFlipCamera}
                            className="w-11 h-11 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center transition cursor-pointer"
                            title="Flip Camera"
                          >
                            <RefreshCw className="w-5 h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={handleSnapPhoto}
                            className="w-18 h-18 rounded-full p-1 border-4 border-white flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-95 transition"
                            title="Snap Photo"
                          >
                            <div className="w-full h-full rounded-full bg-white active:bg-neutral-300 transition" />
                          </button>

                          <div className="w-11 h-11" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── FORM C: VIDEO PROOF INPUT (Max 30s) ── */}
              {selectedProofCategory === "video" && (
                <div className="flex-1 flex flex-col space-y-3">
                  {videoProofUrl ? (
                    <div className="relative flex-1 min-h-[260px] rounded-3xl overflow-hidden border border-neutral-800 bg-black flex items-center justify-center">
                      <video
                        src={videoProofUrl}
                        controls
                        playsInline
                        className="w-full h-full object-cover rounded-3xl"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic([15]);
                          setVideoProofUrl(null);
                        }}
                        className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer shadow-lg"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Choose Another Video</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => videoInputRef.current?.click()}
                      className="flex-1 min-h-[240px] rounded-3xl border-2 border-dashed border-neutral-800 hover:border-purple-500/60 bg-neutral-950 flex flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer transition group"
                    >
                      <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition shadow-[0_0_24px_rgba(168,85,247,0.2)]">
                        <Video className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white">Select Short Video Clip</h4>
                        <p className="text-[11px] text-neutral-400 max-w-xs">
                          Upload 30-second verification clip (.mp4, .webm, .mov, max 25MB).
                        </p>
                      </div>
                      <span className="px-4 py-2 rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white text-xs font-bold transition flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Video Clip</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── FORM D: TEXT REFLECTION PROOF INPUT ── */}
              {selectedProofCategory === "text" && (
                <div className="flex-1 flex flex-col space-y-2">
                  <label className="text-xs font-black text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Daily Habit Reflection</span>
                  </label>
                  <textarea
                    value={textProof}
                    onChange={(e) => setTextProof(e.target.value)}
                    rows={6}
                    placeholder="Document today's key milestone, lesson, or output (e.g. Read 20 pages of System Design, completed 5km in 24 mins)..."
                    className="w-full p-4 rounded-2xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:outline-none text-xs text-white placeholder-neutral-500 leading-relaxed transition resize-none"
                  />
                  <div className="flex justify-end text-[10px] font-mono text-neutral-500">
                    {textProof.trim().length} characters
                  </div>
                </div>
              )}

              {/* Optional Reflection / Caption Note Input */}
              <div className="space-y-1">
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add reflection or note (optional)..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* ── SINGLE PROMINENT SUBMIT BUTTON ── */}
              <button
                type="button"
                onClick={handleSubmitProof}
                disabled={!isProofReady || isSubmitting || isUploadingMedia}
                className={`w-full py-3.5 px-4 rounded-full font-medium text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                  !isProofReady || isSubmitting || isUploadingMedia
                    ? "bg-[#202124] text-neutral-500 cursor-not-allowed border border-[#303134]"
                    : "bg-[#0F9D58] hover:bg-[#0B8043] active:scale-[0.99] text-white"
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying proof & locking in attendance...</span>
                  </div>
                ) : isUploadingMedia ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading media...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Submit Proof & Check In ({selectedArena.name})</span>
                  </div>
                )}
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </AnimatePresence>
  );
};
