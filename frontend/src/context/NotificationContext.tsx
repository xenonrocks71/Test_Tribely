"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/app/utils/api";
import { getWsBaseUrl } from "@/app/utils/config";
import { Bell, MessageCircle, X, ExternalLink } from "lucide-react";

interface NotificationBanner {
  id: string;
  title: string;
  body: string;
  arenaId?: number;
  url?: string;
}

interface NotificationContextType {
  unreadCounts: Record<number, number>;
  markArenaRead: (arenaId: number) => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCounts: {},
  markArenaRead: async () => {},
  fetchUnreadCounts: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [activeBanner, setActiveBanner] = useState<NotificationBanner | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Play real-time notification chime
  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      /* Audio Context fallback */
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tribely_token");
      if (!token) return;
      const res = await api.get("/api/notifications/unread-counts");
      if (res.data?.data?.unread_counts) {
        setUnreadCounts(res.data.data.unread_counts);
      }
    } catch {
      /* ignore */
    }
  };

  const markArenaRead = async (arenaId: number) => {
    try {
      await api.post(`/api/notifications/arena/${arenaId}/read`);
      setUnreadCounts((prev) => ({ ...prev, [arenaId]: 0 }));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchUnreadCounts();

    const token = localStorage.getItem("token") || localStorage.getItem("tribely_token");
    if (!token) return;

    const wsUrl = `${getWsBaseUrl()}/ws/notifications?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.event_type === "proof_comment_added") {
          window.dispatchEvent(
            new CustomEvent("tribely:proof_comment_added", { detail: data })
          );
        }

        if (data.event_type === "unread_update" || data.notification || data.event_type === "join_request" || data.event_type === "member_joined") {
          const targetArena = data.arena_id;
          const newCount = data.unread_count || 1;

          if (targetArena) {
            setUnreadCounts((prev) => ({ ...prev, [targetArena]: newCount }));
          }

          // Broadcast real-time notification update to in-app listeners (like NotificationsModal)
          window.dispatchEvent(
            new CustomEvent("tribely:notification_update", { detail: data })
          );

          if (data.notification) {
            playChime();
            setActiveBanner({
              id: String(Date.now()),
              title: data.notification.title || "New Notification",
              body: data.notification.body || "New activity in your arena!",
              arenaId: targetArena,
              url: data.notification.data_json?.url || `/arenas/${targetArena}`,
            });

            // Auto dismiss banner after 5 seconds
            setTimeout(() => {
              setActiveBanner((cur) => (cur?.id === String(Date.now()) ? null : cur));
            }, 5000);
          }
        }
      } catch (e) {
        console.error("Error parsing notification WebSocket event:", e);
      }
    };

    return () => {
      ws.onclose = null;
      ws.onerror = () => {};
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => {
          try {
            ws.close(1000, "Clean unmount");
          } catch {}
        };
      } else if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1000, "Clean unmount");
        } catch {}
      }
    };
  }, []);

  const handleToastClick = (banner: NotificationBanner) => {
    if (banner.url) {
      router.push(banner.url);
    } else if (banner.arenaId) {
      router.push(`/arenas/${banner.arenaId}`);
    }
    setActiveBanner(null);
  };

  return (
    <NotificationContext.Provider value={{ unreadCounts, markArenaRead, fetchUnreadCounts }}>
      {children}

      {/* Floating In-App DM Toast Popup Banner */}
      {activeBanner && (
        <div
          onClick={() => handleToastClick(activeBanner)}
          className="fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-2xl shadow-2xl border cursor-pointer animate-slide-down flex items-start gap-3.5 transition-all hover:scale-102 active:scale-98"
          style={{
            background: "rgba(15, 23, 42, 0.95)",
            borderColor: "var(--accent)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(255, 94, 0, 0.2)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
            style={{
              background: activeBanner.title.includes("Call")
                ? "linear-gradient(135deg, #10B981, #059669)"
                : "var(--accent-gradient)",
            }}
          >
            {activeBanner.title.includes("Call") ? "📞" : <MessageCircle className="w-5 h-5 text-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-white truncate leading-snug">{activeBanner.title}</h4>
            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">{activeBanner.body}</p>
            {activeBanner.title.includes("Call") ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToastClick(activeBanner);
                }}
                className="mt-2 px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[10px] font-black transition shadow-md flex items-center gap-1 cursor-pointer"
              >
                <span>📞 Join Call Now 🚀</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-[var(--accent)] mt-1.5">
                <span>Tap to open Arena</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveBanner(null);
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
