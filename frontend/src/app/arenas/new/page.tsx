"use client";

import React, { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Zap,
  Globe,
  Lock,
  Loader2,
} from "lucide-react";
import { useApp, AppProvider } from "@/context/AppContext";
import { tribelyService } from "@/services/tribely.service";

const SQUAD_CATEGORIES = [
  { label: "Athletics", emoji: "🏃" },
  { label: "Code & Build", emoji: "💻" },
  { label: "Deep Focus", emoji: "⚡" },
  { label: "Mind & Body", emoji: "🧘" },
  { label: "Nutrition", emoji: "🥗" },
  { label: "Study & Reading", emoji: "📚" },
];

const EMOJI_OPTIONS = ["⚡", "🏃", "💻", "🧘", "🥗", "📚", "🏋️", "🎯", "🔥", "💧", "✍️", "🌅"];

const formatTimeTo12Hour = (timeVal: string): string => {
  if (!timeVal) return "11:59 PM";
  if (timeVal.includes("AM") || timeVal.includes("PM")) return timeVal;
  const [hoursStr, minutesStr] = timeVal.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr || "0", 10);
  if (isNaN(hours)) return "11:59 PM";
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 === 0 ? 12 : hours % 12;
  const m = minutes.toString().padStart(2, "0");
  return `${h.toString().padStart(2, "0")}:${m} ${period}`;
};

