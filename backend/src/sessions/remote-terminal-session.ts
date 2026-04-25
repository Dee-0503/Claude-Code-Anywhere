import type { DeviceId } from "../../../shared/protocol/domain.js";
import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES, type ClientToServerMessage, type HelloMessagePayload, type ServerToClientMessage } from "../../../shared/protocol/messages.js";
import { createBootstrapPairingService, type BootstrapPairingService } from "../auth/pairing-service.js";
import { createConnectionStateTracker } from "../api/connection-state.js";
import { createInputQueue } from "./input-queue.js";
import { injectReadyInput } from "./input-stream.js";
import { BoundedOutputBuffer } from "./output-buffer.js";
import { createPresenceService } from "./presence-service.js";
import { replayOutput } from "./replay-service.js";

interface HarnessOptions {
  readonly auth?: BootstrapPairingService;
  readonly now?: () => Date;
  readonly outputBufferBytes?: number;
  readonly ptyScript?: readonly string[];
}

interface AttachTerminalInput {
  readonly device_id: string;
  readonly access_token: string;
  readonly cwd?: string;
  readonly instance_id?: string;
  readonly last_output_offset: number;
}

class ScriptedPtyHarness {
  private readonly writers = new Map<string, (data: string) => void>();
  private readonly inputsByInstance = new Map<string, string[]>();

  register(instanceId: string, writer: (data: string) => void): void {
    this.writers.set(instanceId, writer);
  }

  async write(instanceId: string, data: string): Promise<void> {
    const writer = this.writers.get(instanceId);
    if (writer === undefined) {
      throw new Error(`Unknown instance: ${instanceId}`);
    }
    writer(data);
  }

  process(instanceId: string) {
    return {
      write: (data: string) => {
        const inputs = this.inputsByInstance.get(instanceId) ?? [];
        inputs.push(data);
        this.inputsByInstance.set(instanceId, inputs);
      },
    };
  }

  inputs(instanceId: string): string[] {
    return [...(this.inputsByInstance.get(instanceId) ?? [])];
  }
}

export async function createRemoteTerminalSessionHarness(options: HarnessOptions = {}) {
  const auth = options.auth ?? createBootstrapPairingService(
    options.now === undefined ? {} : { now: options.now },
  );
  const pty = new ScriptedPtyHarness();
  const sessions = createHarnessSessionService(auth, pty, options);

  return { auth, sessions, pty };
}

