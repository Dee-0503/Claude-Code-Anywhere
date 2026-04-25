import type {
  ClaudeInstanceId,
  OutputBuffer,
  OutputChunk,
} from "../../../shared/protocol/domain.js";

export interface AppendOutputResult {
  readonly chunk: OutputChunk;
  readonly buffer: OutputBuffer;
}

function trimUtf8Bytes(data: string, bytesToDrop: number): string {
  if (bytesToDrop <= 0) {
    return data;
  }

  return Buffer.from(data, "utf8").subarray(bytesToDrop).toString("utf8");
}

export class BoundedOutputBuffer {
  private readonly chunks: OutputChunk[] = [];
  private baseOffset = 0;
  private nextOffset = 0;
  private sizeBytes = 0;

  constructor(
    private readonly instanceId: ClaudeInstanceId,
    private readonly capacityBytes: number,
  ) {
    if (!Number.isInteger(capacityBytes) || capacityBytes < 1) {
      throw new Error("Output buffer capacity must be a positive integer");
    }
  }

  get snapshot(): OutputBuffer {
    return {
      instanceId: this.instanceId,
      baseOffset: this.baseOffset,
      nextOffset: this.nextOffset,
      capacityBytes: this.capacityBytes,
      chunks: [...this.chunks],
    };
  }

  append(data: string, now = new Date()): AppendOutputResult {
    const byteLength = Buffer.byteLength(data, "utf8");
    const offset = this.nextOffset;
    const nextOffset = offset + byteLength;
    const chunk: OutputChunk = {
      instanceId: this.instanceId,
      offset,
      nextOffset,
      data,
      createdAt: now.toISOString(),
    };

    this.chunks.push(chunk);
    this.sizeBytes += byteLength;
    this.nextOffset = nextOffset;
    this.evictOverflow();

    return { chunk, buffer: this.snapshot };
  }

  replayFrom(offset: number): OutputChunk[] | null {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error("Replay offset must be a non-negative integer");
    }

    if (offset < this.baseOffset) {
      return null;
    }

    return this.chunks
      .filter((chunk) => chunk.nextOffset > offset)
      .map((chunk) => {
        if (chunk.offset >= offset) {
          return chunk;
        }

        const data = trimUtf8Bytes(chunk.data, offset - chunk.offset);
        return {
          ...chunk,
          offset,
          data,
        };
      });
  }

  clear(): void {
    this.chunks.length = 0;
    this.baseOffset = this.nextOffset;
    this.sizeBytes = 0;
  }

  private evictOverflow(): void {
    while (this.sizeBytes > this.capacityBytes && this.chunks.length > 0) {
      const removed = this.chunks.shift();
      if (removed === undefined) {
        return;
      }

      this.sizeBytes -= Buffer.byteLength(removed.data, "utf8");
      this.baseOffset = removed.nextOffset;
    }
  }
}
