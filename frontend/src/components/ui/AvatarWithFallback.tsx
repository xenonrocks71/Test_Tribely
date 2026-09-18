"use client";

import React, { useState } from "react";
import { resolveBackendUrl } from "@/lib/api-client";

interface AvatarWithFallbackProps {
  avatarUrl?: string | null;
  name?: string;
  sizeClass?: string;
  className?: string;
  textClass?: string;
}

/**
 * AvatarWithFallback
 * Renders the user's actual uploaded profile photo.
 * Falls back to a gradient circle with the user's first initial if:
 *   - No avatar URL is set
 *   - The avatar URL is a DiceBear cartoon URL (legacy)
 *   - The image fails to load (404, CORS, etc.)
 */
export const AvatarWithFallback: React.FC<AvatarWithFallbackProps> = ({
  avatarUrl,
  name = "U",
  sizeClass = "w-8 h-8",
  className = "",
  textClass = "text-xs",
}) => {
  const [imgError, setImgError] = useState(false);

  // Reset imgError whenever avatarUrl changes so new uploaded photos or previews display immediately
  React.useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const isValidUrl =
    avatarUrl &&
    avatarUrl.trim() !== "" &&
    !avatarUrl.includes("dicebear.com");

  const resolvedUrl = isValidUrl ? resolveBackendUrl(avatarUrl!) : "";
  const showImage = Boolean(resolvedUrl) && !imgError;
  const initial = (name || "U").trim().charAt(0).toUpperCase();

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 select-none ${className}`}>
      {showImage ? (
        <img
          key={resolvedUrl}
          src={resolvedUrl}
          alt={name}
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#1A73E8] to-[#4285F4] text-white flex items-center justify-center font-bold select-none">
          <span className={textClass}>{initial}</span>
        </div>
      )}
    </div>
  );
};
