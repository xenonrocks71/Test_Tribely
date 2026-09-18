"use client";

import React from "react";
import { motion } from "framer-motion";

export const CaughtUpDivider: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full py-6 px-4 flex flex-col items-center text-center space-y-2.5 select-none"
    >
      {/* Checkmark icon */}
      <div className="w-10 h-10 rounded-full bg-[#E6F4EA] dark:bg-[#137333]/20 border border-[#CEEAD6] dark:border-[#137333]/30 flex items-center justify-center text-[#137333] dark:text-[#81C995]">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2.5"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      {/* Text */}
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">
          You&apos;re all caught up
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[260px] leading-relaxed">
          You&apos;ve seen all recent proof drops from your squads.
        </p>
      </div>

      {/* Divider */}
      <div className="w-full max-w-xs flex items-center gap-3 pt-2">
        <div className="flex-1 h-px bg-neutral-200 dark:bg-[#303134]" />
        <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
          Suggested Tribes
        </span>
        <div className="flex-1 h-px bg-neutral-200 dark:bg-[#303134]" />
      </div>
    </motion.div>
  );
};
