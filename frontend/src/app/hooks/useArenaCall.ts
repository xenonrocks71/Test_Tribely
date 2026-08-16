"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "../utils/api";

export type CallState = "IDLE" | "RINGING_OUTGOING" | "RINGING_INCOMING" | "IN_CALL" | "ENDED";

export interface CallSession {
  call_id: string;
  arena_id: number;
  host_id: number;
  host_name: string;
  call_type: "audio" | "video";
  status: "RINGING" | "IN_CALL" | "ENDED";
  participants: number[];
}

export function useArenaCall(arenaId: number, userId: number | null) {
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreamsMap, setRemoteStreamsMap] = useState<{ [userId: number]: MediaStream }>({});

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());

  // WebRTC Peer Connection Factory (Supports SFU / Mesh Hybrid)
  const getOrCreatePeerConnection = useCallback(
    (remoteUserId: number) => {
      let pc: RTCPeerConnection;
      if (peerConnectionsRef.current.has(remoteUserId)) {
        pc = peerConnectionsRef.current.get(remoteUserId)!;
      } else {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
        });

        pc.onicecandidate = (event) => {
          if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                event_type: "webrtc_signal",
                target_user_id: remoteUserId,
                sender_user_id: userId,
                candidate: event.candidate,
                arena_id: arenaId,
              })
            );
          }
        };

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const stream = event.streams[0];
            setRemoteStreamsMap((prev) => ({
              ...prev,
              [remoteUserId]: stream,
            }));
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
          if (!exists) {
            pc.addTrack(track, localStreamRef.current!);
          }
        });
      }

      return pc;
    },
    [arenaId, userId]
  );

  // Initialize Media Stream Tracks
  const startMediaTracks = useCallback(
    async (callType: "audio" | "video") => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: true,
        });
        localStreamRef.current = stream;

        // Re-attach tracks to active peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          stream.getTracks().forEach((track) => {
            const exists = senders.some((s) => s.track && s.track.kind === track.kind);
            if (!exists) {
              pc.addTrack(track, stream);
            }
          });
        });
      } catch (err) {
        console.error("Failed to acquire local media stream:", err);
      }
    },
    []
  );

  // Teardown Media Streams
  const stopMediaTracks = useCallback(() => {
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
  }, []);

  // Connect WebSocket & Listen for Call State Events
  useEffect(() => {
    if (!arenaId || !userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const token = typeof window !== "undefined" ? localStorage.getItem("tribely_token") : null;
    const wsUrl = `${protocol}//${host}/ws/arena/${arenaId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.event_type;

        // Requirement 1: Sender Exclusion Handled on Backend
        if (eventType === "INCOMING_CALL") {
          const session: CallSession = data.active_call;
          if (session && session.host_id !== userId) {
            setCallSession(session);
            setCallState("RINGING_INCOMING");
          }
        } else if (eventType === "USER_JOINED") {
          const session: CallSession = data.active_call;
          setCallSession(session);
          if (callState === "IN_CALL" && data.sender_user_id !== userId) {
            // Handshake offer to newly joined participant
            const pc = getOrCreatePeerConnection(data.sender_user_id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(
              JSON.stringify({
                event_type: "webrtc_signal",
                target_user_id: data.sender_user_id,
                sender_user_id: userId,
                sdp: offer,
                arena_id: arenaId,
              })
            );
          }
        } else if (eventType === "USER_LEFT") {
          const session: CallSession = data.active_call;
          setCallSession(session);
        } else if (eventType === "CALL_ENDED") {
          stopMediaTracks();
          setCallSession(null);
          setCallState("ENDED");
          setTimeout(() => setCallState("IDLE"), 2000);
        } else if (eventType === "webrtc_signal") {
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
      } catch (e) {
        console.error("WS message parse error:", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [arenaId, userId, callState, getOrCreatePeerConnection, stopMediaTracks]);

  // Initiate Outgoing Call
  const initiateCall = useCallback(
    async (callType: "audio" | "video") => {
      if (!userId || !wsRef.current) return;
      const userName = localStorage.getItem("tribely_user_name") || `User #${userId}`;
      await startMediaTracks(callType);
      setCallState("RINGING_OUTGOING");

      wsRef.current.send(
        JSON.stringify({
          event_type: "INITIATE_CALL",
          caller_name: userName,
          call_type: callType,
          arena_id: arenaId,
        })
      );

      // Fetch SFU Room Authentication Token
      try {
        await api.get(`/api/activity/arena/${arenaId}/call/token`);
      } catch (e) {
        console.error("SFU token fetch warning:", e);
      }

      setCallState("IN_CALL");
    },
    [arenaId, userId, startMediaTracks]
  );

  // Accept Incoming Call
  const acceptCall = useCallback(async () => {
    if (!userId || !wsRef.current || !callSession) return;
    const userName = localStorage.getItem("tribely_user_name") || `User #${userId}`;
    await startMediaTracks(callSession.call_type);

    wsRef.current.send(
      JSON.stringify({
        event_type: "JOIN_CALL",
        caller_name: userName,
        call_type: callSession.call_type,
        arena_id: arenaId,
      })
    );

    setCallState("IN_CALL");
  }, [arenaId, userId, callSession, startMediaTracks]);

  // Decline Incoming Call
  const declineCall = useCallback(() => {
    setCallState("IDLE");
    setCallSession(null);
  }, []);

  // Leave Call
  const leaveCall = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event_type: "LEAVE_CALL",
          arena_id: arenaId,
        })
      );
    }
    stopMediaTracks();
    setCallState("IDLE");
    setCallSession(null);
  }, [arenaId, stopMediaTracks]);

  // Audio Mute Toggle
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Video Camera Toggle
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOn(videoTrack.enabled);
      }
    }
  }, []);

  // Screen Share Toggle
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
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.error("Screen share cancelled:", err);
      }
    }
  }, [isScreenSharing]);

  return {
    callState,
    callSession,
    localStream: localStreamRef.current,
    remoteStreamsMap,
    isMuted,
    isCamOn,
    isScreenSharing,
    initiateCall,
    acceptCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
}
