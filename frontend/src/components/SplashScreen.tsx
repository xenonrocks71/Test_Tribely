"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade-out after 1.6s, fully remove after 2.1s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1600);
    const hideTimer = setTimeout(() => setVisible(false), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

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
        background: "#FFFFFF",
        transition: "opacity 0.5s ease",
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
          width: 180,
          height: 180,
          position: "relative",
          animation: "splashPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <Image
          src="/logo.png"
          alt="Tribely"
          fill
          priority
          sizes="180px"
          style={{
            objectFit: "contain",
          }}
        />
      </div>

      {/* Subtle loading dots at the bottom */}
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
              background: "#2563EB",
              animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.5,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashPop {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splashDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
