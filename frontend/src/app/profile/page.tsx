import { Suspense } from "react";
import UserProfileClient from "./profile-client";

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center flex-col gap-3"
          style={{ background: "var(--bg)", color: "var(--fg-muted)" }}
        >
          <svg
            className="w-8 h-8 animate-spin"
            style={{ color: "var(--accent)" }}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm font-medium">Loading your profile…</span>
        </div>
      }
    >
      <UserProfileClient />
    </Suspense>
  );
}
