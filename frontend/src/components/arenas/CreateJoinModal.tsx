"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Key,
  Compass,
  ArrowRight,
  Clock,
  Zap,
  Globe,
  Lock,
  PlusCircle,
  FileCheck,
  Flame,
  Loader2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tribelyService } from "@/services/tribely.service";

interface CreateJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "choose" | "create" | "invite";
}

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

/**
 * CreateJoinModal
 * 
 * Provides a streamlined Google Workspace-style squad deployment wizard and invite code redemption.
 */
export const CreateJoinModal: React.FC<CreateJoinModalProps> = ({
  isOpen,
  onClose,
  initialTab = "choose",
}) => {
  const { triggerHaptic, showToast, refreshArenas, refreshFeed, setActiveTab } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<"choose" | "create" | "invite">(initialTab);

  // Streamlined form states (exactly matching database schema)
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

  // Invite code state
  const [inviteCode, setInviteCode] = useState("");
  const [isJoiningCode, setIsJoiningCode] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("Athletics");
    setIcon("⚡");
    setProofType("image");
    setDeadlineTime("23:59");
    setPenaltyFine(50);
    setIsPrivate(false);
    setInviteCode("");
    setShowEmojiPicker(false);
    setActiveSubTab("choose");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    triggerHaptic([25]);

    const effectiveDescription =
      description.trim() ||
      `Daily ${category} accountability cohort. Consistent daily action required.`;

    const effectiveDeadline = formatTimeTo12Hour(deadlineTime);
    const effectivePenalty = Number(penaltyFine) || 0;

    const res = await tribelyService.createArena({
      name: name.trim(),
      category: category || "Habit",
      description: effectiveDescription,
      penalty_amount: effectivePenalty,
      is_private: isPrivate,
      proof_type: proofType,
      deadline_time: effectiveDeadline,
      icon_url: icon || "⚡",
    });

    setIsSubmitting(false);

    if (res.success) {
      showToast(`Squad "${name}" launched! ⚔️`, "success");
      handleClose();
      await Promise.all([refreshFeed(), refreshArenas()]);
      setActiveTab("explore");
    } else {
      showToast(res.error || "Failed to create squad", "fire");
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsJoiningCode(true);
    triggerHaptic([25]);

    const res = await tribelyService.joinByInviteCode(inviteCode.trim());
    setIsJoiningCode(false);

    if (res.success) {
      showToast(res.message || "Joined Habit Tribe successfully! 🔥", "success");
      handleClose();
      await refreshArenas();
      setActiveTab("explore");
    } else {
      showToast(res.message || "Invalid invite code", "fire");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED] dark:border-[#303134] bg-white dark:bg-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                activeSubTab === "create"
                  ? "bg-[#E8F0FE] text-[#1A73E8] dark:bg-[#1A73E8]/20 dark:text-[#8AB4F8]"
                  : activeSubTab === "invite"
                  ? "bg-[#FEF7E0] text-[#B06000] dark:bg-[#F9AB00]/20 dark:text-[#F9AB00]"
                  : "bg-[#E8F0FE] text-[#1A73E8] dark:bg-[#1A73E8]/20 dark:text-[#8AB4F8]"
              }`}>
                {activeSubTab === "create" ? <Flame className="w-4 h-4" /> : activeSubTab === "invite" ? <Key className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white">
                  {activeSubTab === "choose" && "Deploy or Join Squad"}
                  {activeSubTab === "create" && "Create High-Stakes Arena"}
                  {activeSubTab === "invite" && "Join Arena with Code"}
                </h3>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  {activeSubTab === "choose" && "Select how you want to expand your accountability ring"}
                  {activeSubTab === "create" && "Establish rules, staking fines, and proof criteria"}
                  {activeSubTab === "invite" && "Enter your invite code to join a private or public arena"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {activeSubTab === "choose" && (
              <div className="space-y-3">
                {/* Option 1: Create New Squad */}
                <button
                  type="button"
                  onClick={() => setActiveSubTab("create")}
                  className="w-full p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] hover:border-[#1A73E8]/50 hover:bg-[#E8F0FE]/30 dark:hover:bg-[#1A73E8]/10 transition-all text-left group flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] dark:bg-[#1A73E8]/20 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center text-lg font-bold group-hover:scale-105 transition-transform">
                      🔥
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-neutral-900 dark:text-white group-hover:text-[#1A73E8] dark:group-hover:text-[#8AB4F8] transition-colors">
                        Launch a New Arena
                      </h4>
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Set daily proof criteria, penalty fine stakes, and invite your peers.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#1A73E8] dark:group-hover:text-[#8AB4F8] group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Option 2: Join with Invite Code */}
                <button
                  type="button"
                  onClick={() => setActiveSubTab("invite")}
                  className="w-full p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] hover:border-[#F9AB00]/50 hover:bg-[#FEF7E0]/30 dark:hover:bg-[#F9AB00]/10 transition-all text-left group flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FEF7E0] dark:bg-[#F9AB00]/20 text-[#B06000] dark:text-[#F9AB00] flex items-center justify-center text-lg font-bold group-hover:scale-105 transition-transform">
                      🔑
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-neutral-900 dark:text-white group-hover:text-[#B06000] dark:group-hover:text-[#F9AB00] transition-colors">
                        Redeem Invite Code
                      </h4>
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Got a 6-character private invite key from a peer? Enter it here.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#B06000] dark:group-hover:text-[#F9AB00] group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Option 3: Explore Public Arenas */}
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    setActiveTab("explore");
                  }}
                  className="w-full p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] hover:border-[#0F9D58]/50 hover:bg-[#E6F4EA]/30 dark:hover:bg-[#0F9D58]/10 transition-all text-left group flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] dark:bg-[#0F9D58]/20 text-[#0F9D58] dark:text-[#81C995] flex items-center justify-center text-lg font-bold group-hover:scale-105 transition-transform">
                      🧭
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-neutral-900 dark:text-white group-hover:text-[#0F9D58] dark:group-hover:text-[#81C995] transition-colors">
                        Browse Active Habit Tribes
                      </h4>
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Discover open cohorts in athletics, deep coding, and nutrition.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#0F9D58] dark:group-hover:text-[#81C995] group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            )}

            {activeSubTab === "create" && (
              <form onSubmit={handleCreateSquad} className="space-y-4">
                {/* 1. Squad Name with integrated Icon Picker */}
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
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("choose")}
                    className="py-2 px-5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#2A2B2E] transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="py-2.5 px-6 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition disabled:opacity-50 shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deploying...</span>
                      </>
                    ) : (
                      <span>Create Arena</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === "invite" && (
              <form onSubmit={handleJoinByCode} className="space-y-4">
                <div>
                  <div className="text-center space-y-1.5 py-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FEF7E0] dark:bg-[#F9AB00]/15 border border-[#FEEFC3] dark:border-[#F9AB00]/25 flex items-center justify-center mx-auto text-[#B06000] dark:text-[#F9AB00]">
                      <Key className="w-6 h-6" />
                    </div>
                    <h4 className="text-[15px] font-semibold text-neutral-900 dark:text-white">
                      Enter Cohort Pass-Key
                    </h4>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
                      Ask the arena host or check your squad huddle for the 6-character code.
                    </p>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A9B4X2"
                    className="w-full px-4 py-3 rounded-xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-base font-mono tracking-widest text-center uppercase text-[#1A73E8] dark:text-[#8AB4F8] placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-[#1A73E8]"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("choose")}
                    className="flex-1 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 dark:bg-[#202124] dark:hover:bg-[#2A2B2E] dark:text-neutral-300 text-xs font-medium transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isJoiningCode || !inviteCode.trim()}
                    className="flex-2 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {isJoiningCode ? "Verifying Pass-Key..." : "Join Arena 🔑"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
