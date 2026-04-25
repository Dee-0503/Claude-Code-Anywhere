import type { DeviceId } from "../../../shared/protocol/domain.js";
import { CLIENT_MESSAGE_TYPES, INPUT_ACK_STATUSES, SERVER_MESSAGE_TYPES, type ClientToServerMessage, type HelloMessagePayload, type ServerToClientMessage } from "../../../shared/protocol/messages.js";
import { createBootstrapPairingService, type BootstrapPairingService } from "../auth/pairing-service.js";
import { BoundedOutputBuffer } from "./output-buffer.js";
import { replayOutput } from "./replay-service.js";

interface HarnessOptions {
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
}

export async function createRemoteTerminalSessionHarness(options: HarnessOptions = {}) {
  const auth = createBootstrapPairingService(
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
  const capacity = options.outputBufferBytes ?? 1024 * 1024;

  function getBuffer(instanceId: string): BoundedOutputBuffer {
    let buffer = buffers.get(instanceId);
    if (buffer === undefined) {
      buffer = new BoundedOutputBuffer(instanceId, capacity);
      buffers.set(instanceId, buffer);
    }
    return buffer;
  }

  return {
    async attachTerminal(input: AttachTerminalInput) {
      await auth.verifyDeviceToken({ device_id: input.device_id, access_token: input.access_token });
      const instanceId = input.instance_id ?? deviceInstances.get(input.device_id) ?? crypto.randomUUID();
      deviceInstances.set(input.device_id, instanceId);

      const buffer = getBuffer(instanceId);
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
        if (latestData !== undefined && latestReplay.length === 0) {
          messages.splice(0, messages.length, {
            type: SERVER_MESSAGE_TYPES.OUTPUT,
            instance_id: instanceId,
            offset: input.last_output_offset,
            data: latestData,
          });
        } else if (latestReplay.length > 0) {
          messages.splice(0, messages.length, ...latestReplay);
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
            messages.push({
              type: SERVER_MESSAGE_TYPES.INPUT_ACK,
              instance_id: message.instance_id,
              input_id: message.input_id,
              status: INPUT_ACK_STATUSES.ACCEPTED,
            });
          }
        },
        async close() {
          return;
        },
      };
    },
  };
}
