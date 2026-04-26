import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import { Terminal } from "xterm";

import { SERVER_MESSAGE_TYPES, type ConnectionState } from "../../../shared/protocol/messages.js";
import type { ClaudeInstanceId, DeviceId, InputMessageId } from "../../../shared/protocol/domain.js";
import { ConnectionStatus, type DisplayConnectionState } from "../components/ConnectionStatus.js";
import { OfflineInputConfirm } from "../components/OfflineInputConfirm.js";
import { TerminalSearch } from "../components/TerminalSearch.js";
import { appendTerminalOutput, type TerminalOutputState } from "./outputRenderer.js";
import { calculateTerminalScale } from "./scaling.js";
import type { ProtocolClient, ProtocolClientStatus } from "../protocol/client.js";
import type { DeviceCredentials } from "../protocol/device-credentials.js";
import { createInputRecoveryClient, type InputRecoveryClient, type PendingInput } from "../protocol/input-client.js";
import { loadLastOutputOffset, saveLastOutputOffset } from "../protocol/reconnect.js";

export interface TerminalViewProps {
  readonly client: ProtocolClient;
  readonly credentials: DeviceCredentials | null;
  readonly instanceId: ClaudeInstanceId;
}

function createInputId(deviceId: DeviceId): InputMessageId {
  return `${deviceId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function TerminalView({ client, credentials, instanceId }: TerminalViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fallbackBufferRef = useRef("");
  const outputStateRef = useRef<TerminalOutputState>({ text: "", scrollOffset: 0, maxLength: 1_000_000 });
  const inputClientRef = useRef<InputRecoveryClient | null>(null);
  const [status, setStatus] = useState<ProtocolClientStatus>(client.status);
  const [connectionState, setConnectionState] = useState<DisplayConnectionState>(client.status);
  const [notice, setNotice] = useState("等待连接。");
  const [fallbackInput, setFallbackInput] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalScale, setTerminalScale] = useState(calculateTerminalScale({ containerWidth: 960, characterWidth: 8 }));
  const [pendingInputs, setPendingInputs] = useState<PendingInput[]>([]);

  useEffect(() => client.on("status", (nextStatus) => {
    setStatus(nextStatus);
    setConnectionState(nextStatus === "closed" && status === "open" ? "reconnecting" : nextStatus);
    inputClientRef.current?.setOnline(nextStatus === "open");
    setPendingInputs(inputClientRef.current?.pending() ?? []);
  }), [client, status]);

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }

    const measuredWidth = containerRef.current.clientWidth || 960;
    const nextScale = calculateTerminalScale({ containerWidth: measuredWidth, characterWidth: 8 });
    setTerminalScale(nextScale);

    const terminal = new Terminal({ cols: nextScale.columns, rows: 30, convertEol: true });
    terminal.open(containerRef.current);
    terminalRef.current = terminal;

    const inputDispose = terminal.onData((payload) => {
      if (credentials !== null) {
        inputClientRef.current?.send(payload);
        setPendingInputs(inputClientRef.current?.pending() ?? []);
      }
    });

    return () => {
      inputDispose.dispose();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [client, credentials, instanceId]);

  useEffect(() => {
    if (credentials === null) {
      inputClientRef.current = null;
      setPendingInputs([]);
      return;
    }

    inputClientRef.current = createInputRecoveryClient({
      deviceId: credentials.device_id,
      instanceId,
      transport: client,
      createInputId: () => createInputId(credentials.device_id),
    });
    setPendingInputs([]);
  }, [client, credentials, instanceId]);

  useEffect(() => {
    const unsubscribe = client.on("message", (message) => {
      switch (message.type) {
        case SERVER_MESSAGE_TYPES.HELLO:
          setNotice(`已连接，服务端输出偏移：${message.next_output_offset}`);
          break;
        case SERVER_MESSAGE_TYPES.OUTPUT: {
          outputStateRef.current = appendTerminalOutput(outputStateRef.current, message, terminalRef.current);
          fallbackBufferRef.current = outputStateRef.current.text;
          setTerminalOutput(outputStateRef.current.text);
          const nextOffset = message.offset + message.data.length;
          saveLastOutputOffset(message.instance_id, nextOffset);
          client.acknowledgeOutput(message.instance_id, nextOffset);
          break;
        }
        case SERVER_MESSAGE_TYPES.OUTPUT_GAP:
          saveLastOutputOffset(message.instance_id, message.available_from_offset);
          setNotice(
            `输出缓冲已过期，请求偏移 ${message.requested_offset}，将从 ${message.available_from_offset} 继续。`,
          );
          break;
        case SERVER_MESSAGE_TYPES.CONNECTION_STATE:
          setConnectionState(message.state as ConnectionState);
          setNotice(`连接状态：${message.state}`);
          break;
        case SERVER_MESSAGE_TYPES.INPUT_ACK:
          inputClientRef.current?.handleAck(message);
          setPendingInputs(inputClientRef.current?.pending() ?? []);
          break;
        case SERVER_MESSAGE_TYPES.ERROR:
          setNotice(`${message.code}: ${message.message}`);
          break;
      }
    });

    return unsubscribe;
  }, [client]);

  useEffect(() => {
    if (credentials === null) {
      setNotice("请先完成设备配对。");
      return;
    }

    client.connect({
      device_id: credentials.device_id,
      access_token: credentials.access_token,
      instance_id: instanceId,
      last_output_offset: loadLastOutputOffset(instanceId),
    });

    return () => client.disconnect(1000, "terminal view unmounted");
  }, [client, credentials, instanceId]);

  function handleFallbackKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || credentials === null || client.status !== "open") {
      return;
    }

    event.preventDefault();
    const payload = `${fallbackInput}\n`;
    inputClientRef.current?.send(payload);
    setPendingInputs(inputClientRef.current?.pending() ?? []);
    setFallbackInput("");
  }

  function handleConfirmOfflineInput(): void {
    inputClientRef.current?.confirmReplay();
    setPendingInputs(inputClientRef.current?.pending() ?? []);
  }

  return (
    <section aria-label="远程终端">
      <p>连接状态：{status}</p>
      <ConnectionStatus state={connectionState} />
      <OfflineInputConfirm pendingInputs={pendingInputs} onConfirm={handleConfirmOfflineInput} />
      <TerminalSearch output={terminalOutput} />
      <p>{notice}</p>
      <div
        ref={containerRef}
        role="terminal"
        style={{ minHeight: "24rem", transform: `scale(${terminalScale.scale})`, transformOrigin: "top left", width: `${terminalScale.contentWidth}px` }}
      />
      <label>
        输入备用区
        <textarea
          onChange={(event) => setFallbackInput(event.target.value)}
          onKeyDown={handleFallbackKeyDown}
          placeholder="如果终端控件不可用，可在此输入并按 Enter 发送。"
          value={fallbackInput}
        />
      </label>
      <pre aria-label="终端输出备用区">{terminalOutput}</pre>
    </section>
  );
}
