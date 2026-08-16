"use client";

import React, { useState } from "react";
import { useCallContext } from "../context/CallContext";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users, ChevronDown, Volume2, Sparkles } from "lucide-react";

export function ArenaCallNotch() {
  const {
    activeCall,
    isUserInCall,
    callDuration,
    isMuted,
    isCamOn,
    isScreenSharing,
    joinArenaCall,
    leaveArenaCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useCallContext();

  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeCall || activeCall.status === "ENDED") {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const participantCount = activeCall.participants?.length || 1;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out select-none">
      {/* ── UNJOINED STATE: Compact Apple Dynamic Island Pill ── */}
      {!isUserInCall && (
        <div
          onClick={() => joinArenaCall(activeCall.arena_id, activeCall.call_id, activeCall.call_type)}
          className="flex items-center gap-3.5 px-4 py-2 rounded-full bg-slate-900/90 border border-emerald-500/40 shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.25)] backdrop-blur-2xl cursor-pointer transition-all duration-300 hover:scale-105 active:scale-98 group"
        >
          {/* Glowing Green Pulse Dot */}
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>

          {/* Animated Audio Spectrum Waveform Bars */}
          <div className="flex items-center gap-0.5 h-4">
            <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_100ms] h-2" />
            <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_200ms] h-4" />
            <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_300ms] h-3" />
            <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_150ms] h-2" />
          </div>

          {/* Call Metadata & Participant Count */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white tracking-wide">
              {activeCall.call_type === "video" ? "📹 Live HD Video" : "📞 Voice Huddle"}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{participantCount} in Call</span>
            </span>
          </div>

          {/* Actionable Join Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              joinArenaCall(activeCall.arena_id, activeCall.call_id, activeCall.call_type);
            }}
            className="px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-md transition active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <span>Join</span>
            <Sparkles className="w-3 h-3 fill-black" />
          </button>
        </div>
      )}

      {/* ── JOINED STATE: Dynamic Status Pill with Dropdown Panel ── */}
      {isUserInCall && (
        <div className="flex flex-col items-center">
          {/* Main Dynamic Notch Bar */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-4 px-5 py-2.5 rounded-full bg-slate-950/95 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_25px_rgba(255,255,255,0.08)] backdrop-blur-2xl cursor-pointer transition-all duration-300 hover:border-white/30"
          >
            {/* Live Audio Speaking Indicator Waveform */}
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold text-white/90">{formatTime(callDuration)}</span>
            </div>

            <div className="h-4 w-px bg-white/15" />

            {/* In-Call Quick Controls */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {/* Mic Button */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-1.5 rounded-full transition active:scale-95 cursor-pointer ${
                  isMuted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              {/* Camera Button */}
              <button
                type="button"
                onClick={toggleCamera}
                className={`p-1.5 rounded-full transition active:scale-95 cursor-pointer ${
                  !isCamOn ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={isCamOn ? "Turn Off Camera" : "Turn On Camera"}
              >
                {!isCamOn ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5 text-blue-400" />}
              </button>

              {/* Screen Share Button */}
              <button
                type="button"
                onClick={toggleScreenShare}
                className={`p-1.5 rounded-full transition active:scale-95 cursor-pointer ${
                  isScreenSharing ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title="Share Screen"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>

              {/* Leave Call Button */}
              <button
                type="button"
                onClick={leaveArenaCall}
                className="px-2.5 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md transition active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Leave Call"
              >
                <PhoneOff className="w-3 h-3" />
                <span>Leave</span>
              </button>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
          </div>

          {/* Expanded Dropdown Panel */}
          {isExpanded && (
            <div className="mt-2 w-72 p-4 rounded-2xl bg-slate-950/95 border border-white/15 shadow-2xl backdrop-blur-2xl animate-slide-down text-white space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-white/10 pb-2">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Call Participants</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {participantCount} Connected
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-white">{activeCall.host_name} (Host)</span>
                  </div>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
