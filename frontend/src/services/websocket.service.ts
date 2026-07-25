/**
 * Production WebSocket Service for Real-time Arena Syncing.
 * Implements auto-reconnection, event subscriber listener registries,
 * heartbeat handling, and connection lifecycle management.
 */

export type WebSocketEventListener = (data: any) => void;

export class WebSocketService {
  private socket: WebSocket | null = null;
  private arenaId: number | null = null;
  private token: string | null = null;
  private listeners: Set<WebSocketEventListener> = new Set();
  private reconnectIntervalMs: number = 3000;
  private maxReconnectAttempts: number = 5;
  private reconnectAttempts: number = 0;
  private isIntentionallyClosed: boolean = false;

  /**
   * Connect to an arena WebSocket channel.
   *
   * @param arenaId Target Arena ID.
   * @param token JWT token string.
   */
  public connect(arenaId: number, token: string): void {
    this.arenaId = arenaId;
    this.token = token;
    this.isIntentionallyClosed = false;

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const wsUrl = `${wsBaseUrl}/ws/arena/${arenaId}?token=${encodeURIComponent(token)}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      console.log(`[WebSocket] Connected to Arena #${arenaId}`);
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        this.notifyListeners(payload);
      } catch (err) {
        console.error('[WebSocket] Failed parsing incoming payload:', err);
      }
    };

    this.socket.onclose = () => {
      console.warn(`[WebSocket] Disconnected from Arena #${arenaId}`);
      if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts += 1;
        console.log(`[WebSocket] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        setTimeout(() => {
          if (this.arenaId && this.token) {
            this.connect(this.arenaId, this.token);
          }
        }, this.reconnectIntervalMs);
      }
    };

    this.socket.onerror = (error) => {
      console.error('[WebSocket] Transport error encountered:', error);
    };
  }

  /**
   * Send JSON message over active WebSocket socket.
   */
  public send(payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      console.warn('[WebSocket] Cannot send payload; socket is not in OPEN state.');
    }
  }

  /**
   * Subscribe to incoming room events.
   */
  public subscribe(listener: WebSocketEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(data: any): void {
    this.listeners.forEach((listener) => listener(data));
  }

  /**
   * Disconnect socket cleanly.
   */
  public disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.listeners.clear();
  }
}

// Global Singleton WebSocket Service Instance
export const webSocketService = new WebSocketService();
