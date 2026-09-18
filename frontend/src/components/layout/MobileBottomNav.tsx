"use client";

import React from "react";
import { motion } from "framer-motion";
import { Flame, Compass, Camera, Users, Shield } from "lucide-react";
import { useApp, NavTab } from "@/context/AppContext";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

interface MobileBottomNavProps {
  onOpenCreateSquad?: () => void;
}

/**
 * Mobile Ergonomic Bottom Navigation Bar.
 * Visible strictly on mobile viewports (< 768px).
 * Features safe-area inset support, elevated center camera CTA, and haptic feedback.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenCreateSquad }) => {
  const {
    user,
    activeTab,
    setActiveTab,
    openCamera,
    arenas,
    triggerHaptic,
    showToast,
    refreshFeed,
    refreshArenas,
  } = useApp();

  const handleTabClick = async (tab: NavTab) => {
    triggerHaptic([15]);
    if (tab === "camera") {
      openCamera();
    } else if (tab === "feed" && activeTab === "feed") {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      triggerHaptic([20, 30]);
      showToast("🔄 Refreshing feed...", "info");
      await Promise.all([refreshFeed(), refreshArenas()]);
    } else {
      setActiveTab(tab);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md border-t border-neutral-200/80 dark:border-neutral-800 px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none transition-colors"
      aria-label="Mobile Navigation"
    >
      {/* Tab 1: Feed */}
      <button
        type="button"
        onClick={() => handleTabClick("feed")}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition cursor-pointer"
        aria-label="Habit Feed"
      >
        <div className={`p-1 rounded-full transition ${activeTab === "feed" ? "bg-blue-50 dark:bg-blue-950/60" : ""}`}>
          <Flame
            className={`w-5 h-5 transition-colors ${
              activeTab === "feed"
                ? "text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400 stroke-[2]"
                : "text-neutral-500 dark:text-neutral-400 stroke-[1.8]"
            }`}
          />
        </div>
        <span
          className={`text-[11px] font-medium mt-0.5 ${
            activeTab === "feed" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-neutral-500 dark:text-neutral-400"
          }`}
        >
          Activity
        </span>
      </button>

      {/* Tab 2: Discover Tribes */}
      <button
        type="button"
        onClick={() => handleTabClick("explore")}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition cursor-pointer"
        aria-label="Discover Tribes"
      >
        <div className={`p-1 rounded-full transition ${activeTab === "explore" ? "bg-blue-50 dark:bg-blue-950/60" : ""}`}>
          <Compass
            className={`w-5 h-5 transition-colors ${
              activeTab === "explore"
                ? "text-blue-600 dark:text-blue-400 stroke-[2.2]"
                : "text-neutral-500 dark:text-neutral-400 stroke-[1.8]"
            }`}
          />
        </div>
        <span
          className={`text-[11px] font-medium mt-0.5 ${
            activeTab === "explore" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-neutral-500 dark:text-neutral-400"
          }`}
        >
          Discover
        </span>
      </button>

      {/* Tab 3: Center Elevated Check-In Button (Google FAB Style) */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        type="button"
        onClick={() => handleTabClick("camera")}
        className="relative -top-2 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-md flex items-center justify-center cursor-pointer transition-transform"
        aria-label="Drop Daily Proof"
        title="Check In & Drop Proof"
      >
        <Camera className="w-5 h-5 text-white stroke-[2]" />
      </motion.button>

      {/* Tab 4: My Tribes */}
      <button
        type="button"
        onClick={() => handleTabClick("squads")}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition cursor-pointer relative"
        aria-label="My Tribes"
      >
        <div className={`p-1 rounded-full transition ${activeTab === "squads" ? "bg-blue-50 dark:bg-blue-950/60" : ""}`}>
          <Shield
            className={`w-5 h-5 transition-colors ${
              activeTab === "squads"
                ? "text-blue-600 dark:text-blue-400 stroke-[2.2]"
                : "text-neutral-500 dark:text-neutral-400 stroke-[1.8]"
            }`}
          />
        </div>
        <span
          className={`text-[11px] font-medium mt-0.5 ${
            activeTab === "squads" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-neutral-500 dark:text-neutral-400"
          }`}
        >
          Tribes
        </span>
      </button>

      {/* Tab 5: Profile */}
      <button
        type="button"
        onClick={() => handleTabClick("profile")}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition cursor-pointer"
        aria-label="Profile"
      >
        <div
          className={`w-6 h-6 rounded-full p-0.5 transition-all mt-0.5 ${
            activeTab === "profile"
              ? "ring-2 ring-blue-600 dark:ring-blue-400 scale-105"
              : "opacity-80 hover:opacity-100"
          }`}
        >
          <AvatarWithFallback
            avatarUrl={user.avatar}
            name={user.name}
            sizeClass="w-full h-full"
            textClass="text-[9px] font-bold"
          />
        </div>
        <span
          className={`text-[11px] font-medium mt-1 ${
            activeTab === "profile" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-neutral-500 dark:text-neutral-400"
          }`}
        >
          Profile
        </span>
      </button>
    </nav>
  );
};
