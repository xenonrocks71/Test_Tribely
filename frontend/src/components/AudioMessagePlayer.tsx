"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic, Volume2 } from "lucide-react";

interface AudioMessagePlayerProps {
  src: string;
  isMe?: boolean;
}

export default function AudioMessagePlayer({ src, isMe }: AudioMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const setAudioData = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", setAudioData);
    audio.addEventListener("timeupdate", setAudioTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", setAudioData);
      audio.removeEventListener("timeupdate", setAudioTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.error("Audio playback error:", err));
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-[22px] max-w-[260px] shadow-xs border my-0.5 ${
        isMe
          ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-blue-400/30"
          : "bg-neutral-200 text-neutral-900 dark:bg-[#262626] dark:text-[#F5F5F5] border-neutral-300/30 dark:border-neutral-700/30"
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer ${
          isMe ? "bg-white/20 hover:bg-white/30 text-white" : "bg-neutral-300 dark:bg-neutral-700 text-neutral-900 dark:text-white"
        }`}
      >
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] font-semibold mb-1 opacity-90">
          <div className="flex items-center space-x-1">
            <Mic className="h-3 w-3" />
            <span>Voice Note</span>
          </div>
          <span className="font-mono">{formatTime(currentTime > 0 ? currentTime : duration)}</span>
        </div>

        {/* Animated Waveform Visualizer simulation */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/20 dark:bg-white/20">
          <div
            className={`h-full transition-all duration-100 ${isMe ? "bg-white" : "bg-purple-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
