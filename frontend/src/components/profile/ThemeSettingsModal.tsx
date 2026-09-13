"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Laptop, Check, X } from "lucide-react";
import { useTheme, ThemeMode } from "@/app/context/ThemeContext";

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { themeMode, setThemeMode } = useTheme();

  const handleSelect = (mode: ThemeMode) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([15]);
      }
    } catch {}
    setThemeMode(mode);
  };

  const OPTIONS: {
    mode: ThemeMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      mode: "dark",
      label: "Dark",
      description: "Always use sleek dark surfaces",
      icon: <Moon className="w-5 h-5 text-neutral-300" />,
    },
    {
      mode: "light",
      label: "Light",
      description: "Crisp white & clean daylight view",
      icon: <Sun className="w-5 h-5 text-amber-500" />,
    },
    {
      mode: "system",
      label: "System Default",
      description: "Auto-adjust to match device preferences",
      icon: <Laptop className="w-5 h-5 text-cyan-400" />,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
          />

          {/* Instagram-style Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-[28px] px-5 pt-3 pb-8 text-neutral-900 dark:text-white shadow-2xl z-10"
          >
            {/* Grab Handle */}
            <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-800 mx-auto mb-3" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-900">
              <div>
                <h3 className="text-base font-black tracking-tight text-neutral-900 dark:text-neutral-100">
                  Switch Appearance
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Select how Tribely looks on this device
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="mt-3 space-y-2">
              {OPTIONS.map((opt) => {
                const isSelected = themeMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => handleSelect(opt.mode)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? "bg-neutral-100 dark:bg-neutral-900 border-[#FF5E00]/60 shadow-[0_0_12px_rgba(255,94,0,0.15)]"
                        : "bg-transparent border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl ${
                          isSelected
                            ? "bg-[#FF5E00]/15"
                            : "bg-neutral-100 dark:bg-neutral-900"
                        }`}
                      >
                        {opt.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {opt.description}
                        </div>
                      </div>
                    </div>

                    {/* Radio Check Circle */}
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? "bg-[#FF5E00] border-[#FF5E00] text-white shadow-sm"
                          : "border-neutral-300 dark:border-neutral-700 bg-transparent"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
