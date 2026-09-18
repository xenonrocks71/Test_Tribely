"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  Flame,
  CheckCircle2,
  Camera,
  UserPlus,
  UserCheck,
  PhoneCall,
  MessageSquare,
  Trophy,
  Check,
  Loader2,
  Sparkles,
  CheckCheck,
  ChevronRight
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tribelyService, ApiNotification } from "@/services/tribely.service";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type NotificationFilter = "all" | "proofs" | "requests";

/**
 * NotificationsModal (Accountability Radar)
 * 
 * Dynamic real-time notification drawer following Google Material 3 Workspace aesthetics.
 * Reflects:
 * 1. Proofs submitted across member squads with direct links.
 * 2. Join requests for private arena admins with immediate Approve / Decline action buttons.
 * 3. Member joined notifications for public arenas.
 * 4. Streak reminders, call invites, and kudos reward alerts.
 */
export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { user, showToast, triggerHaptic } = useApp();

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await tribelyService.fetchNotifications(50);
      setNotifications(res.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Real-time WebSocket event listener for live notifications
  useEffect(() => {
    const handleWsNotification = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const data = customEvt.detail;
      if (data?.notification) {
        // Prepend or re-fetch notifications
        loadNotifications();
      }
    };

    window.addEventListener("tribely:notification_update", handleWsNotification);
    return () => {
      window.removeEventListener("tribely:notification_update", handleWsNotification);
    };
  }, []);

  // Handle Approve Member Join Request
  const handleApprove = async (item: ApiNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.arena_id || !item.target_user_id) return;
    triggerHaptic([20, 20]);
    setActionLoadingId(item.id);

    try {
      const res = await tribelyService.approveJoinRequest(item.arena_id, item.target_user_id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? { ...n, status: "approved", is_admin_actionable: false }
              : n
          )
        );
        showToast(`✓ Approved ${item.target_user_name || "member"} to join!`, "success");
      } else {
        showToast(res.message || "Failed to approve request", "info");
      }
    } catch {
      showToast("Network error approving request", "info");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Decline Member Join Request
  const handleReject = async (item: ApiNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.arena_id || !item.target_user_id) return;
    triggerHaptic([15]);
    setActionLoadingId(item.id);

    try {
      const res = await tribelyService.rejectJoinRequest(item.arena_id, item.target_user_id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? { ...n, status: "rejected", is_admin_actionable: false }
              : n
          )
        );
        showToast(`Declined join request`, "info");
      } else {
        showToast(res.message || "Failed to decline request", "info");
      }
    } catch {
      showToast("Network error declining request", "info");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Mark All As Read
  const handleMarkAllRead = async () => {
    triggerHaptic([10]);
    await tribelyService.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    showToast("All notifications marked as read", "info");
  };

  // Handle Item Click (Navigate to Arena or Proof)
  const handleItemClick = (item: ApiNotification) => {
    triggerHaptic([10]);
    const targetUrl = item.data?.url || (item.arena_id ? `/arenas/${item.arena_id}` : null);
    if (targetUrl) {
      onClose();
      router.push(targetUrl);
    }
  };

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "proofs") {
      return notifications.filter((n) => n.event_type === "proof_submission");
    }
    if (activeFilter === "requests") {
      return notifications.filter(
        (n) => n.event_type === "join_request" || n.event_type === "member_joined"
      );
    }
    return notifications;
  }, [notifications, activeFilter]);

  const pendingRequestsCount = useMemo(() => {
    return notifications.filter((n) => n.event_type === "join_request" && n.status === "pending").length;
  }, [notifications]);

  const proofCount = useMemo(() => {
    return notifications.filter((n) => n.event_type === "proof_submission").length;
  }, [notifications]);

  if (!isOpen) return null;

  // Render appropriate Google Material 3 icon per event type
  const renderItemIcon = (item: ApiNotification) => {
    switch (item.event_type) {
      case "join_request":
        return (
          <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4 stroke-[2]" />
          </div>
        );
      case "member_joined":
      case "join_approved":
        return (
          <div className="w-8 h-8 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] dark:text-[#81C995] border border-[#CEEAD6] dark:border-[#0F9D58]/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4 stroke-[2]" />
          </div>
        );
      case "proof_submission":
        return (
          <div className="w-8 h-8 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] dark:text-[#81C995] border border-[#CEEAD6] dark:border-[#0F9D58]/30 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 stroke-[2]" />
          </div>
        );
      case "call_invite":
        return (
          <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center shrink-0">
            <PhoneCall className="w-4 h-4 stroke-[2]" />
          </div>
        );
      case "chat_message":
        return (
          <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 stroke-[2]" />
          </div>
        );
      case "streak":
        return (
          <div className="w-8 h-8 rounded-full bg-[#FEF7E0] dark:bg-[#F9AB00]/15 text-amber-600 dark:text-amber-400 border border-[#FEEFC3] dark:border-[#F9AB00]/30 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 stroke-[2] fill-amber-500/30" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 stroke-[2]" />
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full max-w-lg bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-3xl shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Top Header (Clean Google Style) ── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8EAED] dark:border-[#303134] bg-white dark:bg-[#1E1E1E] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">
                  Accountability Radar
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Real-time alerts, streak risks & proof consensus
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer"
                  title="Mark all as read"
                  aria-label="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Filter Pills (Google Workspace Segmented Control) ── */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[#E8EAED] dark:border-[#303134] bg-[#F8F9FA] dark:bg-[#202124] shrink-0 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveFilter("all");
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === "all"
                  ? "bg-blue-600 dark:bg-blue-500 text-white shadow-xs"
                  : "bg-white dark:bg-[#282A2D] text-neutral-600 dark:text-neutral-400 border border-[#DADCE0] dark:border-[#3C4043] hover:border-neutral-400"
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-80">({notifications.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveFilter("proofs");
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === "proofs"
                  ? "bg-blue-600 dark:bg-blue-500 text-white shadow-xs"
                  : "bg-white dark:bg-[#282A2D] text-neutral-600 dark:text-neutral-400 border border-[#DADCE0] dark:border-[#3C4043] hover:border-neutral-400"
              }`}
            >
              <span>Proofs</span>
              {proofCount > 0 && <span className="text-[10px] opacity-80">({proofCount})</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic([10]);
                setActiveFilter("requests");
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === "requests"
                  ? "bg-blue-600 dark:bg-blue-500 text-white shadow-xs"
                  : "bg-white dark:bg-[#282A2D] text-neutral-600 dark:text-neutral-400 border border-[#DADCE0] dark:border-[#3C4043] hover:border-neutral-400"
              }`}
            >
              <span>Join Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>

          {/* ── Notification List Body ── */}
          <div className="p-4 sm:p-5 space-y-2.5 overflow-y-auto flex-1 bg-white dark:bg-[#1E1E1E]">
            {isLoading ? (
              <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading radar alerts...</p>
              </div>
            ) : filteredNotifications.length > 0 ? (
              filteredNotifications.map((item) => {
                const isPendingJoin = item.event_type === "join_request" && item.status === "pending";
                const isApprovedJoin = item.event_type === "join_request" && item.status === "approved";
                const isRejectedJoin = item.event_type === "join_request" && item.status === "rejected";
                const isActionLoading = actionLoadingId === item.id;
                const timeAgo = item.created_at ? tribelyService.formatTimeAgo(item.created_at) : "Recent";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 rounded-2xl border transition-all duration-150 flex flex-col gap-2.5 cursor-pointer ${
                      isPendingJoin
                        ? "bg-[#FEF7E0]/40 dark:bg-[#F9AB00]/10 border-amber-300/80 dark:border-amber-500/30 hover:border-amber-400"
                        : item.is_read
                        ? "bg-[#F8F9FA] dark:bg-[#202124] border-[#E8EAED] dark:border-[#303134] hover:border-[#1A73E8]/40 dark:hover:border-[#8AB4F8]/40"
                        : "bg-white dark:bg-[#25262A] border-blue-200 dark:border-blue-900/60 shadow-xs hover:border-[#1A73E8]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar / Icon Badge */}
                      {renderItemIcon(item)}

                      {/* Content Area */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 font-medium">
                            {timeAgo}
                          </span>
                        </div>

                        <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed">
                          {item.body}
                        </p>

                        {/* Squad / Arena Badge */}
                        {item.arena_name && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="inline-flex items-center text-[10px] font-medium text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-[#282A2D] border border-neutral-200 dark:border-[#3C4043]">
                              {item.arena_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Interactive In-Modal Join Actions for Arena Admins ── */}
                    {item.event_type === "join_request" && (
                      <div
                        className="pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                          {isPendingJoin && "Approval required"}
                          {isApprovedJoin && "Member accepted"}
                          {isRejectedJoin && "Request declined"}
                        </span>

                        <div className="flex items-center gap-2">
                          {isPendingJoin ? (
                            <>
                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={(e) => handleReject(item, e)}
                                className="px-3 py-1 rounded-full text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border border-[#DADCE0] dark:border-[#3C4043] hover:bg-neutral-100 dark:hover:bg-[#282A2D] transition cursor-pointer disabled:opacity-50"
                              >
                                Decline
                              </button>

                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={(e) => handleApprove(item, e)}
                                className="px-3.5 py-1 rounded-full text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {isActionLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                )}
                                <span>Approve</span>
                              </button>
                            </>
                          ) : isApprovedJoin ? (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] border border-[#CEEAD6] dark:border-[#0F9D58]/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approved</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                              Declined
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              /* ── Google Material 3 "All Caught Up" Empty State ── */
              <div className="py-14 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 border border-[#D2E3FC] dark:border-[#1A73E8]/30 flex items-center justify-center text-2xl shadow-xs">
                  🛡️
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {activeFilter === "proofs"
                      ? "No recent proof alerts"
                      : activeFilter === "requests"
                      ? "No pending join requests"
                      : "All caught up"}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mt-1 leading-relaxed">
                    {activeFilter === "proofs"
                      ? "When your squad members drop their daily habit proofs, verification alerts will appear here."
                      : activeFilter === "requests"
                      ? "When members request to join your private habit squads, you can review and approve them here."
                      : "No active streak alerts, unverified proof challenges, or pending requests right now. Keep your streak burning!"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-5 py-3 border-t border-[#E8EAED] dark:border-[#303134] bg-[#F8F9FA] dark:bg-[#202124] flex items-center justify-between shrink-0">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Tribely Real-Time Proof Radar is active</span>
            </span>

            <button
              type="button"
              onClick={loadNotifications}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
