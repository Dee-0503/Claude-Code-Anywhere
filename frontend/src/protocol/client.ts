import { CLIENT_MESSAGE_TYPES } from '../../../shared/protocol/messages.js';
import type {
  AckOutputMessagePayload,
  ClientToServerMessage,
  HeartbeatMessagePayload,
  InputMessagePayload,
  ServerToClientMessage,
  WebSocketConnectionParams
} from '../../../shared/protocol/messages.js';
import type { ProtocolError } from '../../../shared/protocol/errors.js';
import type { ClaudeInstanceId, InputMessageId } from '../../../shared/protocol/domain.js';

export type ProtocolClientStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface ReconnectOptions {
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
}

export interface RecoveryOffsets {
  readonly lastOutputOffset?: number;
  readonly lastInputOffset?: number;
}

export function shouldReconnectAfterClose(event: Pick<CloseEvent, 'code' | 'wasClean'>): boolean {
  if ([1000, 1001, 1002, 1003, 1007, 1008].includes(event.code)) {
    return false;
  }
  if (event.code >= 4000 && event.code < 4100) {
    return false;
  }
  return event.code === 1006 || event.code === 1011 || !event.wasClean;
}

export interface ProtocolClientOptions {
  url: string;
  WebSocketImpl?: typeof WebSocket;
  reconnect?: ReconnectOptions;
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
  payload: ProtocolClientEventMap[TEvent]
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
    status: new Set()
  };
  private socket: WebSocket | null = null;
  private statusValue: ProtocolClientStatus = 'idle';
  private connectionParams: WebSocketConnectionParams | null = null;
  private reconnectTimer: number | null = null;
  private reconnectDelayMs: number;
  private intentionalDisconnect = false;
  private readonly initialReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;

  constructor(options: ProtocolClientOptions) {
    this.url = new URL(options.url);
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;
    this.initialReconnectDelayMs = options.reconnect?.initialDelayMs ?? 500;
    this.maxReconnectDelayMs = options.reconnect?.maxDelayMs ?? 5_000;
    this.reconnectDelayMs = this.initialReconnectDelayMs;
  }

  get status(): ProtocolClientStatus {
    return this.statusValue;
  }

  connect(params: WebSocketConnectionParams): void {
    this.connectionParams = params;
    this.intentionalDisconnect = false;
    this.openSocket(params, 'connecting');
  }

  private openSocket(params: WebSocketConnectionParams, status: ProtocolClientStatus): void {
    if (this.socket && this.socket.readyState !== this.WebSocketImpl.CLOSED) {
      return;
    }

    const url = this.buildUrl(params);
    const socket = new this.WebSocketImpl(url);
    this.socket = socket;
    this.setStatus(status);

    socket.addEventListener('open', (event) => {
      this.reconnectDelayMs = this.initialReconnectDelayMs;
      this.setStatus('open');
      this.emit('open', event);
    });

    socket.addEventListener('close', (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }
      if (
        !this.intentionalDisconnect &&
        this.connectionParams !== null &&
        shouldReconnectAfterClose(event)
      ) {
        this.scheduleReconnect();
      } else {
        this.setStatus('closed');
      }
      this.emit('close', event);
    });

    socket.addEventListener('error', (event) => {
      this.setStatus('error');
      this.emit('error', event);
    });

    socket.addEventListener('message', (event) => {
      const message = this.parseMessage(event.data);
      if (message) {
        this.emit('message', message);
      }
    });
  }

  disconnect(code?: number, reason?: string): void {
    this.intentionalDisconnect = true;
    this.connectionParams = null;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.socket) {
      this.setStatus('closed');
      return;
    }

    this.socket.close(code, reason);
  }

  send(message: ClientToServerMessage): void {
    if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) {
      throw new Error('Protocol WebSocket is not open.');
    }

    this.socket.send(JSON.stringify(message));
  }

  updateRecoveryOffsets(offsets: RecoveryOffsets): void {
    if (this.connectionParams === null) {
      return;
    }
    this.connectionParams = {
      ...this.connectionParams,
      last_output_offset: offsets.lastOutputOffset ?? this.connectionParams.last_output_offset,
      last_input_offset: offsets.lastInputOffset ?? this.connectionParams.last_input_offset
    };
  }

  sendInput(params: {
    instanceId: ClaudeInstanceId;
    inputId: InputMessageId;
    inputOffset: number;
    payload: string;
  }): void {
    const message: InputMessagePayload = {
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: params.instanceId,
      input_id: params.inputId,
      input_offset: params.inputOffset,
      payload: params.payload
    };

    this.send(message);
  }

  acknowledgeOutput(instanceId: ClaudeInstanceId, offset: number): void {
    const message: AckOutputMessagePayload = {
      type: CLIENT_MESSAGE_TYPES.ACK_OUTPUT,
      instance_id: instanceId,
      offset
    };

    this.send(message);
  }

  heartbeat(sentAt: string = new Date().toISOString()): void {
    const message: HeartbeatMessagePayload = {
      type: CLIENT_MESSAGE_TYPES.HEARTBEAT,
      sent_at: sentAt
    };

    this.send(message);
  }

  on<TEvent extends ProtocolClientEvent>(
    event: TEvent,
    listener: ProtocolClientListener<TEvent>
  ): () => void {
    this.listeners[event].add(listener);
    return () => this.off(event, listener);
  }

  off<TEvent extends ProtocolClientEvent>(
    event: TEvent,
    listener: ProtocolClientListener<TEvent>
  ): void {
    this.listeners[event].delete(listener);
  }

  private buildUrl(params: WebSocketConnectionParams): string {
    const url = new URL(this.url);
    url.searchParams.set('device_id', params.device_id);
    url.searchParams.set('access_token', params.access_token);
    url.searchParams.set('instance_id', params.instance_id satisfies ClaudeInstanceId);
    url.searchParams.set('last_output_offset', String(params.last_output_offset));
    url.searchParams.set('last_input_offset', String(params.last_input_offset));
    return url.toString();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.connectionParams === null) {
      return;
    }

    this.setStatus('reconnecting');
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.maxReconnectDelayMs);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.connectionParams !== null) {
        this.openSocket(this.connectionParams, 'reconnecting');
      }
    }, delay);
  }

  private parseMessage(data: unknown): ServerToClientMessage | null {
    try {
      return JSON.parse(String(data)) as ServerToClientMessage;
    } catch {
      this.emit('error', {
        code: 'INVALID_MESSAGE',
        message: 'Received invalid JSON from protocol WebSocket.',
        retryable: false
      });
      return null;
    }
  }

  private setStatus(status: ProtocolClientStatus): void {
    this.statusValue = status;
    this.emit('status', status);
  }

  private emit<TEvent extends ProtocolClientEvent>(
    event: TEvent,
    payload: ProtocolClientEventMap[TEvent]
  ): void {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }
}
