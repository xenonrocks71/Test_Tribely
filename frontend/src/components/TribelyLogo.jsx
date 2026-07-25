"use client";

import React from "react";

export default function TribelyLogo({
  className = "h-8 w-8",
  style = {},
  showText = false,
}) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`} style={style}>
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto shrink-0"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="tribely-gradient"
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            {/* Updated to #007ACC brand accent */}
            <stop offset="0%" stopColor="#005fa3" />
            <stop offset="100%" stopColor="#0095F6" />
          </linearGradient>
        </defs>
        {/* outer hex ring */}
        <path
          d="M250 40 L440 150 L440 370 L250 480 L60 370 L60 150 Z"
          stroke="url(#tribely-gradient)"
          strokeWidth="28"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* inner hex */}
        <path
          d="M130 200 L180 150 L250 190 L320 150 L370 200 L370 340 L250 410 L130 340 Z"
          stroke="rgba(0,122,204,0.30)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* top dots */}
        <circle cx="180" cy="100" r="22" fill="url(#tribely-gradient)" />
        <circle cx="250" cy="70"  r="24" fill="url(#tribely-gradient)" />
        <circle cx="320" cy="100" r="22" fill="url(#tribely-gradient)" />
        {/* center arrow / T mark */}
        <path
          d="M250 360 L250 220 M210 260 L250 220 L290 260"
          stroke="url(#tribely-gradient)"
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {showText && (
        <div className="flex flex-col justify-center">
          <span
            className="font-extrabold text-lg leading-none tracking-tight"
            style={{ color: "var(--fg)" }}
          >
            TRIBELY
          </span>
          <span
            className="text-[10px] mt-0.5 font-medium"
            style={{ color: "var(--fg-muted)" }}
          >
            Accountability groups
          </span>
        </div>
      )}
    </div>
  );
}
