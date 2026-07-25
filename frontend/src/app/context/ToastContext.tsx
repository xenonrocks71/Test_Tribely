"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  const toast = {
    success: (msg: string) => showToast(msg, "success"),
    error: (msg: string) => showToast(msg, "error"),
    info: (msg: string) => showToast(msg, "info"),
    warning: (msg: string) => showToast(msg, "warning"),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      {/* ── APPLE DYNAMIC ISLAND (MOBILE) & FLOATING TOAST (DESKTOP) ── */}
      <div className="fixed z-[9999] pointer-events-none inset-x-0 top-3 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto flex flex-col items-center sm:items-end gap-2.5 px-3 sm:px-0">
        {toasts.map((t) => (
          <ToastNode key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastNode({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  const borderGradients = {
    success: "rgba(16, 185, 129, 0.45)",
    error: "rgba(239, 68, 68, 0.45)",
    info: "rgba(0, 122, 204, 0.45)",
    warning: "rgba(245, 158, 11, 0.45)",
  };

  const iconBgs = {
    success: "linear-gradient(135deg, #10B981, #059669)",
    error: "linear-gradient(135deg, #EF4444, #DC2626)",
    info: "linear-gradient(135deg, #007ACC, #005999)",
    warning: "linear-gradient(135deg, #F59E0B, #D97706)",
  };

  return (
    <div
      onClick={onClose}
      className="pointer-events-auto cursor-pointer animate-scale-in flex items-center gap-3 px-4 py-2.5 rounded-full sm:rounded-2xl shadow-2xl transition-all duration-300 active:scale-95 max-w-[94vw] sm:max-w-md"
      style={{
        background: "var(--bg-card, rgba(20,20,20,0.88))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: `1px solid ${borderGradients[toast.type]}`,
        boxShadow: "0 12px 36px rgba(0,0,0,0.40)",
        color: "var(--fg, #fff)",
      }}
    >
      {/* Icon Badge */}
      <div
        className="w-6 h-6 rounded-full shrink-0 text-xs font-black flex items-center justify-center text-white shadow-sm"
        style={{ background: iconBgs[toast.type] }}
      >
        {icons[toast.type]}
      </div>

      {/* Content */}
      <p className="text-xs font-semibold leading-snug truncate sm:whitespace-normal">
        {toast.message}
      </p>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="ml-auto opacity-40 hover:opacity-100 text-xs font-bold px-1 transition"
      >
        ✕
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
