"use client";

import React, { useRef, useState } from "react";
import { Flame, Share2, X, Download, Sparkles, Check, Trophy } from "lucide-react";

interface InstagramStoryCardProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userAvatar?: string | null;
  currentStreak: number;
  longestStreak: number;
  arenaName?: string;
  tierBadge?: string;
}

export const InstagramStoryCard: React.FC<InstagramStoryCardProps> = ({
  isOpen,
  onClose,
  userName,
  userAvatar,
  currentStreak = 1,
  longestStreak = 1,
  arenaName = "Daily Discipline Protocol",
  tierBadge = "Consistent Achiever 🥈",
}) => {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    if (typeof window !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${userName}'s Habit Streak on Tribely`,
          text: `🔥 ${currentStreak}-Day Unbroken Streak on Tribely (${arenaName})! Accountability pays off.`,
          url: window.location.origin,
        });
      } catch (err) {
        console.warn("Share cancelled or failed:", err);
      }
    } else {
      // Fallback: copy link
      if (typeof window !== "undefined") {
        navigator.clipboard.writeText(`${window.location.origin}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm flex flex-col items-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 9:16 Aspect Ratio Story Card */}
        <div
          ref={cardRef}
          className="w-full aspect-[9/16] rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl border border-white/15"
          style={{
            background: "radial-gradient(circle at 50% 20%, #2A1005 0%, #0D0D11 65%, #050508 100%)",
            boxShadow: "0 25px 60px -15px rgba(255, 94, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.2)",
          }}
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#FF5E00]/15 blur-3xl pointer-events-none" />

          {/* Top Bar: Tribely Branding */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF5E00] to-amber-500 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-[#FF5E00]/40">
                T
              </div>
              <span className="text-sm font-black tracking-widest text-white uppercase">Tribely</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-zinc-300 backdrop-blur">
              Verified Proof
            </span>
          </div>

          {/* Center Content: Giant Streak & Badges */}
          <div className="text-center space-y-4 my-auto relative z-10">
            {/* User Avatar with Ring */}
            <div className="inline-block relative">
              <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-[#FF5E00] via-[#10B981] to-amber-400 shadow-[0_0_25px_rgba(255,94,0,0.4)] mx-auto">
                <div className="w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center">
                  {userAvatar ? (
                    <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-white">{userName.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-base font-black text-white">{userName}</h4>
              <p className="text-xs font-semibold text-[#FF7A00] mt-0.5">{arenaName}</p>
            </div>

            {/* Giant Streak Callout */}
            <div className="py-4 px-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md shadow-inner inline-block">
              <div className="flex items-center justify-center gap-2">
                <Flame className="w-8 h-8 text-[#FF5E00] fill-[#FF5E00] animate-bounce" />
                <span className="text-4xl font-black tracking-tight text-white">{currentStreak}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                Day Unbroken Streak
              </p>
            </div>

            {/* Mini Strava Heatmap Representation */}
            <div className="flex items-center justify-center gap-1 max-w-[200px] mx-auto py-1">
              {[...Array(14)].map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-sm ${
                    i < Math.min(14, currentStreak)
                      ? "bg-[#10B981] shadow-[0_0_4px_#10B981]"
                      : "bg-zinc-800"
                  }`}
                />
              ))}
            </div>

            {/* Tier Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black">
              <Trophy className="w-3.5 h-3.5" />
              <span>{tierBadge}</span>
            </div>
          </div>

          {/* Bottom Card Footer */}
          <div className="text-center pt-3 border-t border-white/10 relative z-10">
            <p className="text-[10px] font-bold text-zinc-400">Join my tribe on Tribely</p>
            <p className="text-[9px] font-black text-zinc-500 tracking-wider uppercase mt-0.5">tribely.app</p>
          </div>
        </div>

        {/* Share Action Buttons */}
        <div className="flex items-center gap-3 w-full mt-4">
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex-1 py-3 px-4 rounded-2xl font-black text-xs text-white flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #FF7A00 0%, #FF3D00 100%)",
              boxShadow: "0 8px 25px rgba(255, 94, 0, 0.4)",
            }}
          >
            <Share2 className="w-4 h-4" />
            <span>{copied ? "Link Copied!" : "Share to Story"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-3 px-5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-300 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstagramStoryCard;
