import {
  SERVER_MESSAGE_TYPES,
  type OutputMessagePayload
} from '../../../shared/protocol/messages.js';
import type { BoundedOutputBuffer } from './output-buffer.js';

export type OutputSink = (message: OutputMessagePayload) => void;

export class OutputStream {
  private readonly sinks = new Set<OutputSink>();

  constructor(private readonly buffer: BoundedOutputBuffer) {}

  subscribe(sink: OutputSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  append(data: string, now = new Date()): OutputMessagePayload {
    const { chunk } = this.buffer.append(data, now);
    const message: OutputMessagePayload = {
      type: SERVER_MESSAGE_TYPES.OUTPUT,
      instance_id: chunk.instanceId,
      offset: chunk.offset,
      data: chunk.data
    };

    for (const sink of this.sinks) {
      sink(message);
    }

    return message;
  }
}

export function createOutputStream(buffer: BoundedOutputBuffer): OutputStream {
  return new OutputStream(buffer);
}
