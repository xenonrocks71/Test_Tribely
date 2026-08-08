"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Start fade-out after 1.2s, fully remove after 1.6s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    const hideTimer = setTimeout(() => setVisible(false), 1600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!mounted || !visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #FFFFFF)",
        transition: "opacity 0.4s ease",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "all",
      }}
    >
      {/* Logo — pops in with spring animation */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          width: 160,
          height: 160,
          position: "relative",
          animation: "splashPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <Image
          src="/logo.png"
          alt="Tribely"
          fill
          priority
          sizes="160px"
          style={{
            objectFit: "contain",
          }}
        />
      </div>

      {/* Loading dots */}
      <div
        style={{
          position: "absolute",
          bottom: 52,
          display: "flex",
          gap: 7,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent, #FF5E00)",
              animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
}

