const WS_URL = 'ws://localhost:8765/ws';

export type WsMessageHandler = (msg: WsMessage) => void;

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

class WsClient {
  private ws: WebSocket | null = null;
  private handlers: WsMessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _intentionalClose = false;

  connect(): void {
    this._intentionalClose = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(WS_URL);

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      if (!this._intentionalClose) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this._intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  onMessage(handler: WsMessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }
}

export const wsClient = new WsClient();