function createHarnessSessionService(
  auth: BootstrapPairingService,
  pty: ScriptedPtyHarness,
  options: HarnessOptions,
) {
  const buffers = new Map<string, BoundedOutputBuffer>();
  const deviceInstances = new Map<DeviceId, string>();
  const seenInstances = new Set<string>();
  const latestByInstance = new Map<string, string>();
  const instanceNames = new Map<string, string>();
  const stoppedInstances = new Set<string>();
  const capacity = options.outputBufferBytes ?? 1024 * 1024;
  const inputQueue = createInputQueue(
    options.now === undefined ? {} : { now: options.now },
  );
  const presence = createPresenceService();
  const interruptConfirmationsByInstance = new Map<string, Array<{ inputId: string; deviceId: string }>>();

  function getBuffer(instanceId: string): BoundedOutputBuffer {
    let buffer = buffers.get(instanceId);
    if (buffer === undefined) {
      buffer = new BoundedOutputBuffer(instanceId, capacity);
      buffers.set(instanceId, buffer);
    }
    return buffer;
  }

  return {
    async createInstance(input: { readonly device_id: string; readonly access_token: string; readonly name: string; readonly cwd: string }) {
      await auth.verifyDeviceToken({ device_id: input.device_id, access_token: input.access_token });
      const instanceId = crypto.randomUUID();
      deviceInstances.set(input.device_id, instanceId);
      instanceNames.set(instanceId, input.name);
      getBuffer(instanceId);
      seenInstances.add(instanceId);
      return {
        id: instanceId,
        name: input.name,
        status: "running",
        cwd: input.cwd,
      };
    },
    listInstances() {
      return [...buffers.keys()].map((instanceId) => ({
        id: instanceId,
        name: instanceNames.get(instanceId) ?? instanceId,
        status: stoppedInstances.has(instanceId) ? "exited" : "running",
      }));
    },
    async stopInstance(input: { readonly device_id: string; readonly access_token: string; readonly instance_id: string }) {
      await auth.verifyDeviceToken({ device_id: input.device_id, access_token: input.access_token });
      stoppedInstances.add(input.instance_id);
      return {
        id: input.instance_id,
        status: "exited",
      };
    },
    async attachTerminal(input: AttachTerminalInput) {
      await auth.verifyDeviceToken({ device_id: input.device_id, access_token: input.access_token });
      const instanceId = input.instance_id ?? deviceInstances.get(input.device_id) ?? crypto.randomUUID();
      instanceNames.set(instanceId, instanceNames.get(instanceId) ?? "Claude Code");
      deviceInstances.set(input.device_id, instanceId);

      const buffer = getBuffer(instanceId);
      const connectionState = createConnectionStateTracker({
        degradedAfterMs: 1_000,
        disconnectedAfterMs: 3_000,
        ...(options.now === undefined ? {} : { now: options.now }),
      });
      const messages: ServerToClientMessage[] = [];
      pty.register(instanceId, (data) => {
        latestByInstance.set(instanceId, data);
        const { chunk } = buffer.append(data, options.now?.() ?? new Date());
        messages.push({
          type: SERVER_MESSAGE_TYPES.OUTPUT,
          instance_id: chunk.instanceId,
          offset: chunk.offset,
          data: chunk.data,
        });
      });
      const firstMessage: HelloMessagePayload = {
        type: SERVER_MESSAGE_TYPES.HELLO,
        server_id: "local-server-id",
        instance_id: instanceId,
        connection_id: crypto.randomUUID(),
        next_output_offset: buffer.snapshot.nextOffset,
      };
      presence.join({
        connectionId: firstMessage.connection_id,
        deviceId: input.device_id,
        instanceId,
      });

      if (!seenInstances.has(instanceId)) {
        seenInstances.add(instanceId);
        for (const chunk of options.ptyScript ?? []) {
          await pty.write(instanceId, chunk);
        }
      }

      const replayMessages = replayOutput(buffer, input.last_output_offset);
      const shouldSuppressEmptyInitialReplay =
        replayMessages.length === 0 ||
        (replayMessages.length === 1 &&
          replayMessages[0]?.type === SERVER_MESSAGE_TYPES.OUTPUT_GAP &&
          replayMessages[0].requested_offset === 0 &&
          replayMessages[0].available_from_offset === 0);
      if (!shouldSuppressEmptyInitialReplay) {
        messages.push(...replayMessages);
      }
      const replayNow = () => {
        const latestReplay = replayOutput(buffer, input.last_output_offset);
        const latestData = latestByInstance.get(instanceId);
        const nonOutputMessages = messages.filter((message) => message.type !== SERVER_MESSAGE_TYPES.OUTPUT && message.type !== SERVER_MESSAGE_TYPES.OUTPUT_GAP);
        if (latestData !== undefined && latestReplay.length === 0) {
          messages.splice(0, messages.length, {
            type: SERVER_MESSAGE_TYPES.OUTPUT,
            instance_id: instanceId,
            offset: input.last_output_offset,
            data: latestData,
          }, ...nonOutputMessages);
        } else if (latestReplay.length > 0) {
          messages.splice(0, messages.length, ...latestReplay, ...nonOutputMessages);
        }
        return messages;
      };

      return {
        firstMessage,
        get messages() {
          return replayNow();
        },
        get nextOutputOffset() {
          return buffer.snapshot.nextOffset;
        },
        async send(message: ClientToServerMessage) {
          if (message.type === CLIENT_MESSAGE_TYPES.ACK_OUTPUT) {
            return;
          }
          if (message.type === CLIENT_MESSAGE_TYPES.INPUT) {
            const result = inputQueue.enqueue({
              id: message.input_id,
              instanceId: message.instance_id,
              deviceId: input.device_id,
              payload: message.payload,
            });
            if (inputQueue.classify(message.payload) === "interrupt") {
              const confirmations = interruptConfirmationsByInstance.get(message.instance_id) ?? [];
              confirmations.push({ inputId: message.input_id, deviceId: input.device_id });
              interruptConfirmationsByInstance.set(message.instance_id, confirmations);
            }
            messages.push({
              type: SERVER_MESSAGE_TYPES.INPUT_ACK,
              instance_id: message.instance_id,
              input_id: message.input_id,
              status: result.status,
            });
            injectReadyInput({
              instanceId: message.instance_id,
              queue: inputQueue,
              process: pty.process(message.instance_id),
            });
          }
          if (message.type === CLIENT_MESSAGE_TYPES.HEARTBEAT) {
            messages.push(connectionState.markHeartbeat(new Date(message.sent_at)));
          }
        },
        markHeartbeat(at: Date) {
          return connectionState.markHeartbeat(at);
        },
        evaluateConnection(at: Date) {
          const state = connectionState.evaluate(at);
          messages.push(state);
          return state;
        },
        pendingInputConfirmations() {
          return inputQueue.listPendingConfirmations(instanceId);
        },
        queuedInputs() {
          return inputQueue.listQueuedInputs(instanceId);
        },
        cancelQueuedInput(inputId: string) {
          return inputQueue.cancel(instanceId, inputId);
        },
        interruptConfirmations() {
          return [...(interruptConfirmationsByInstance.get(instanceId) ?? [])];
        },
        presence() {
          return presence.list(instanceId);
        },
        async queueDisconnectedInput(inputMessage: { input_id: string; payload: string }) {
          inputQueue.enqueue({
            id: inputMessage.input_id,
            instanceId,
            deviceId: input.device_id,
            payload: inputMessage.payload,
          });
        },
        async confirmPendingInput(inputIds: readonly string[]) {
          const confirmed = inputQueue.confirmPending(instanceId, inputIds);
          for (const message of confirmed) {
            pty.process(instanceId).write(message.payload);
          }
        },
        async close() {
          presence.leave(firstMessage.connection_id);
          return;
        },
      };
    },
  };
}
