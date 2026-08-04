import React from "react";

interface BubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
  variant?: "default" | "muted" | "accent";
  children: React.ReactNode;
}

export function BubbleGroup({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col gap-1 w-full ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Bubble({
  align = "start",
  variant = "default",
  children,
  className = "",
  style,
  ...props
}: BubbleProps) {
  const isEnd = align === "end";
  const isMuted = variant === "muted";

  return (
    <div
      className={`relative max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all ${
        isEnd ? "self-end ml-auto" : "self-start mr-auto"
      } ${
        isMuted
          ? "bg-[var(--bg-raised)] text-[var(--fg)] border border-[var(--border)]"
          : isEnd
          ? "btn-accent text-white"
          : "bg-[var(--bg-card)] text-[var(--fg)] border border-[var(--border)]"
      } ${className}`}
      style={{
        background: isMuted
          ? "var(--bg-raised)"
          : isEnd
          ? "var(--accent-gradient)"
          : "var(--bg-card)",
        color: isEnd ? "#FFFFFF" : "var(--fg)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function BubbleContent({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`whitespace-pre-wrap break-words font-medium ${className}`} {...props}>
      {children}
    </div>
  );
}

export function BubbleReactions({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`absolute -bottom-3 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-md transition transform hover:scale-105 active:scale-95 border cursor-pointer select-none ${className}`}
      style={{
        background: "var(--bg-card)",
        color: "var(--fg)",
        borderColor: "var(--border)",
        minHeight: "28px",
      }}
      {...props}
    >
      {children}
    </div>
  );
}
