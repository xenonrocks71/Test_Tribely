"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Flame,
  Shield,
  Compass,
  Trophy,
  User,
  Camera,
  Plus,
  Moon,
  Sun,
  ChevronRight,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import { useApp, NavTab } from "@/context/AppContext";
import { useTheme } from "@/app/context/ThemeContext";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";

interface DesktopSidebarProps {
  onOpenCreateJoinModal?: () => void;
  onOpenCreateSquad?: () => void;
  onOpenNotifications?: () => void;
}

/**
 * Enterprise Desktop & Laptop Command Sidebar.
 * Displays persistent navigation, Kudos vault status, active habit squad shortcuts,
 * streak metrics, and the primary "Drop Daily Proof" action.
 */
export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  onOpenCreateJoinModal,
  onOpenCreateSquad,
  onOpenNotifications,
}) => {
  const handleOpenCreate = onOpenCreateSquad || onOpenCreateJoinModal;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme, isMounted } = useTheme();
  const {
    user,
    activeTab,
    setActiveTab,
    openCamera,
    arenas,
    triggerHaptic,
  } = useApp();

  const handleNavClick = (tab: NavTab, path?: string) => {
    triggerHaptic([15]);
    setActiveTab(tab);
    if (path && pathname !== path) {
      router.push(path);
    }
  };

  const navItems = [
    {
      tab: "feed" as NavTab,
      label: "Daily Activity",
      icon: Flame,
      badge: null,
      path: "/feed",
    },
    {
      tab: "squads" as NavTab,
      label: "My Tribes",
      icon: Shield,
      badge: arenas.length > 0 ? `${arenas.length}` : null,
      path: "/feed",
    },
    {
      tab: "explore" as NavTab,
      label: "Discover Tribes",
      icon: Compass,
      badge: null,
      path: "/feed",
    },
    {
      tab: "vault" as NavTab,
      label: "Rewards & Ledger",
      icon: Trophy,
      badge: null,
      path: "/feed",
    },
    {
      tab: "profile" as NavTab,
      label: "Consistency Profile",
      icon: User,
      badge: `${user.currentStreak}d`,
      path: "/feed",
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 xl:w-72 h-full border-r border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#1E1E1E] px-4 py-5 select-none shrink-0 z-40 transition-colors">
      {/* ── TOP SECTION: Brand & Navigation ── */}
      <div className="space-y-5 overflow-y-auto no-scrollbar pr-1">
        {/* Brand Logo & Theme Toggle */}
        <div className="flex items-center justify-between px-2">
          <Link
            href="/feed"
            onClick={() => handleNavClick("feed", "/feed")}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs shrink-0 flex items-center justify-center bg-white dark:bg-[#282A2D] border border-neutral-200/60 dark:border-neutral-700/60 p-0.5">
              <img src="/icons/BrandNewLook.png" alt="Tribely" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white leading-none block">
                Tribely
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                Habit Cohorts
              </span>
            </div>
          </Link>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            title={isMounted ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            {isMounted && theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Action Button: Check In / Drop Proof (Google Style Pill) */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic([20]);
            openCamera();
          }}
          className="w-full py-3 px-4 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold text-xs shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Camera className="w-4 h-4 stroke-[2]" />
          <span>Check In & Drop Proof</span>
        </button>

        {/* Main Navigation Links (Google Pill Selector) */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => handleNavClick(item.tab, item.path)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? "text-blue-600 dark:text-blue-400" : "text-neutral-400 group-hover:text-neutral-600"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Habits Quick List */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              Active Tribes
            </span>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
              title="Create or Join Tribe"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
            {arenas.length === 0 ? (
              <p className="text-[11px] text-neutral-400 px-2 py-1 italic">
                No active tribes yet.
              </p>
            ) : (
              arenas.slice(0, 5).map((squad) => (
                <Link
                  key={squad.id}
                  href={`/arenas/${squad.rawId || squad.id}`}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-neutral-50 dark:hover:bg-neutral-850 transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm shrink-0">{squad.emoji || "⚡"}</span>
                    <div className="truncate">
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 block truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {squad.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                    {squad.deadlineTime?.slice(0, 5) || "23:59"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION: User Profile Summary (Clean Google Style) ── */}
      <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
        <div
          onClick={() => handleNavClick("profile")}
          className="flex items-center justify-between p-2 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-850 transition cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AvatarWithFallback
              avatarUrl={user.avatar}
              name={user.name}
              sizeClass="w-8 h-8"
              textClass="text-xs font-bold"
            />
            <div className="truncate">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white block truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {user.name}
              </span>
              <span className="text-[11px] text-neutral-400 truncate block">
                @{user.username || "member"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/30">
            <Flame className="w-3 h-3 fill-emerald-500" />
            <span>{user.currentStreak}d</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
