import { apiClient } from "@/lib/api-client";

export interface OfflineProofItem {
  id: string;
  arenaId: number;
  proofUrl: string;
  capturedAt: string; // ISO string of exact capture moment
  caption?: string;
  retries: number;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
}

const STORAGE_KEY = "tribely_offline_proofs_queue";

export class OfflineProofQueueManager {
  private static instance: OfflineProofQueueManager;
  private isSyncing = false;
  private listeners: Array<(queue: OfflineProofItem[]) => void> = [];

  private constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.syncPendingProofs();
      });
    }
  }

  public static getInstance(): OfflineProofQueueManager {
    if (!OfflineProofQueueManager.instance) {
      OfflineProofQueueManager.instance = new OfflineProofQueueManager();
    }
    return OfflineProofQueueManager.instance;
  }

  public getPendingProofs(): OfflineProofItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveQueue(queue: OfflineProofItem[]) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      this.notifyListeners(queue);
    } catch (e) {
      console.error("[OfflineQueue] Failed to save queue to localStorage:", e);
    }
  }

  public subscribe(listener: (queue: OfflineProofItem[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getPendingProofs());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(queue: OfflineProofItem[]) {
    this.listeners.forEach((l) => {
      try {
        l(queue);
      } catch {}
    });
  }

  public enqueueProof(
    arenaId: number,
    proofUrl: string,
    caption?: string,
    capturedAt?: string
  ): OfflineProofItem {
    const queue = this.getPendingProofs();
    const item: OfflineProofItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      arenaId,
      proofUrl,
      capturedAt: capturedAt || new Date().toISOString(),
      caption: caption || "Habit proof recorded offline.",
      retries: 0,
      status: "pending",
    };

    queue.push(item);
    this.saveQueue(queue);

    // If online, immediately try to flush
    if (typeof navigator !== "undefined" && navigator.onLine) {
      this.syncPendingProofs();
    }

    return item;
  }

  public async syncPendingProofs(): Promise<{ synced: number; failed: number }> {
    if (typeof window === "undefined") return { synced: 0, failed: 0 };
    if (!navigator.onLine || this.isSyncing) return { synced: 0, failed: 0 };

    const queue = this.getPendingProofs();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;
    const remainingQueue: OfflineProofItem[] = [];

    for (const item of queue) {
      try {
        item.status = "syncing";
        this.saveQueue([...remainingQueue, item]);

        await apiClient.post("/api/activity/submit", {
          arena_id: item.arenaId,
          proof_url: item.proofUrl,
          client_submitted_at: item.capturedAt,
          caption: item.caption,
        });

        syncedCount++;
        // Successfully synced, don't re-add to remainingQueue
      } catch (err: any) {
        const status = err.response?.status;
        const errorDetail = err.response?.data?.detail;
        const errorCode = typeof errorDetail === "object" ? errorDetail?.error_code : "";

        // If permanent client error (e.g. already submitted 409 or deadline expired 400)
        if (status === 409 || status === 400 || errorCode === "DAILY_SUBMISSION_LOCKED") {
          console.warn("[OfflineQueue] Permanent rejection for queued proof:", errorDetail);
          // Drop to prevent eternal retry loop
        } else {
          item.retries += 1;
          item.status = "failed";
          item.lastError = typeof errorDetail === "string" ? errorDetail : err.message;
          remainingQueue.push(item);
          failedCount++;
        }
      }
    }

    this.saveQueue(remainingQueue);
    this.isSyncing = false;

    if (syncedCount > 0) {
      window.dispatchEvent(
        new CustomEvent("tribely:proofs_synced", {
          detail: { count: syncedCount },
        })
      );
    }

    return { synced: syncedCount, failed: failedCount };
  }
}

export const offlineProofQueue = OfflineProofQueueManager.getInstance();
