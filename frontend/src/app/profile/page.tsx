"use client";

import { Suspense } from "react";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";
import { FeedContent } from "@/app/feed/page";

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center flex-col gap-3 bg-white dark:bg-[#0A0A0A] text-neutral-500">
          <div className="w-8 h-8 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading your profile…</span>
        </div>
      }
    >
      <AppProvider initialTab="profile">
        <AppShell>
          <FeedContent />
        </AppShell>
      </AppProvider>
    </Suspense>
  );
}
