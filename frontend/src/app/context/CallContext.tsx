"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "../utils/api";
import { getWsBaseUrl } from "../utils/config";

export interface ActiveCallParticipant {
  user_id: number;
  user_name: string;
  joined_at?: number;
  is_muted?: boolean;
  is_hand_raised?: boolean;
}

export interface ActiveCallData {
  call_id: string;
  arena_id: number;
  host_id: number;
  host_name: string;
  call_type: "audio" | "video";
  status: "RINGING" | "IN_CALL" | "ENDED";
  participants: number[];
  participants_info?: ActiveCallParticipant[];
}

interface CallContextType {
  activeCall: ActiveCallData | null;
  isUserInCall: boolean;
  callDuration: number;
  isMuted: boolean;
  isCamOn: boolean;
  isHandRaised: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  remoteStreamsMap: Record<number, MediaStream>;
  joinArenaCall: (arenaId: number, callId?: string, callType?: "audio" | "video") => Promise<void>;
  leaveArenaCall: () => void;
  forceEndArenaCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleHand: () => void;
  toggleScreenShare: () => Promise<void>;
}

const CallContext = createContext<CallContextType>({
  activeCall: null,
  isUserInCall: false,
  callDuration: 0,
  isMuted: false,
  isCamOn: true,
  isHandRaised: false,
  isScreenSharing: false,
  localStream: null,
  remoteStreamsMap: {},
  joinArenaCall: async () => {},
  leaveArenaCall: () => {},
  forceEndArenaCall: () => {},
  toggleMute: () => {},
  toggleCamera: () => {},
  toggleHand: () => {},
  toggleScreenShare: async () => {},
});

export const useCallContext = () => useContext(CallContext);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);
  const [isUserInCall, setIsUserInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreamsMap, setRemoteStreamsMap] = useState<Record<number, MediaStream>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Call Duration Timer
  useEffect(() => {
    if (isUserInCall) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isUserInCall]);

  const getOrCreatePeerConnection = useCallback((remoteUserId: number) => {
    let pc: RTCPeerConnection;
    if (peerConnectionsRef.current.has(remoteUserId)) {
      pc = peerConnectionsRef.current.get(remoteUserId)!;
    } else {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          setRemoteStreamsMap((prev) => ({ ...prev, [remoteUserId]: stream }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
          peerConnectionsRef.current.delete(remoteUserId);
          setRemoteStreamsMap((prev) => {
            const next = { ...prev };
            delete next[remoteUserId];
            return next;
          });
        }
      };

      peerConnectionsRef.current.set(remoteUserId, pc);
    }

    if (localStreamRef.current) {
      const senders = pc.getSenders();
      localStreamRef.current.getTracks().forEach((track) => {
        const exists = senders.some((s) => s.track && s.track.kind === track.kind);
        if (!exists) pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }, []);

  const joinArenaCall = useCallback(
    async (arenaId: number, callId?: string, callType: "audio" | "video" = "video") => {
      try {
        const userIdStr = localStorage.getItem("tribely_user_id");
        const userId = userIdStr ? Number(userIdStr) : null;
        const userName = localStorage.getItem("tribely_user_name") || `Member`;

        // 1. Request user media permissions (mic/camera based on callType)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: true,
        });
        localStreamRef.current = stream;

        // 2. Fetch SFU Room Access Token
        try {
          await api.get(`/api/activity/arena/${arenaId}/call/token`);
        } catch {
          /* ignore SFU token errors */
        }

        // 3. Connect to WebSocket channel & broadcast JOIN_CALL
        const wsUrl = `${getWsBaseUrl()}/ws/arena/${arenaId}`;
        const token = localStorage.getItem("tribely_token");
        const ws = new WebSocket(token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              event_type: "JOIN_CALL",
              call_id: callId,
              caller_name: userName,
              call_type: callType,
              arena_id: arenaId,
            })
          );
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event_type === "INCOMING_CALL" || data.event_type === "USER_JOINED" || data.event_type === "USER_LEFT") {
              if (data.active_call) setActiveCall(data.active_call);
            } else if (data.event_type === "CALL_ENDED") {
              leaveArenaCall();
            } else if (data.event_type === "webrtc_signal" && userId) {
              const targetId = Number(data.target_user_id);
              const senderId = Number(data.sender_user_id);
              if (targetId === userId && senderId) {
                const pc = getOrCreatePeerConnection(senderId);
                if (data.sdp) {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                  if (data.sdp.type === "offer") {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    ws.send(
                      JSON.stringify({
                        event_type: "webrtc_signal",
                        target_user_id: senderId,
                        sender_user_id: userId,
                        sdp: answer,
                        arena_id: arenaId,
                      })
                    );
                  }
                } else if (data.candidate) {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
              }
            }
          } catch {
            /* ignore */
          }
        };

        setIsUserInCall(true);
        setActiveCall((prev) => ({
          call_id: callId || `call_${arenaId}`,
          arena_id: arenaId,
          host_id: userId || 1,
          host_name: userName,
          call_type: callType,
          status: "IN_CALL",
          participants: prev?.participants ? [...prev.participants, userId || 1] : [userId || 1],
        }));

        // 4. Navigate to target Arena
        router.push(`/arena/${arenaId}?action=in_call`);
      } catch (err) {
        console.error("Failed to join arena call:", err);
      }
    },
    [router, getOrCreatePeerConnection]
  );

  const leaveArenaCall = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "LEAVE_CALL",
          arena_id: activeCall?.arena_id,
        })
      );
      wsRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setRemoteStreamsMap({});
    setIsUserInCall(false);
    setActiveCall(null);
  }, [activeCall]);

  const [isHandRaised, setIsHandRaised] = useState(false);

  const forceEndArenaCall = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "FORCE_END_CALL",
          arena_id: activeCall?.arena_id,
        })
      );
    }
    leaveArenaCall();
  }, [activeCall, leaveArenaCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMutedState = audioTrack.enabled; // toggled inverse
        audioTrack.enabled = !newMutedState;
        setIsMuted(newMutedState);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              event_type: "TOGGLE_MUTE",
              arena_id: activeCall?.arena_id,
              is_muted: newMutedState,
            })
          );
        }
      }
    }
  }, [activeCall]);

  const toggleHand = useCallback(() => {
    const nextHandState = !isHandRaised;
    setIsHandRaised(nextHandState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "TOGGLE_HAND",
          arena_id: activeCall?.arena_id,
          is_hand_raised: nextHandState,
        })
      );
    }
  }, [activeCall, isHandRaised]);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOn(videoTrack.enabled);
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        const screenTrack = stream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => setIsScreenSharing(false);
      } catch {
        /* cancelled */
      }
    }
  }, [isScreenSharing]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        isUserInCall,
        callDuration,
        isMuted,
        isCamOn,
        isHandRaised,
        isScreenSharing,
        localStream: localStreamRef.current,
        remoteStreamsMap,
        joinArenaCall,
        leaveArenaCall,
        forceEndArenaCall,
        toggleMute,
        toggleCamera,
        toggleHand,
        toggleScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}
