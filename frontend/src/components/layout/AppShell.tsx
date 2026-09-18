"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  PlusSquare,
  Bell,
  MessageSquare,
  Zap,
  CheckCircle2,
  Sparkles,
  Camera,
  Shield,
  Search,
  Users,
} from "lucide-react";
import { useApp, NavTab } from "@/context/AppContext";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { AccountabilityRadar } from "@/components/feed/AccountabilityRadar";
import { CreateJoinModal } from "@/components/arenas/CreateJoinModal";
import { NotificationsModal } from "@/components/layout/NotificationsModal";
import { offlineProofQueue } from "@/utils/offlineProofQueue";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

/**
 * AppShell
 * 
 * Adaptive layout orchestrator for Tribely:
 * - Desktop/Laptop (lg: 1024px+): Persistent left command sidebar, centered feed/workspace, right accountability radar.
 * - Tablet (md: 768px - 1023px): Expanded 2-column card layouts with ergonomic touch controls.
 * - Mobile (< 768px): Full-bleed viewport, top status bar, floating glowing proof drop CTA, and docked bottom nav.
 */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    activeTab,
    setActiveTab,
    openCamera,
    openMessagesInbox,
    unreadDmsCount,
    toast,
    triggerHaptic,
    showToast,
    refreshArenas,
    refreshFeed,
  } = useApp();

  const [isCreateJoinModalOpen, setIsCreateJoinModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  // Auto-sync any queued offline proofs on app mount or reconnect
  useEffect(() => {
    offlineProofQueue.syncPendingProofs();

    const handleSynced = (e: any) => {
      const count = e.detail?.count || 1;
      showToast(`Synced ${count} offline proof${count > 1 ? "s" : ""} to your squads! 🔥`, "success");
      refreshArenas();
      refreshFeed();
    };

    window.addEventListener("tribely:proofs_synced", handleSynced);
    return () => {
      window.removeEventListener("tribely:proofs_synced", handleSynced);
    };
  }, [refreshArenas, refreshFeed, showToast]);

  const touchStartRef = useRef<{ x: number; y: number; isInsideCarousel: boolean } | null>(null);

  const handleTopDmClick = () => {
    triggerHaptic([15]);
    openMessagesInbox();
  };

  // Mobile swipe right-to-left to open squad messages
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
      if (diffX > 75 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
        triggerHaptic([10]);
        handleTopDmClick();
      }
    }
  };

  return (
    <div className="h-screen h-[100dvh] w-full overflow-hidden bg-[#F8F9FA] dark:bg-[#121212] text-neutral-900 dark:text-neutral-100 flex antialiased selection:bg-blue-500/20 selection:text-blue-600">
      {/* ── DESKTOP PERSISTENT COMMAND SIDEBAR (lg: and above) ── */}
      <DesktopSidebar
        onOpenCreateSquad={() => setIsCreateJoinModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsModalOpen(true)}
      />

      {/* ── MAIN APPLICATION VIEWPORT ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ── TOP APP HEADER (Visible on all screens, optimized per breakpoint) ── */}
        {/* ── TOP APP HEADER (Clean Google Workspace Style) ── */}
        <header className="shrink-0 z-30 flex items-center justify-between px-4 sm:px-6 py-2.5 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800 transition-colors">
          {/* Mobile Left: Tribely Brand */}
          <div className="flex items-center gap-2 lg:hidden">
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => {
                setActiveTab("feed");
                if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs shrink-0 flex items-center justify-center bg-white dark:bg-[#282A2D] border border-neutral-200/60 dark:border-neutral-700/60 p-0.5">
                <img src="/icons/BrandNewLook.png" alt="Tribely" className="w-full h-full object-contain" />
              </div>
              <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
                Tribely
              </span>
            </div>
          </div>

          {/* Desktop Left: Clean Page Title */}
          <div className="hidden lg:flex items-center gap-2">
            <h1 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {activeTab === "feed" && "Daily Activity"}
              {activeTab === "explore" && "Discover Tribes"}
              {activeTab === "squads" && "My Tribes"}
              {activeTab === "vault" && "Rewards & Ledger"}
              {activeTab === "profile" && "Account & Consistency"}
            </h1>
          </div>

          {/* Right Action Icons (Google Style) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Create or Join Tribe */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic([15]);
                setIsCreateJoinModalOpen(true);
              }}
              className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
              aria-label="Create or Join Tribe"
              title="Create or Join Tribe"
            >
              <PlusSquare className="w-5 h-5 stroke-[1.8]" />
            </button>

            {/* Notifications */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic([15]);
                setIsNotificationsModalOpen(true);
              }}
              className="relative p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-5 h-5 stroke-[1.8]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-[#1E1E1E]" />
            </button>

            {/* Tribe Messages */}
            <button
              type="button"
              onClick={handleTopDmClick}
              className="relative p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
              aria-label="Messages"
              title="Messages"
            >
              <MessageSquare className="w-5 h-5 stroke-[1.8]" />
              {unreadDmsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-white dark:ring-[#1E1E1E]">
                  {unreadDmsCount}
                </span>
              )}
            </button>

            {/* User Profile Avatar Thumbnail (Hidden on mobile; mobile uses bottom navigation bar) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveTab("profile");
              }}
              className="hidden lg:block p-0.5 rounded-full hover:ring-2 hover:ring-blue-500/40 transition cursor-pointer ml-1"
              title="Account"
              aria-label="Account & Profile"
            >
              <AvatarWithFallback
                avatarUrl={user.avatar}
                name={user.name}
                sizeClass="w-7 h-7"
                textClass="text-[10px] font-bold"
              />
            </button>
          </div>
        </header>

        {/* ── TOAST NOTIFICATIONS POPUP ── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-16 right-4 sm:right-6 z-50 w-[90%] max-w-sm pointer-events-none"
            >
              <div
                className={`p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 text-xs font-bold ${
                  toast.type === "fire"
                    ? "bg-orange-950/90 border-orange-500/50 text-orange-100"
                    : toast.type === "nudge"
                    ? "bg-amber-950/90 border-amber-500/50 text-amber-100"
                    : toast.type === "success"
                    ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-100"
                    : "bg-neutral-900/95 border-neutral-700 text-neutral-200"
                }`}
              >
                <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  {toast.type === "fire" && <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />}
                  {toast.type === "nudge" && <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />}
                  {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {toast.type === "info" && <Sparkles className="w-4 h-4 text-cyan-400" />}
                </div>
                <span className="truncate">{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RESPONSIVE CONTENT VIEWPORT ── */}
        <div className="flex-1 flex justify-center w-full overflow-hidden">
          <div className="flex w-full max-w-7xl justify-center gap-8 h-full px-0 sm:px-4 lg:px-6 overflow-hidden">
            {/* Primary Center Workspace Column - ONLY THIS COLUMN SCROLLS */}
            <main
              className="flex-1 min-w-0 max-w-2xl lg:max-w-3xl w-full h-full overflow-y-auto no-scrollbar py-2 sm:py-5 pb-24 lg:pb-8"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {children}
            </main>

            {/* Right Accountability Radar Sidebar (Desktop xl: only, when on Feed tab) - STABLE, NEVER MOVES WITH FEED SCROLL */}
            {activeTab === "feed" && (
              <aside className="hidden xl:block w-80 shrink-0 h-full overflow-y-auto no-scrollbar py-2 sm:py-5">
                <AccountabilityRadar onOpenCreateSquad={() => setIsCreateJoinModalOpen(true)} />
              </aside>
            )}
          </div>
        </div>

        {/* ── MOBILE BOTTOM NAVIGATION DOCK (Hidden on lg: and above) ── */}
        <MobileBottomNav onOpenCreateSquad={() => setIsCreateJoinModalOpen(true)} />
      </div>

      {/* ── MODALS ── */}
      <CreateJoinModal
        isOpen={isCreateJoinModalOpen}
        onClose={() => setIsCreateJoinModalOpen(false)}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />
    </div>
  );
};
