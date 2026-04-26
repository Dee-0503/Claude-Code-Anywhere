import { describe, expect, it } from "vitest";

import { SERVER_MESSAGE_TYPES } from "../../../shared/protocol/messages.js";
import { BoundedOutputBuffer } from "../../src/sessions/output-buffer.js";
import { createOutputStream } from "../../src/sessions/output-stream.js";

const INSTANCE_ID = "instance-id";
const MB = 1024 * 1024;

describe("output streaming performance boundaries", () => {
  it("retains only the latest 1MB window while preserving monotonic offsets", () => {
    const buffer = new BoundedOutputBuffer(INSTANCE_ID, MB);
    const chunk = "x".repeat(16 * 1024);

    for (let index = 0; index < 80; index += 1) {
      buffer.append(chunk, new Date("2026-04-25T12:00:00.000Z"));
    }

    const snapshot = buffer.snapshot;
    const retainedBytes = snapshot.chunks.reduce((total, item) => total + Buffer.byteLength(item.data, "utf8"), 0);

    expect(snapshot.nextOffset).toBe(80 * chunk.length);
    expect(snapshot.baseOffset).toBe(snapshot.nextOffset - MB);
    expect(retainedBytes).toBeLessThanOrEqual(MB);
    expect(snapshot.chunks[0]?.offset).toBe(snapshot.baseOffset);
    expect(buffer.replayFrom(0)).toBeNull();
    expect(buffer.replayFrom(snapshot.baseOffset)).toHaveLength(64);
  });

  it("broadcasts streamed chunks in order and stops sending to unsubscribed sinks", () => {
    const buffer = new BoundedOutputBuffer(INSTANCE_ID, MB);
    const stream = createOutputStream(buffer);
    const firstSink: string[] = [];
    const secondSink: string[] = [];
    const unsubscribeFirst = stream.subscribe((message) => firstSink.push(`${message.offset}:${message.data}`));
    stream.subscribe((message) => secondSink.push(`${message.offset}:${message.data}`));

    const first = stream.append("alpha", new Date("2026-04-25T12:00:00.000Z"));
    unsubscribeFirst();
    const second = stream.append("beta", new Date("2026-04-25T12:00:01.000Z"));

    expect(first).toEqual({
      type: SERVER_MESSAGE_TYPES.OUTPUT,
      instance_id: INSTANCE_ID,
      offset: 0,
      data: "alpha",
    });
    expect(second).toEqual({
      type: SERVER_MESSAGE_TYPES.OUTPUT,
      instance_id: INSTANCE_ID,
      offset: 5,
      data: "beta",
    });
    expect(firstSink).toEqual(["0:alpha"]);
    expect(secondSink).toEqual(["0:alpha", "5:beta"]);
  });
});
