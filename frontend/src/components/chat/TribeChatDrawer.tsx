"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Mic,
  Square,
  Play,
  Pause,
  Flame,
  Zap,
  Heart,
  Sparkles,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Search,
  Camera,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { useApp, TribeMessage, HabitArena } from "@/context/AppContext";
import { tribelyService } from "@/services/tribely.service";
import { AvatarWithFallback } from "@/components/ui/AvatarWithFallback";
import { parseSafeUtcDate } from "@/lib/utils";

export const TribeChatDrawer: React.FC = () => {
  const {
    isDmDrawerOpen,
    closeDm,
    openDm,
    openMessagesInbox,
    activeDmArena,
    arenas,
    user,
    tribeMessages,
    sendTribeMessage,
    sendQuickNudge,
    reactToMessage,
    openProofReply,
    openCamera,
    feedPosts,
    triggerHaptic,
    showToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [remoteMessages, setRemoteMessages] = useState<TribeMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active arena object if one is selected
  const currentArena = useMemo(() => {
    if (!activeDmArena) return null;
    return (
      arenas.find(
        (a) =>
          a.id === activeDmArena.id ||
          (activeDmArena.rawId && a.rawId === activeDmArena.rawId)
      ) || {
        id: activeDmArena.id,
        name: activeDmArena.name,
        tag: activeDmArena.tag,
        emoji: "⚔️",
        description: "Active squad room",
        memberCount: 12,
        penaltyAmount: 50,
        deadlineTime: "23:59",
        countdownMinutesLeft: 120,
        vaultPoolKudos: 500,
        multiplierActive: true,
        multiplierValue: 1.5,
        bannerImage: "",
        rawId: activeDmArena.rawId || 1,
      }
    );
  }, [activeDmArena, arenas]);

  // Load real messages when an arena is selected
  useEffect(() => {
    if (!isDmDrawerOpen || !activeDmArena?.rawId) {
      setRemoteMessages([]);
      return;
    }
    tribelyService
      .fetchArenaHistory(activeDmArena.rawId)
      .then((history) => {
        if (!history?.messages) return;
        const mapped: TribeMessage[] = history.messages.map((msg) => ({
          id: String(msg.id),
          arenaId: String(activeDmArena.rawId),
          senderId: String(msg.user_id),
          senderName: msg.sender_name || `Member #${msg.user_id}`,
          senderAvatar:
            msg.sender_avatar_url ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user_id}`,
          isSelf: String(msg.user_id) === user.id,
          type: (msg.message_type as "text" | "audio" | "system_event") || "text",
          text: msg.content,
          timestamp: parseSafeUtcDate(msg.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          reactions: {},
          currentUserReactions: [],
        }));
        setRemoteMessages(mapped);
      })
      .catch(() => {});
  }, [isDmDrawerOpen, activeDmArena?.rawId, user.id]);

  // Merge remote messages with locally-sent messages
  const allMessages = useMemo(() => {
    if (!activeDmArena) return [];
    const local = tribeMessages.filter(
      (m) =>
        m.arenaId === activeDmArena.id ||
        (activeDmArena.rawId && m.arenaId === String(activeDmArena.rawId))
    );
    return [...remoteMessages, ...local].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );
  }, [activeDmArena, remoteMessages, tribeMessages]);

  useEffect(() => {
    if (isDmDrawerOpen && activeDmArena) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, isDmDrawerOpen, activeDmArena]);

  // Filter arenas for inbox search
  const filteredArenas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return arenas;
    return arenas.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [arenas, searchQuery]);

  // Get the latest message or status for an arena preview
  const getArenaPreview = (arena: HabitArena) => {
    const matchingLocal = tribeMessages
      .filter((m) => m.arenaId === arena.id || m.arenaId === String(arena.rawId))
      .slice(-1)[0];
    if (matchingLocal) {
      const prefix = matchingLocal.isSelf ? "You" : matchingLocal.senderName.split(" ")[0];
      return `${prefix}: ${matchingLocal.text} · ${matchingLocal.timestamp}`;
    }
    return `${arena.memberCount} members · ${arena.tag} · Active now`;
  };

  // Voice Note Simulation
  const startRecordingVoice = () => {
    triggerHaptic([30, 40]);
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        if (prev >= 14) {
          stopRecordingVoice(true);
          return 15;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecordingVoice = (autoSend: boolean = true) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);

    if (autoSend) {
      triggerHaptic([40, 60]);
      const durationStr = `0:${recordingSeconds < 10 ? "0" : ""}${Math.max(
        1,
        recordingSeconds
      )}`;
      sendTribeMessage("Walkie-Talkie Snippet 🎙️", "audio", durationStr);
      showToast(`🎙️ Walkie-talkie dropped (${durationStr})!`, "fire");
    }
    setRecordingSeconds(0);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    sendTribeMessage(inputVal.trim(), "text");
    setInputVal("");
  };

  const togglePlayAudio = (msgId: string) => {
    triggerHaptic([15]);
    if (playingAudioId === msgId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(msgId);
      setTimeout(() => {
        setPlayingAudioId((curr) => (curr === msgId ? null : curr));
      }, 4000);
    }
  };

  const handleSystemEventClick = (msg: TribeMessage) => {
    triggerHaptic([15]);
    if (msg.systemEvent?.proofId) {
      const post = feedPosts.find((p) => p.id === msg.systemEvent?.proofId);
      if (post) {
        closeDm();
        openProofReply(post);
        return;
      }
    }
    showToast(`Viewing ${msg.systemEvent?.memberName}'s habit milestone`, "info");
  };

  if (!isDmDrawerOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          drag="x"
          dragConstraints={{ left: 0, right: 400 }}
          dragElastic={{ left: 0, right: 0.2 }}
          onDragEnd={(e, info) => {
            if (info.offset.x > 75 || info.velocity.x > 300) {
              triggerHaptic([15]);
              closeDm();
            }
          }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-full max-w-md h-full bg-white dark:bg-[#1E1E1E] border-l border-[#E8EAED] dark:border-[#303134] text-neutral-900 dark:text-white flex flex-col justify-between shadow-2xl touch-pan-y"
        >
          {/* ═══════════════════════════════════════════════════════════════
              VIEW A: MESSAGES INBOX (ARENAS LIST)
             ═══════════════════════════════════════════════════════════════ */}
          {!activeDmArena ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#1E1E1E]">
              {/* Inbox Header (Google Workspace Style) */}
              <div className="px-4 py-3 border-b border-[#E8EAED] dark:border-[#303134] flex items-center justify-between bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center font-semibold text-xs border border-[#D2E3FC] dark:border-[#1A73E8]/30">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900 dark:text-white tracking-tight leading-tight">
                      Messages
                    </h2>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
                      {user.username ? `@${user.username}` : "Tribe Squads"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={closeDm}
                    className="p-2 rounded-full text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search Bar (Google Pill Style) */}
              <div className="px-4 py-2.5 bg-white dark:bg-[#1E1E1E]">
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#F1F3F4] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] focus-within:border-[#1A73E8] dark:focus-within:border-[#8AB4F8] focus-within:ring-2 focus-within:ring-[#1A73E8]/15 transition">
                  <Search className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search squads and messages..."
                    className="flex-1 bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Title Row */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Tribe conversations
                </span>
                <span className="text-[11px] font-medium text-[#1A73E8] dark:text-[#8AB4F8] bg-[#E8F0FE] dark:bg-[#1A73E8]/15 px-2.5 py-0.5 rounded-full border border-[#D2E3FC] dark:border-[#1A73E8]/25">
                  {arenas.length} active
                </span>
              </div>

              {/* Arenas List (Google Material 3 List Style) */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#E8EAED] dark:divide-[#303134] no-scrollbar">
                {filteredArenas.length === 0 ? (
                  <div className="py-16 text-center text-neutral-500 dark:text-neutral-400 text-xs flex flex-col items-center gap-2">
                    <Search className="w-6 h-6 text-neutral-400 stroke-[1.5]" />
                    <span>No squads found matching "{searchQuery}"</span>
                  </div>
                ) : (
                  filteredArenas.map((arena) => {
                    const previewText = getArenaPreview(arena);
                    return (
                      <div
                        key={arena.id}
                        onClick={() => {
                          triggerHaptic([15]);
                          openDm(arena.id, arena.name, arena.tag, arena.rawId);
                        }}
                        className="flex items-center justify-between px-4 py-3 hover:bg-[#F8F9FA] dark:hover:bg-[#202124] active:bg-[#F1F3F4] dark:active:bg-[#282A2D] transition cursor-pointer group"
                      >
                        {/* Left: Google Account Style Circular Avatar */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-full p-[1.5px] border border-[#DADCE0] dark:border-[#3C4043] bg-[#F1F3F4] dark:bg-[#202124]">
                              <div className="w-full h-full rounded-full bg-white dark:bg-[#282A2D] flex items-center justify-center text-lg overflow-hidden">
                                {arena.bannerImage ? (
                                  <img
                                    src={arena.bannerImage}
                                    alt={arena.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{arena.emoji || "⚔️"}</span>
                                )}
                              </div>
                            </div>
                            {/* Online green indicator badge */}
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#0F9D58] ring-2 ring-white dark:ring-[#1E1E1E]" />
                          </div>

                          {/* Middle: Arena Name + Latest Message Snippet */}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-neutral-900 dark:text-white truncate leading-tight group-hover:text-[#1A73E8] dark:group-hover:text-[#8AB4F8] transition">
                              {arena.name}
                            </h4>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5 leading-normal font-normal">
                              {previewText}
                            </p>
                          </div>
                        </div>

                        {/* Right: Unread Dot + Quick Camera Action Button */}
                        <div className="flex items-center gap-2.5 shrink-0 ml-2">
                          <span className="w-2 h-2 rounded-full bg-[#1A73E8] dark:bg-[#8AB4F8]" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic([20]);
                              openCamera();
                            }}
                            className="p-2 rounded-full text-neutral-400 hover:text-[#1A73E8] dark:hover:text-[#8AB4F8] hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer"
                            title="Drop quick proof"
                          >
                            <Camera className="w-4 h-4 stroke-[1.8]" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
                VIEW B: DEDICATED ARENA CHAT ROOM (SEND TO ALL MEMBERS)
               ═══════════════════════════════════════════════════════════════ */
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8F9FA] dark:bg-[#121212]">
              {/* Chat Header (Google Chat Style) */}
              <div className="px-3.5 py-3 border-b border-[#E8EAED] dark:border-[#303134] flex items-center justify-between bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Back to Arenas List */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([15]);
                      openMessagesInbox();
                    }}
                    className="p-1.5 rounded-full text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer shrink-0"
                    aria-label="Back to messages"
                    title="Back to squads list"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Arena Avatar & Details */}
                  <div className="w-9 h-9 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center text-base shrink-0 overflow-hidden">
                    {currentArena?.bannerImage ? (
                      <img
                        src={currentArena.bannerImage}
                        alt={currentArena.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{currentArena?.emoji || "⚔️"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-neutral-900 dark:text-white leading-tight truncate">
                      {currentArena?.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0F9D58]" />
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">
                        {currentArena?.memberCount || 12} members · Active
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDm}
                  className="p-1.5 rounded-full text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Room Messages Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 no-scrollbar bg-[#F8F9FA] dark:bg-[#121212]">
                {allMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center text-[#1A73E8] dark:text-[#8AB4F8] mb-1">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Welcome to {currentArena?.name}
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-xs leading-relaxed">
                      Connect with your tribe members, cheer on streak milestones, and coordinate daily habit goals.
                    </p>
                  </div>
                )}

                {allMessages.map((msg) => {
                  if (msg.type === "system_event") {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleSystemEventClick(msg)}
                        className="p-3 rounded-xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] hover:border-[#1A73E8]/40 dark:hover:border-[#8AB4F8]/40 flex items-center justify-between cursor-pointer transition group shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] dark:text-[#81C995] shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-[11px] leading-snug text-neutral-700 dark:text-neutral-300 truncate">
                            <strong className="text-neutral-900 dark:text-white font-semibold">
                              {msg.systemEvent?.memberName}
                            </strong>{" "}
                            {msg.systemEvent?.description}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-[#1A73E8] dark:text-[#8AB4F8] font-medium group-hover:underline shrink-0 ml-2">
                          <span>View</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </motion.div>
                    );
                  }

                  const isSelf = msg.isSelf;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2.5 ${
                        isSelf ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isSelf && (
                        <AvatarWithFallback
                          avatarUrl={msg.senderAvatar}
                          name={msg.senderName}
                          sizeClass="w-7 h-7"
                          textClass="text-[10px] font-bold"
                          className="shrink-0 border border-[#DADCE0] dark:border-[#3C4043]"
                        />
                      )}

                      <div
                        className={`max-w-[78%] flex flex-col ${
                          isSelf ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          onDoubleClick={() => reactToMessage(msg.id, "🔥")}
                          className={`rounded-2xl p-3 text-xs leading-relaxed select-none relative shadow-xs ${
                            isSelf
                              ? "bg-[#E8F0FE] text-neutral-900 dark:bg-[#1A73E8]/20 dark:text-neutral-100 border border-[#D2E3FC] dark:border-[#1A73E8]/30 rounded-tr-xs"
                              : "bg-white text-neutral-900 dark:bg-[#1E1E1E] dark:text-neutral-100 border border-[#E8EAED] dark:border-[#303134] rounded-tl-xs"
                          }`}
                        >
                          {!isSelf && (
                            <div className="text-[11px] font-semibold text-[#1A73E8] dark:text-[#8AB4F8] mb-1">
                              {msg.senderName}
                            </div>
                          )}

                          {msg.type === "audio" ? (
                            <div className="flex items-center gap-3 py-1">
                              <button
                                type="button"
                                onClick={() => togglePlayAudio(msg.id)}
                                className="w-8 h-8 rounded-full bg-[#1A73E8] dark:bg-[#8AB4F8] text-white dark:text-[#121212] flex items-center justify-center font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
                              >
                                {playingAudioId === msg.id ? (
                                  <Pause className="w-4 h-4 fill-current" />
                                ) : (
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                )}
                              </button>

                              <div className="flex items-center gap-1 h-6">
                                {(
                                  msg.audioWaveform || [
                                    30, 60, 90, 45, 75, 100, 50, 80,
                                  ]
                                ).map((height, idx) => (
                                  <motion.div
                                    key={idx}
                                    animate={{
                                      height:
                                        playingAudioId === msg.id
                                          ? `${Math.max(
                                              20,
                                              (height * (Math.random() + 0.5)) / 2
                                            )}%`
                                          : `${height}%`,
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className={`w-1 rounded-full ${
                                      isSelf
                                        ? "bg-[#1A73E8] dark:bg-[#8AB4F8]"
                                        : "bg-[#5F6368] dark:bg-[#9AA0A6]"
                                    }`}
                                  />
                                ))}
                              </div>

                              <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                                {msg.audioDuration || "0:11"}
                              </span>
                            </div>
                          ) : (
                            <p>{msg.text}</p>
                          )}

                          <div className="text-[10px] mt-1 text-right text-neutral-500 dark:text-neutral-400">
                            {msg.timestamp}
                          </div>

                          {Object.keys(msg.reactions || {}).length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 -mb-1">
                              {Object.entries(msg.reactions).map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => reactToMessage(msg.id, emoji)}
                                  className="px-2 py-0.5 rounded-full bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[11px] text-neutral-700 dark:text-neutral-300 font-medium flex items-center gap-1 cursor-pointer hover:border-[#1A73E8]/50 shadow-2xs"
                                >
                                  <span>{emoji}</span>
                                  <span>{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input & Nudges Bar (Google Material 3) */}
              <div className="p-3 border-t border-[#E8EAED] dark:border-[#303134] bg-white dark:bg-[#1E1E1E] space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                    Nudge:
                  </span>
                  {[
                    {
                      label: "⚡ Wake Up!",
                      text: "Wake up squad! Multiplier deadline ticking! ⚡",
                    },
                    {
                      label: "👀 Waiting on you",
                      text: "Waiting on your proof drop! Let's get it in 👀",
                    },
                    {
                      label: "🔥 Let's Go!",
                      text: "Discipline compounds! Let's crush today 🔥",
                    },
                    {
                      label: "🏃 Lacing up",
                      text: "Lacing up right now. Let's do this!",
                    },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => sendQuickNudge("arena_members", chip.text)}
                      className="px-3 py-1 rounded-full bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-[11px] text-neutral-700 dark:text-neutral-300 font-medium hover:border-[#1A73E8] dark:hover:border-[#8AB4F8] hover:text-[#1A73E8] dark:hover:text-[#8AB4F8] hover:bg-[#E8F0FE]/40 dark:hover:bg-[#1A73E8]/10 transition whitespace-nowrap cursor-pointer active:scale-95 shadow-2xs"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {isRecording && (
                  <div className="p-3 rounded-2xl bg-[#FCE8E6] dark:bg-[#EA4335]/15 border border-[#FAD2CF] dark:border-[#EA4335]/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335] animate-ping" />
                      <span className="text-xs font-medium text-[#D93025] dark:text-[#F28B82]">
                        Recording voice note... ({15 - recordingSeconds}s remaining)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stopRecordingVoice(true)}
                      className="py-1 px-3.5 rounded-full bg-[#EA4335] text-white text-xs font-medium hover:bg-[#D93025] transition shadow-xs"
                    >
                      Send 🎙️
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendText} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder={`Message ${currentArena?.name || "squad"}...`}
                    className="flex-1 py-2 px-4 rounded-full bg-[#F1F3F4] dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] text-xs text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8] focus:ring-2 focus:ring-[#1A73E8]/15 transition"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      isRecording
                        ? stopRecordingVoice(true)
                        : startRecordingVoice()
                    }
                    className={`p-2 rounded-full transition cursor-pointer font-medium ${
                      isRecording
                        ? "bg-[#EA4335] text-white animate-bounce"
                        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D]"
                    }`}
                    title="Voice snippet (15s max)"
                  >
                    {isRecording ? (
                      <Square className="w-4 h-4 fill-white" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={!inputVal.trim()}
                    className="p-2 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white disabled:opacity-30 disabled:cursor-not-allowed font-medium transition cursor-pointer shadow-xs"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
