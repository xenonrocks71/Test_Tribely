"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/app/utils/api";
import { getWsBaseUrl } from "@/app/utils/config";

export interface Message {
  id: number;
  user_id: number;
  sender_name: string;
  sender_avatar_url?: string | null;
  content: string;
  message_type: string;
  created_at: string;
}

export function useArenaChat(arenaId: number | string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!arenaId) return;

    let isMounted = true;
    const wsBase = getWsBaseUrl();
    const wsUrl = `${wsBase}/ws/arena/${arenaId}`;
    const wsToken = typeof window !== "undefined" ? localStorage.getItem("tribely_token") : null;

    const ws = new WebSocket(
      wsToken ? `${wsUrl}?token=${encodeURIComponent(wsToken)}` : wsUrl
    );
    wsRef.current = ws;

    ws.onopen = () => {
      if (isMounted) setIsConnected(true);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "chat_message" && data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch {
        // Non-JSON WS frame
      }
    };

    ws.onclose = () => {
      if (isMounted) setIsConnected(false);
    };

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [arenaId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !arenaId) return;
    try {
      const res = await api.post(`/api/activity/arena/${arenaId}/chat`, {
        content: content.trim(),
        message_type: "text",
      });
      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
      }
      setChatInput("");
    } catch (err) {
      console.error("Failed to send chat message", err);
    }
  }, [arenaId]);

  return {
    messages,
    setMessages,
    chatInput,
    setChatInput,
    isConnected,
    sendMessage,
  };
}
