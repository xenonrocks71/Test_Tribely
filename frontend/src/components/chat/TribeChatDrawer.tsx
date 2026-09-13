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
  Shield,
  Heart,
  Sparkles,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Search,
  Camera,
  ChevronDown,
} from "lucide-react";
import { useApp, TribeMessage, HabitArena } from "@/context/AppContext";
import { tribelyService } from "@/services/tribely.service";

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
          timestamp: new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
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
      <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm">
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
          className="w-full max-w-md h-full bg-neutral-950 border-l border-neutral-900 flex flex-col justify-between shadow-2xl touch-pan-y"
        >
          {/* ═══════════════════════════════════════════════════════════════
              VIEW A: INSTAGRAM DIRECT MESSAGES INBOX (ARENA LIST)
             ═══════════════════════════════════════════════════════════════ */}
          {!activeDmArena ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Inbox Header matching Instagram DM */}
              <div className="p-4 border-b border-neutral-900 flex items-center justify-between bg-neutral-950/95 sticky top-0 z-10">
                <div className="flex items-center gap-1.5 cursor-pointer">
                  <span className="text-base font-black text-white tracking-tight">
                    {user.username || user.name || "Messages"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeDm}
                    className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 transition cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-4 py-2.5 bg-neutral-950">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 focus-within:border-neutral-700 transition">
                  <Search className="w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search squads and messages..."
                    className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-neutral-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Title Row */}
              <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Squad Messages
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {arenas.length} Active Squads
                </span>
              </div>

              {/* Arenas List (Matching User's Instagram DM Screenshot) */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/50 no-scrollbar">
                {filteredArenas.length === 0 ? (
                  <div className="py-16 text-center text-neutral-500 text-xs flex flex-col items-center gap-2">
                    <span className="text-2xl">🔍</span>
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
                        className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900/60 active:bg-neutral-900 transition cursor-pointer group"
                      >
                        {/* Left: Circular Avatar with Online Ring */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]">
                              <div className="w-full h-full rounded-full bg-neutral-900 border border-neutral-950 flex items-center justify-center text-xl overflow-hidden">
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
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-neutral-950" />
                          </div>

                          {/* Middle: Arena Name + Latest Message Snippet */}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-white truncate leading-tight group-hover:text-emerald-400 transition">
                              {arena.name}
                            </h4>
                            <p className="text-[11px] text-neutral-400 truncate mt-0.5 leading-snug font-medium">
                              {previewText}
                            </p>
                          </div>
                        </div>

                        {/* Right: Unread Dot + Quick Camera Action Button */}
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic([20]);
                              openCamera();
                            }}
                            className="p-1.5 text-neutral-400 hover:text-white transition cursor-pointer"
                            title="Drop quick proof"
                          >
                            <Camera className="w-5 h-5 stroke-[1.5]" />
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
            <>
              {/* Chat Header with Back Arrow to return to Arenas List */}
              <div className="p-3.5 border-b border-neutral-900 flex items-center justify-between bg-neutral-950/95 sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                  {/* Back to Arenas List */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([15]);
                      openMessagesInbox();
                    }}
                    className="p-1 text-neutral-400 hover:text-white transition cursor-pointer"
                    aria-label="Back to messages"
                    title="Back to squads list"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Arena Avatar & Details */}
                  <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-base shrink-0">
                    {currentArena?.emoji || "⚔️"}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white leading-tight">
                      {currentArena?.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        {currentArena?.memberCount || 12} members online
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDm}
                  className="p-1.5 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Room Messages Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 no-scrollbar">
                {allMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-neutral-600 gap-2">
                    <span className="text-4xl">💬</span>
                    <p className="text-xs font-semibold text-neutral-300">
                      Welcome to {currentArena?.name}!
                    </p>
                    <p className="text-[11px] text-neutral-500 text-center max-w-xs">
                      Send a message to cheer on your cohort and keep the daily momentum alive.
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
                        className="p-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                            {msg.systemEvent?.type === "shield_used" ? (
                              <Shield className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="text-[11px] leading-snug text-neutral-300">
                            <strong className="text-white font-bold">
                              {msg.systemEvent?.memberName}
                            </strong>{" "}
                            {msg.systemEvent?.description}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold group-hover:text-emerald-400 transition">
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
                        <img
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-neutral-800"
                        />
                      )}

                      <div
                        className={`max-w-[78%] flex flex-col ${
                          isSelf ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          onDoubleClick={() => reactToMessage(msg.id, "🔥")}
                          className={`rounded-2xl p-3 text-xs leading-relaxed select-none relative ${
                            isSelf
                              ? "bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950/40"
                              : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-none"
                          }`}
                        >
                          {!isSelf && (
                            <div className="text-[10px] font-bold text-emerald-400 mb-1">
                              {msg.senderName}
                            </div>
                          )}

                          {msg.type === "audio" ? (
                            <div className="flex items-center gap-3 py-1">
                              <button
                                type="button"
                                onClick={() => togglePlayAudio(msg.id)}
                                className="w-8 h-8 rounded-full bg-white text-neutral-950 flex items-center justify-center font-bold shadow hover:scale-105 transition cursor-pointer"
                              >
                                {playingAudioId === msg.id ? (
                                  <Pause className="w-4 h-4 fill-neutral-950" />
                                ) : (
                                  <Play className="w-4 h-4 fill-neutral-950 ml-0.5" />
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
                                      isSelf ? "bg-emerald-200" : "bg-emerald-400"
                                    }`}
                                  />
                                ))}
                              </div>

                              <span
                                className={`text-[10px] font-bold ${
                                  isSelf ? "text-emerald-200" : "text-neutral-400"
                                }`}
                              >
                                {msg.audioDuration || "0:11"}
                              </span>
                            </div>
                          ) : (
                            <p>{msg.text}</p>
                          )}

                          <div
                            className={`text-[9px] mt-1 text-right ${
                              isSelf ? "text-emerald-200" : "text-neutral-500"
                            }`}
                          >
                            {msg.timestamp}
                          </div>

                          {Object.keys(msg.reactions || {}).length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 -mb-1">
                              {Object.entries(msg.reactions).map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => reactToMessage(msg.id, emoji)}
                                  className="px-1.5 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:scale-105"
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

              {/* Chat Input & Pokes Bar */}
              <div className="p-3 border-t border-neutral-900 bg-neutral-950 space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[10px] font-black uppercase text-neutral-500 shrink-0">
                    Pokes:
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
                      className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 font-semibold hover:border-emerald-500/40 hover:text-white transition whitespace-nowrap cursor-pointer active:scale-95"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {isRecording && (
                  <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-xs font-bold text-rose-300">
                        Recording Walkie-Talkie Snippet... (
                        {15 - recordingSeconds}s remaining)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stopRecordingVoice(true)}
                      className="py-1 px-3 rounded-xl bg-rose-500 text-neutral-950 text-xs font-black"
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
                    className="flex-1 py-2.5 px-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      isRecording
                        ? stopRecordingVoice(true)
                        : startRecordingVoice()
                    }
                    className={`p-2.5 rounded-2xl transition cursor-pointer font-bold ${
                      isRecording
                        ? "bg-rose-500 text-white animate-bounce"
                        : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700"
                    }`}
                    title="Walkie-Talkie Voice Drop (15s Max)"
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
                    className="p-2.5 rounded-2xl bg-emerald-500 text-neutral-950 disabled:opacity-40 disabled:cursor-not-allowed font-bold hover:brightness-110 active:scale-95 transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
