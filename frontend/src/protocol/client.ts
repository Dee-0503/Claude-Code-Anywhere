import { CLIENT_MESSAGE_TYPES } from "../../../shared/protocol/messages.js";
import type {
  AckOutputMessagePayload,
  ClientToServerMessage,
  HeartbeatMessagePayload,
  InputMessagePayload,
  ServerToClientMessage,
  WebSocketConnectionParams,
} from "../../../shared/protocol/messages.js";
import type { ProtocolError } from "../../../shared/protocol/errors.js";
import type {
  ClaudeInstanceId,
  InputMessageId,
} from "../../../shared/protocol/domain.js";

export type ProtocolClientStatus = "idle" | "connecting" | "open" | "closed" | "error";

export interface ProtocolClientOptions {
  url: string;
  WebSocketImpl?: typeof WebSocket;
}

export interface ProtocolClientEventMap {
  open: Event;
  close: CloseEvent;
  error: Event | ProtocolError;
  message: ServerToClientMessage;
  status: ProtocolClientStatus;
}

type ProtocolClientEvent = keyof ProtocolClientEventMap;
type ProtocolClientListener<TEvent extends ProtocolClientEvent> = (
  payload: ProtocolClientEventMap[TEvent],
) => void;

type ListenerRegistry = {
  [TEvent in ProtocolClientEvent]: Set<ProtocolClientListener<TEvent>>;
};

export class ProtocolClient {
  private readonly url: URL;
  private readonly WebSocketImpl: typeof WebSocket;
  private readonly listeners: ListenerRegistry = {
    open: new Set(),
    close: new Set(),
    error: new Set(),
    message: new Set(),
    status: new Set(),
  };
  private socket: WebSocket | null = null;
  private statusValue: ProtocolClientStatus = "idle";

  constructor(options: ProtocolClientOptions) {
    this.url = new URL(options.url);
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;
  }

  get status(): ProtocolClientStatus {
    return this.statusValue;
  }

  connect(params: WebSocketConnectionParams): void {
    if (this.socket && this.socket.readyState !== this.WebSocketImpl.CLOSED) {
      return;
    }

    const url = this.buildUrl(params);
    const socket = new this.WebSocketImpl(url);
    this.socket = socket;
    this.setStatus("connecting");

    socket.addEventListener("open", (event) => {
      this.setStatus("open");
      this.emit("open", event);
    });

    socket.addEventListener("close", (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }
      this.setStatus("closed");
      this.emit("close", event);
    });

    socket.addEventListener("error", (event) => {
      this.setStatus("error");
      this.emit("error", event);
    });

    socket.addEventListener("message", (event) => {
      const message = this.parseMessage(event.data);
      if (message) {
        this.emit("message", message);
      }
    });
  }

  disconnect(code?: number, reason?: string): void {
    if (!this.socket) {
      this.setStatus("closed");
      return;
    }

    this.socket.close(code, reason);
  }

  send(message: ClientToServerMessage): void {
    if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) {
      throw new Error("Protocol WebSocket is not open.");
    }

    this.socket.send(JSON.stringify(message));
  }

  sendInput(params: {
    instanceId: ClaudeInstanceId;
    inputId: InputMessageId;
    payload: string;
  }): void {
    const message: InputMessagePayload = {
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: params.instanceId,
      input_id: params.inputId,
      payload: params.payload,
    };

    this.send(message);
  }

  acknowledgeOutput(instanceId: ClaudeInstanceId, offset: number): void {
    const message: AckOutputMessagePayload = {
      type: CLIENT_MESSAGE_TYPES.ACK_OUTPUT,
      instance_id: instanceId,
      offset,
    };

    this.send(message);
  }

  heartbeat(sentAt: string = new Date().toISOString()): void {
    const message: HeartbeatMessagePayload = {
      type: CLIENT_MESSAGE_TYPES.HEARTBEAT,
      sent_at: sentAt,
    };

    this.send(message);
  }

  on<TEvent extends ProtocolClientEvent>(
    event: TEvent,
    listener: ProtocolClientListener<TEvent>,
  ): () => void {
    this.listeners[event].add(listener);
    return () => this.off(event, listener);
  }

  off<TEvent extends ProtocolClientEvent>(
    event: TEvent,
    listener: ProtocolClientListener<TEvent>,
  ): void {
    this.listeners[event].delete(listener);
  }

  private buildUrl(params: WebSocketConnectionParams): string {
    const url = new URL(this.url);
    url.searchParams.set("device_id", params.device_id);
    url.searchParams.set("access_token", params.access_token);
    url.searchParams.set("instance_id", params.instance_id satisfies ClaudeInstanceId);
    url.searchParams.set("last_output_offset", String(params.last_output_offset));
    return url.toString();
  }

  private parseMessage(data: unknown): ServerToClientMessage | null {
    try {
      return JSON.parse(String(data)) as ServerToClientMessage;
    } catch {
      this.emit("error", {
        code: "INVALID_MESSAGE",
        message: "Received invalid JSON from protocol WebSocket.",
        retryable: false,
      });
      return null;
    }
  }

  private setStatus(status: ProtocolClientStatus): void {
    this.statusValue = status;
    this.emit("status", status);
  }

  private emit<TEvent extends ProtocolClientEvent>(
    event: TEvent,
    payload: ProtocolClientEventMap[TEvent],
  ): void {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }
}