function NewArenaContent() {
  const router = useRouter();
  const { triggerHaptic, showToast, refreshArenas, refreshFeed, refreshUser } = useApp();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("⚡");
  const [category, setCategory] = useState("Athletics");
  const [description, setDescription] = useState("");
  const [proofType, setProofType] = useState<"image" | "link" | "text">("image");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [penaltyFine, setPenaltyFine] = useState<number | string>(50);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    triggerHaptic([25]);

    const effectiveDesc = description.trim() || `Daily ${category} accountability cohort. Consistent action required.`;
    const effectiveDeadline = formatTimeTo12Hour(deadlineTime);
    const effectivePenalty = Number(penaltyFine) || 0;

    const res = await tribelyService.createArena({
      name: name.trim(),
      category: category || "Habit",
      description: effectiveDesc,
      penalty_amount: effectivePenalty,
      is_private: isPrivate,
      proof_type: proofType,
      deadline_time: effectiveDeadline,
      icon_url: icon || "⚡",
    });

    setIsSubmitting(false);

    if (res.success) {
      showToast(`Arena "${name}" launched! ⚔️`, "success");
      await Promise.all([refreshFeed(), refreshArenas(), refreshUser()]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh_wallet"));
      }
      const newId = res.data?.id;
      if (newId) {
        router.push(`/arenas/${newId}`);
      } else {
        router.push("/feed");
      }
    } else {
      showToast(res.error || "Failed to create arena", "fire");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] text-neutral-900 dark:text-white pb-24">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#121212]/90 backdrop-blur-md border-b border-[#E8EAED] dark:border-[#303134] px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              triggerHaptic([10]);
              router.back();
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition cursor-pointer p-1.5 -ml-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-[#202124]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0F9D58]" />
            <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Create High-Stakes Arena</h1>
          </div>
          <div className="w-12" />
        </div>
      </header>

      {/* Main Centered Google Form */}
      <main className="max-w-xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl p-5 sm:p-7 shadow-xs">
          <div className="mb-5 pb-4 border-b border-[#E8EAED] dark:border-[#303134]">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Arena Details
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Set commitment rules, proof criteria, and staking fines for your cohort.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Arena Name with integrated Icon Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
                  Arena Name *
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {name.length}/60
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    className="w-10 h-10 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] flex items-center justify-center text-xl hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] transition cursor-pointer shrink-0"
                    title="Change Emblem"
                  >
                    {icon}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-12 left-0 z-30 p-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] shadow-xl grid grid-cols-4 gap-1.5 w-44">
                      {EMOJI_OPTIONS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            triggerHaptic([10]);
                            setIcon(em);
                            setShowEmojiPicker(false);
                          }}
                          className="w-9 h-9 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#303134] flex items-center justify-center text-lg cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 5AM High-Output Runners"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[13px] text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]/30 transition"
                />
              </div>
            </div>

            {/* 2. Category Chips */}
            <div>
              <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SQUAD_CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setCategory(cat.label);
                      setIcon(cat.emoji);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                      category === cat.label
                        ? "bg-[#1A73E8] text-white shadow-xs"
                        : "bg-[#F8F9FA] dark:bg-[#202124] text-neutral-700 dark:text-neutral-300 border border-[#E8EAED] dark:border-[#303134] hover:bg-neutral-100 dark:hover:bg-[#2A2B2E]"
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Daily Proof Type */}
            <div>
              <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Daily Proof Requirement
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "image", label: "Photo Proof", icon: "📸" },
                  { id: "link", label: "Web Link", icon: "🔗" },
                  { id: "text", label: "Daily Log", icon: "📝" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic([10]);
                      setProofType(item.id as "image" | "link" | "text");
                    }}
                    className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-center gap-2 cursor-pointer ${
                      proofType === item.id
                        ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8] dark:bg-[#1A73E8]/20 dark:border-[#8AB4F8] dark:text-[#8AB4F8] font-medium shadow-xs"
                        : "bg-[#F8F9FA] dark:bg-[#202124] border-[#E8EAED] dark:border-[#303134] text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="text-xs">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Daily Cutoff & Miss Penalty Fine (Direct Inputs, No Presets) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                    <span>Daily Cutoff Deadline</span>
                  </span>
                  <span className="text-[11px] font-mono font-medium text-[#1A73E8] dark:text-[#8AB4F8]">
                    {formatTimeTo12Hour(deadlineTime)}
                  </span>
                </label>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-xs font-medium text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]/30 transition cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Daily Miss Fine</span>
                  </span>
                  <span className="text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400">
                    {Number(penaltyFine) > 0 ? `⚡${penaltyFine} Kudos` : "No fine"}
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-500 text-xs font-bold">
                    ⚡
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={penaltyFine}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPenaltyFine(val === "" ? "" : Math.max(0, parseInt(val, 10) || 0));
                    }}
                    placeholder="Enter stake fine (e.g. 50)"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-xs font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]/30 transition"
                  />
                </div>
              </div>
            </div>

            {/* 5. Daily Standard / Mission (Optional) */}
            <div>
              <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Daily Commitment Rule <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 5km outdoor run or 45min gym session"
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#1A73E8]"
              />
            </div>

            {/* 6. Privacy Setting (Google Material Switch) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134]">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                  isPrivate
                    ? "bg-[#FEF7E0] text-amber-800 dark:bg-[#F9AB00]/20 dark:text-[#F9AB00]"
                    : "bg-[#E8F0FE] text-[#1A73E8] dark:bg-[#1A73E8]/20 dark:text-[#8AB4F8]"
                }`}>
                  {isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-medium text-neutral-900 dark:text-white">
                    {isPrivate ? "Private Cohort" : "Public Arena"}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {isPrivate ? "Require invite code to join" : "Anyone can discover and join"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic([10]);
                  setIsPrivate(!isPrivate);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  isPrivate ? "bg-[#1A73E8]" : "bg-neutral-300 dark:bg-neutral-700"
                }`}
                aria-label="Toggle Arena Privacy"
              >
                <span
                  className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    isPrivate ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 7. Action Buttons */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[13px] font-medium transition disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Launching Arena...</span>
                  </>
                ) : (
                  <span>Create Arena</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function NewArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] text-neutral-500 flex items-center justify-center text-xs font-medium">
          Loading creation studio...
        </div>
      }
    >
      <AppProvider>
        <NewArenaContent />
      </AppProvider>
    </Suspense>
  );
}
