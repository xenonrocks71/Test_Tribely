"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Camera, Compass, Flame } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md mx-auto my-12 px-6 py-10 rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl shadow-xl text-center flex flex-col items-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-rose-500/20 dark:from-amber-500/30 dark:via-orange-500/30 dark:to-rose-500/30 border border-orange-500/30 flex items-center justify-center text-3xl shadow-inner mb-4">
        {icon || <Flame className="w-8 h-8 text-orange-500" />}
      </div>

      <h3 className="text-base font-black text-neutral-900 dark:text-white tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xs leading-relaxed mb-6">
        {description}
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-extrabold text-xs shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>{actionLabel}</span>
          </button>
        )}

        {secondaryLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold text-xs active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{secondaryLabel}</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};
