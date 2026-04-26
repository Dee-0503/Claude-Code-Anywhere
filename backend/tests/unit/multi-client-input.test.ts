import { describe, expect, it } from "vitest";

import { INPUT_ACK_STATUSES } from "../../../shared/protocol/messages.js";
import { createInputQueue } from "../../src/sessions/input-queue.js";

describe("multi-client input queue", () => {
  it("drains queued input from multiple clients in FIFO order", () => {
    const queue = createInputQueue({ now: () => new Date("2026-04-25T12:00:00.000Z") });

    queue.enqueue({ id: "mac-1", instanceId: "instance-id", deviceId: "mac", payload: "first\n" });
    queue.enqueue({ id: "phone-1", instanceId: "instance-id", deviceId: "phone", payload: "second\n" });
    queue.enqueue({ id: "mac-2", instanceId: "instance-id", deviceId: "mac", payload: "third\n" });

    expect(queue.listQueuedInputs("instance-id").map((message) => message.id)).toEqual([
      "mac-1",
      "phone-1",
      "mac-2",
    ]);
    expect(queue.drainReady("instance-id").map((message) => message.payload)).toEqual([
      "first\n",
      "second\n",
      "third\n",
    ]);
  });

  it("cancels queued input without cancelling injected input", () => {
    const queue = createInputQueue({ now: () => new Date("2026-04-25T12:00:00.000Z") });

    queue.enqueue({ id: "queued-1", instanceId: "instance-id", deviceId: "mac", payload: "npm test\n" });
    queue.enqueue({ id: "queued-2", instanceId: "instance-id", deviceId: "phone", payload: "git status\n" });
    expect(queue.cancel("instance-id", "queued-2")?.status).toBe("cancelled");

    expect(queue.drainReady("instance-id").map((message) => message.id)).toEqual(["queued-1"]);
    expect(queue.cancel("instance-id", "queued-1")).toBeUndefined();
  });

  it("classifies Ctrl+C input as an interrupt requiring explicit confirmation", () => {
    const queue = createInputQueue({ now: () => new Date("2026-04-25T12:00:00.000Z") });

    const result = queue.enqueue({
      id: "interrupt-1",
      instanceId: "instance-id",
      deviceId: "phone",
      payload: "",
    });

    expect(result.status).toBe(INPUT_ACK_STATUSES.REJECTED);
    expect(result.message.status).toBe("queued");
    expect(queue.listQueuedInputs("instance-id").map((message) => message.id)).toEqual(["interrupt-1"]);
    expect(queue.classify("")).toBe("interrupt");
    expect(queue.classify("npm test\n")).toBe("text");
  });
});
