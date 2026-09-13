"use client";

import React, { useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";
import { ArenasView } from "@/components/arenas/ArenasView";
import { CameraModal } from "@/components/capture/CameraModal";
import { TribeChatDrawer } from "@/components/chat/TribeChatDrawer";
import { ProofReplyModal } from "@/components/feed/ProofReplyModal";

function ArenasContent() {
  const { setActiveTab } = useApp();

  useEffect(() => {
    setActiveTab("explore");
  }, [setActiveTab]);

  return (
    <>
      <ArenasView />
      <CameraModal />
      <TribeChatDrawer />
      <ProofReplyModal />
    </>
  );
}

export default function ArenasPage() {
  return (
    <AppProvider>
      <AppShell>
        <ArenasContent />
      </AppShell>
    </AppProvider>
  );
}
