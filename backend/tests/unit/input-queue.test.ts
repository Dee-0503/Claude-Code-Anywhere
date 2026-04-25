import { describe, expect, it } from "vitest";

import { INPUT_ACK_STATUSES } from "../../../shared/protocol/messages.js";
import { createInputQueue } from "../../src/sessions/input-queue.js";

describe("input queue", () => {
  it("accepts unique inputs in FIFO order", () => {
    const queue = createInputQueue({ now: () => new Date("2026-04-25T12:00:00.000Z") });

    expect(queue.enqueue({
      id: "input-1",
      instanceId: "instance-id",
      deviceId: "device-id",
      payload: "first",
    }).status).toBe(INPUT_ACK_STATUSES.ACCEPTED);
    expect(queue.enqueue({
      id: "input-2",
      instanceId: "instance-id",
      deviceId: "device-id",
      payload: "second",
    }).status).toBe(INPUT_ACK_STATUSES.ACCEPTED);

    expect(queue.drainReady("instance-id").map((message) => message.payload)).toEqual([
      "first",
      "second",
    ]);
  });

  it("acknowledges duplicate input IDs without queuing duplicate PTY injections", () => {
    const queue = createInputQueue({ now: () => new Date("2026-04-25T12:00:00.000Z") });

    expect(queue.enqueue({
      id: "input-1",
      instanceId: "instance-id",
      deviceId: "device-id",
      payload: "npm test\n",
    }).status).toBe(INPUT_ACK_STATUSES.ACCEPTED);
    expect(queue.enqueue({
      id: "input-1",
      instanceId: "instance-id",
      deviceId: "device-id",
      payload: "npm test\n",
    }).status).toBe(INPUT_ACK_STATUSES.DUPLICATE);

    expect(queue.drainReady("instance-id")).toHaveLength(1);
    expect(queue.drainReady("instance-id")).toHaveLength(0);
  });

  it("does not request reconnect confirmation for input already injected into the PTY", () => {
    const queue = createInputQueue({ now: () => new Date("2026-04-25T12:00:00.000Z") });

    queue.enqueue({
      id: "input-1",
      instanceId: "instance-id",
      deviceId: "device-id",
      payload: "npm test\n",
    });
    queue.drainReady("instance-id");

    expect(queue.listPendingConfirmations("instance-id")).toEqual([]);
  });

  it("requests reconnect confirmation only for queued input that was not injected", () => {
    const queue = createInputQueue({ now: () => new Date("2026-04-25T12:00:00.000Z") });

    queue.enqueue({
      id: "input-1",
      instanceId: "instance-id",
      deviceId: "device-id",
      payload: "npm test\n",
    });

    expect(queue.listPendingConfirmations("instance-id")).toEqual([
      expect.objectContaining({
        id: "input-1",
        payload: "npm test\n",
        status: "queued",
      }),
    ]);
  });
});
