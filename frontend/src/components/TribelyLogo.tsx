import Image from "next/image";

interface TribelyLogoProps {
  /** Size of the logo icon in px. Default: 36 */
  size?: number;
  /** Extra className for the wrapper */
  className?: string;
}

/**
 * Reusable Tribely brand logo component.
 * Uses /public/logo.png — the actual Tribely brand logo.
 * 
 * Usage:
 *   <TribelyLogo />           → 36px logo icon
 *   <TribelyLogo size={48} /> → larger logo icon
 */
export default function TribelyLogo({
  size = 36,
  className = "",
}: TribelyLogoProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center relative ${className}`}
      style={{
        width: size,
        height: size,
        background: "#FFFFFF",
        flexShrink: 0,
      }}
    >
      <Image
        src="/logo.png"
        alt="Tribely"
        fill
        priority
        sizes={`${size}px`}
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
