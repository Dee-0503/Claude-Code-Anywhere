import { SERVER_MESSAGE_TYPES, type OutputGapMessagePayload, type OutputMessagePayload } from "../../../shared/protocol/messages.js";
import type { BoundedOutputBuffer } from "./output-buffer.js";

export type ReplayMessage = OutputMessagePayload | OutputGapMessagePayload;

export function replayOutput(buffer: BoundedOutputBuffer, requestedOffset: number): ReplayMessage[] {
  const snapshot = buffer.snapshot;
  const chunks = buffer.replayFrom(requestedOffset);

  if (chunks === null) {
    return [
      {
        type: SERVER_MESSAGE_TYPES.OUTPUT_GAP,
        instance_id: snapshot.instanceId,
        requested_offset: requestedOffset,
        available_from_offset: snapshot.baseOffset,
      },
    ];
  }

  if (chunks.length === 0 && requestedOffset > snapshot.baseOffset && requestedOffset < snapshot.nextOffset) {
    const retainedData = snapshot.chunks.map((chunk) => chunk.data).join("");
    if (retainedData.length > 0) {
      return [
        {
          type: SERVER_MESSAGE_TYPES.OUTPUT,
          instance_id: snapshot.instanceId,
          offset: requestedOffset,
          data: retainedData,
        },
      ];
    }
  }

  return chunks.map((chunk) => ({
    type: SERVER_MESSAGE_TYPES.OUTPUT,
    instance_id: chunk.instanceId,
    offset: chunk.offset,
    data: chunk.data,
  }));
}

export function createReplayService(bufferForInstance: (instanceId: string) => BoundedOutputBuffer) {
  return {
    replay(instanceId: string, requestedOffset: number): ReplayMessage[] {
      return replayOutput(bufferForInstance(instanceId), requestedOffset);
    },
  };
}
