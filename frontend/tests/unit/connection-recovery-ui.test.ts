import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProtocolClient, shouldReconnectAfterClose } from "../../src/protocol/client.js";
import { renderConnectionStatus } from "../../src/components/ConnectionStatus.js";
import { renderNotificationCenter } from "../../src/components/NotificationCenter.js";
import { renderOfflineInputConfirm } from "../../src/components/OfflineInputConfirm.js";
import { renderAuthorizationPrompt } from "../../src/components/AuthorizationPrompt.js";

describe("connection recovery UI helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders degraded, disconnected, and reconnecting states", () => {
    expect(renderConnectionStatus("degraded")).toContain("网络较弱");
    expect(renderConnectionStatus("disconnected")).toContain("连接已断开");
    expect(renderConnectionStatus("reconnecting")).toContain("正在重连");
  });

  it("describes pending offline input before replay", () => {
    expect(renderOfflineInputConfirm([
      { inputId: "input-1", payload: "npm test\n" },
      { inputId: "input-2", payload: "git status\n" },
    ])).toContain("2 条离线输入等待确认");
  });

  it("summarizes unread routed notifications", () => {
    expect(renderNotificationCenter([
      { id: "notice-1", title: "需要授权", priority: "urgent", status: "delivered" },
      { id: "notice-2", title: "任务完成", priority: "normal", status: "read" },
    ])).toContain("1 条未读通知");
  });

  it("classifies retryable and non-retryable websocket close codes", () => {
    expect(shouldReconnectAfterClose({ code: 1006, wasClean: false })).toBe(true);
    expect(shouldReconnectAfterClose({ code: 1011, wasClean: false })).toBe(true);
    expect(shouldReconnectAfterClose({ code: 1000, wasClean: true })).toBe(false);
    expect(shouldReconnectAfterClose({ code: 1002, wasClean: true })).toBe(false);
    expect(shouldReconnectAfterClose({ code: 1008, wasClean: true })).toBe(false);
    expect(shouldReconnectAfterClose({ code: 4001, wasClean: true })).toBe(false);
  });

  it("reconnects retryable closes with bounded backoff and latest offsets", () => {
    const sockets: FakeWebSocket[] = [];
    class FakeWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly sent: string[] = [];
      readonly listeners = new Map<string, Array<(event: Event) => void>>();
      readyState = FakeWebSocket.CONNECTING;
      url: string;

      constructor(url: string) {
        this.url = url;
        sockets.push(this);
      }

      addEventListener(event: string, listener: (event: Event) => void): void {
        this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
      }

      close(code?: number, reason?: string): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.dispatch("close", { code: code ?? 1000, reason: reason ?? "", wasClean: true } as CloseEvent);
      }

      send(data: string): void {
        this.sent.push(data);
      }

      dispatch(event: string, payload: Event): void {
        for (const listener of this.listeners.get(event) ?? []) {
          listener(payload);
        }
      }
    }

    const client = new ProtocolClient({
      url: "wss://terminal.example/ws",
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: { initialDelayMs: 10, maxDelayMs: 20 },
    });
    const statuses: string[] = [];
    client.on("status", (status) => statuses.push(status));

    client.connect({ device_id: "device-id", access_token: "token", instance_id: "instance-id", last_output_offset: 3, last_input_offset: 0 });
    sockets[0]!.readyState = FakeWebSocket.OPEN;
    sockets[0]!.dispatch("open", new Event("open"));
    client.updateRecoveryOffsets({ lastOutputOffset: 9, lastInputOffset: 4 });
    sockets[0]!.readyState = FakeWebSocket.CLOSED;
    sockets[0]!.dispatch("close", { code: 1006, reason: "", wasClean: false } as CloseEvent);

    expect(statuses).toContain("reconnecting");
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(10);

    expect(sockets).toHaveLength(2);
    const reconnectUrl = new URL(sockets[1]!.url);
    expect(reconnectUrl.searchParams.get("last_output_offset")).toBe("9");
    expect(reconnectUrl.searchParams.get("last_input_offset")).toBe("4");
  });

  it("coalesces repeated retryable closes into one reconnect attempt", () => {
    const sockets: FakeWebSocket[] = [];
    class FakeWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly listeners = new Map<string, Array<(event: Event) => void>>();
      readyState = FakeWebSocket.CONNECTING;
      url: string;

      constructor(url: string) {
        this.url = url;
        sockets.push(this);
      }

      addEventListener(event: string, listener: (event: Event) => void): void {
        this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
      }

      close(): void {
        this.readyState = FakeWebSocket.CLOSED;
      }

      send(): void {}

      dispatch(event: string, payload: Event): void {
        for (const listener of this.listeners.get(event) ?? []) {
          listener(payload);
        }
      }
    }

    const client = new ProtocolClient({
      url: "wss://terminal.example/ws",
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: { initialDelayMs: 10, maxDelayMs: 20 },
    });

    client.connect({ device_id: "device-id", access_token: "token", instance_id: "instance-id", last_output_offset: 3, last_input_offset: 0 });
    sockets[0]!.readyState = FakeWebSocket.CLOSED;
    const retryableClose = { code: 1006, reason: "", wasClean: false } as CloseEvent;
    sockets[0]!.dispatch("close", retryableClose);
    sockets[0]!.dispatch("close", retryableClose);

    vi.advanceTimersByTime(10);

    expect(sockets).toHaveLength(2);
  });

  it("describes authorization prompts as terminal-native decisions", () => {
    expect(renderAuthorizationPrompt({
      title: "允许命令？",
      body: "Claude Code 请求运行 npm test",
      status: "waiting",
    })).toContain("请在终端原生审批提示中操作");
  });
});
