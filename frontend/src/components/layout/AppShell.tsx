"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Compass,
  Trophy,
  Send,
  Zap,
  Camera,
  Search,
  CheckCircle2,
  Bell,
  Sparkles,
  Shield,
  Flame,
  PlusSquare,
  SquarePlus,
  Heart,
  ChevronDown,
  X,
  Key,
  Users,
  Lock,
  Globe,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useApp, NavTab } from "@/context/AppContext";
import { tribelyService } from "@/services/tribely.service";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    activeTab,
    setActiveTab,
    openCamera,
    openDm,
    openMessagesInbox,
    arenas,
    unreadDmsCount,
    toast,
    triggerHaptic,
    showToast,
  } = useApp();

  // Modals state for Instagram Header actions
  const [isCreateJoinModalOpen, setIsCreateJoinModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [createJoinTab, setCreateJoinTab] = useState<"choose" | "create" | "invite">("choose");

  // Create squad form state
  const [newSquadName, setNewSquadName] = useState("");
  const [newHabitTag, setNewHabitTag] = useState("");
  const [newPenaltyFine, setNewPenaltyFine] = useState(50);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [isSubmittingSquad, setIsSubmittingSquad] = useState(false);

  // Invite code state
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [isJoiningCode, setIsJoiningCode] = useState(false);

  const handleTabClick = (tab: NavTab) => {
    triggerHaptic([15]);
    if (tab === "camera") {
      openCamera();
    } else {
      setActiveTab(tab);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const touchStartRef = React.useRef<{ x: number; y: number; isInsideCarousel: boolean } | null>(null);

  const handleTopDmClick = () => {
    triggerHaptic([15]);
    openMessagesInbox();
  };

  // Native Instagram Swipe-to-DM Gesture (Swipe Right-to-Left on Feed)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement | null;
    const isInsideCarousel = !!target?.closest(".overflow-x-auto");

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      isInsideCarousel,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touchStartRef.current.x - touch.clientX;
    const diffY = touchStartRef.current.y - touch.clientY;
    const isInsideCarousel = touchStartRef.current.isInsideCarousel;
    touchStartRef.current = null;

    if (activeTab === "feed" && !isInsideCarousel) {
      if (diffX > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
        triggerHaptic([10]);
        handleTopDmClick();
      }
    }
  };

  // Handle creating a new squad
  const handleCreateSquadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadName.trim()) return;

    setIsSubmittingSquad(true);
    triggerHaptic([25]);

    const res = await tribelyService.createArena({
      name: newSquadName.trim(),
      description: `Daily ${newHabitTag || "habit"} accountability cohort.`,
      penalty_amount: Number(newPenaltyFine) || 50,
      is_private: newIsPrivate,
      proof_type: "IMAGE",
      deadline_time: "23:59",
    });

    setIsSubmittingSquad(false);

    if (res.success) {
      showToast(`Squad "${newSquadName}" created! ⚔️`, "success");
      setIsCreateJoinModalOpen(false);
      setCreateJoinTab("choose");
      setNewSquadName("");
      setNewHabitTag("");
      setActiveTab("explore");
    } else {
      showToast(res.error || "Failed to create squad", "fire");
    }
  };

  // Handle joining a squad with invite code
  const handleJoinByCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;

    setIsJoiningCode(true);
    triggerHaptic([25]);

    const res = await tribelyService.joinByInviteCode(inviteCodeInput.trim());
    setIsJoiningCode(false);

    if (res.success) {
      showToast(`Joined squad successfully! 🔥`, "success");
      setIsCreateJoinModalOpen(false);
      setCreateJoinTab("choose");
      setInviteCodeInput("");
      setActiveTab("explore");
    } else {
      showToast(res.message || "Invalid invite code", "fire");
    }
  };

  return (
    <div className="bg-neutral-100 dark:bg-black min-h-screen text-neutral-900 dark:text-neutral-100 flex justify-center antialiased selection:bg-emerald-500/30 selection:text-white">
      {/* Mobile-First Instagram App Frame */}
      <div className="w-full max-w-md min-h-screen border-x border-neutral-200 dark:border-neutral-900/80 bg-white dark:bg-neutral-950 flex flex-col justify-between relative pb-20 shadow-2xl shadow-neutral-300/30 dark:shadow-neutral-950">
        
        {/* ── TOP NAVIGATION BAR (Instagram-Identical Mobile Header) ── */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-white/95 dark:bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-900/60 transition-colors">
          {/* Left: Instagram Script Wordmark + Chevron Down */}
          <div
            className="flex items-center gap-1 cursor-pointer select-none"
            onClick={() => handleTabClick("feed")}
          >
            <span className="font-instagram text-[28px] font-normal tracking-wide text-neutral-900 dark:text-white leading-none pt-1">
              Tribely
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 mt-1" />
          </div>

          {/* Center: User Kudos Balance Pill */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleTabClick("vault")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-neutral-900/90 hover:bg-amber-500/20 dark:hover:bg-neutral-800 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black shadow-xs transition-all cursor-pointer"
            title="Your Kudos Balance"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>{user.kudosBalance.toLocaleString()}</span>
            <span className="text-[9px] text-amber-600 dark:text-amber-400/80 font-bold uppercase tracking-wider">Kudos</span>
          </motion.button>

          {/* Right Action Icons: [+] Create/Join, ♡ Notifications, ✈ DMs */}
          <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
            {/* 1. [+] Create or Join Arenas */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                triggerHaptic([15]);
                setCreateJoinTab("choose");
                setIsCreateJoinModalOpen(true);
              }}
              className="p-1 hover:text-black dark:hover:text-white transition cursor-pointer"
              aria-label="Create or Join Squad"
              title="Create or Join Squad"
            >
              <PlusSquare className="w-[23px] h-[23px] stroke-[1.75]" />
            </motion.button>

            {/* 2. ♡ Notifications Heart */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                triggerHaptic([15]);
                setIsNotificationsModalOpen(true);
              }}
              className="relative p-1 hover:text-black dark:hover:text-white transition cursor-pointer"
              aria-label="Notifications"
              title="Notifications"
            >
              <Heart className="w-[23px] h-[23px] stroke-[1.75]" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
            </motion.button>

            {/* 3. ✈ DM Paper Plane */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleTopDmClick}
              className="relative p-1 hover:text-black dark:hover:text-white transition cursor-pointer"
              aria-label="Direct Messages"
              title="Direct Messages"
            >
              <Send className="w-[23px] h-[23px] stroke-[1.75] -rotate-12 translate-x-0.5" />
              {unreadDmsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center border border-white dark:border-neutral-950">
                  {unreadDmsCount}
                </span>
              )}
            </motion.button>
          </div>
        </header>

        {/* ── TOAST ALERT OVERLAY ── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm pointer-events-none"
            >
              <div
                className={`p-3 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-bold ${
                  toast.type === "fire"
                    ? "bg-orange-950/80 border-orange-500/50 text-orange-200"
                    : toast.type === "nudge"
                    ? "bg-amber-950/80 border-amber-500/50 text-amber-200"
                    : toast.type === "success"
                    ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
                    : "bg-neutral-900/90 border-neutral-700 text-neutral-200"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  {toast.type === "fire" && <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />}
                  {toast.type === "nudge" && <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                  {toast.type === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {toast.type === "info" && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <span className="truncate">{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CREATE OR JOIN SQUAD BOTTOM SHEET MODAL ── */}
        <AnimatePresence>
          {isCreateJoinModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs p-0">
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 280 }}
                className="w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl p-5 text-neutral-900 dark:text-white space-y-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-900">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                      <SquarePlus className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black tracking-tight">
                      {createJoinTab === "choose" && "Create or Join Squads"}
                      {createJoinTab === "create" && "Create New Squad"}
                      {createJoinTab === "invite" && "Join with Invite Code"}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateJoinModalOpen(false);
                      setCreateJoinTab("choose");
                    }}
                    className="p-1 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub-View 1: Choose Action */}
                {createJoinTab === "choose" && (
                  <div className="space-y-3 pt-1">
                    {/* Option A: Create New Arena */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCreateJoinTab("create")}
                      className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/40 transition flex items-center justify-between text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg">
                          ✨
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-neutral-900 dark:text-white group-hover:text-emerald-500 transition">
                            Create a New Squad
                          </h4>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Set up daily stakes, custom fines, and invite your friends.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-500 transition" />
                    </motion.button>

                    {/* Option B: Join with Invite Code */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCreateJoinTab("invite")}
                      className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 transition flex items-center justify-between text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
                          🔑
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-neutral-900 dark:text-white group-hover:text-amber-500 transition">
                            Join with Invite Code
                          </h4>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Have a 6-character private invite code? Enter it here.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-amber-500 transition" />
                    </motion.button>

                    {/* Option C: Explore Public Squads */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setIsCreateJoinModalOpen(false);
                        handleTabClick("explore");
                      }}
                      className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-teal-500/40 transition flex items-center justify-between text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-500 flex items-center justify-center font-bold text-lg">
                          🧭
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-neutral-900 dark:text-white group-hover:text-teal-500 transition">
                            Discover Active Arenas
                          </h4>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Browse trending public cohorts and join with 1-tap.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-teal-500 transition" />
                    </motion.button>
                  </div>
                )}

                {/* Sub-View 2: Create Squad Form */}
                {createJoinTab === "create" && (
                  <form onSubmit={handleCreateSquadSubmit} className="space-y-3.5 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block mb-1">
                        Squad Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newSquadName}
                        onChange={(e) => setNewSquadName(e.target.value)}
                        placeholder="e.g. 5AM Morning Runners"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block mb-1">
                        Habit Category / Tag
                      </label>
                      <input
                        type="text"
                        value={newHabitTag}
                        onChange={(e) => setNewHabitTag(e.target.value)}
                        placeholder="e.g. #Running, #Coding, #Gym"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block mb-1">
                        Daily Miss Penalty Fine (Kudos)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={newPenaltyFine}
                        onChange={(e) => setNewPenaltyFine(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                      <div>
                        <div className="text-xs font-bold text-neutral-900 dark:text-white">Private Cohort</div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Requires admin approval to join.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={newIsPrivate}
                        onChange={(e) => setNewIsPrivate(e.target.checked)}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCreateJoinTab("choose")}
                        className="flex-1 py-2.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 text-xs font-bold transition cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingSquad || !newSquadName.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingSquad ? "Creating..." : "Create Squad ⚔️"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Sub-View 3: Invite Code Form */}
                {createJoinTab === "invite" && (
                  <form onSubmit={handleJoinByCodeSubmit} className="space-y-4 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block mb-1">
                        Enter 6-Character Invite Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. A9B4X2"
                        className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-mono tracking-widest text-center uppercase text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCreateJoinTab("choose")}
                        className="flex-1 py-2.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 text-xs font-bold transition cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isJoiningCode || !inviteCodeInput.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black transition disabled:opacity-50 cursor-pointer"
                      >
                        {isJoiningCode ? "Joining..." : "Join Squad 🔑"}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── NOTIFICATIONS BOTTOM SHEET MODAL ── */}
        <AnimatePresence>
          {isNotificationsModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs p-0">
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 280 }}
                className="w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl p-5 text-neutral-900 dark:text-white space-y-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-900">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-500">
                      <Heart className="w-4 h-4 fill-rose-500" />
                    </div>
                    <h3 className="text-sm font-black tracking-tight">Notifications</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsModalOpen(false)}
                    className="p-1 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="py-8 text-center flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-xl">
                    🔔
                  </div>
                  <h4 className="text-xs font-black text-neutral-900 dark:text-white">Activity will appear here</h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-xs leading-relaxed">
                    When squad members like your proof, downvote an unverified drop, or challenge your streak, you'll see alerts here.
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 mt-2">
                    You're all caught up! ✨
                  </span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── MAIN CONTENT VIEW (Attached Swipe Handler for Native Feed to DM) ── */}
        <main
          className="flex-1 w-full overflow-y-auto relative no-scrollbar"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </main>

        {/* ── BOTTOM NAVIGATION (Instagram Fixed Tab Bar) ── */}
        <nav className="fixed bottom-0 z-40 w-full max-w-md bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-900/80 flex items-center justify-around px-2 py-2 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          {/* Tab 1: Feed */}
          <button
            type="button"
            onClick={() => handleTabClick("feed")}
            className="flex flex-col items-center justify-center p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Feed"
          >
            <Home
              className={`w-6 h-6 transition-transform ${
                activeTab === "feed" ? "text-neutral-950 dark:text-white scale-110 stroke-[2.5]" : "stroke-[1.8]"
              }`}
            />
          </button>

          {/* Tab 2: Search Arenas (Instagram Search & Explore) */}
          <button
            type="button"
            onClick={() => handleTabClick("explore")}
            className="flex flex-col items-center justify-center p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Search Arenas"
            title="Search Arenas"
          >
            <Search
              className={`w-6 h-6 transition-transform ${
                activeTab === "explore" ? "text-neutral-950 dark:text-white scale-110 stroke-[2.5]" : "stroke-[1.8]"
              }`}
            />
          </button>

          {/* Tab 3: Proof Submission Camera (Elevated Glowing Circle) */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={() => handleTabClick("camera")}
            className="relative -top-2 w-13 h-13 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
            aria-label="Drop Proof"
            title="Drop Daily Proof"
          >
            <div className="w-full h-full rounded-full bg-neutral-900 dark:bg-neutral-950 flex items-center justify-center text-white">
              <Camera className="w-6 h-6 text-emerald-400 stroke-[2.2]" />
            </div>
          </motion.button>

          {/* Tab 4: Enrolled Arenas List (Your Squads) */}
          <button
            type="button"
            onClick={() => handleTabClick("squads")}
            className="flex flex-col items-center justify-center p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer relative"
            aria-label="Enrolled Arenas"
            title="My Enrolled Squads"
          >
            <Users
              className={`w-6 h-6 transition-transform ${
                activeTab === "squads" ? "text-neutral-950 dark:text-white scale-110 stroke-[2.5]" : "stroke-[1.8]"
              }`}
            />
            {arenas.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>

          {/* Tab 5: Profile & Heatmap */}
          <button
            type="button"
            onClick={() => handleTabClick("profile")}
            className="flex flex-col items-center justify-center p-1 cursor-pointer"
            aria-label="Profile"
          >
            <div
              className={`w-7 h-7 rounded-full p-0.5 transition-all ${
                activeTab === "profile"
                  ? "ring-2 ring-emerald-500 scale-105"
                  : "opacity-75 hover:opacity-100"
              }`}
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </button>
        </nav>
      </div>
    </div>
  );
};
