import { describe, expect, it } from "vitest";

import {
  CLIENT_MESSAGE_TYPES,
  CONNECTION_STATES,
  INPUT_ACK_STATUSES,
  SERVER_MESSAGE_TYPES,
  type ConnectionStateMessagePayload,
  type HeartbeatMessagePayload,
  type InputAckMessagePayload,
  type InputMessagePayload,
} from "../../../shared/protocol/messages.js";
import { createConnectionStateTracker } from "../../src/api/connection-state.js";
import { createWebSocketProtocolService } from "../../src/api/websocket-protocol.js";

describe("input recovery protocol contract", () => {
  it("parses input messages and serializes accepted input acknowledgements", () => {
    const protocol = createWebSocketProtocolService();

    expect(protocol.parseClientMessage(JSON.stringify({
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: "instance-id",
      input_id: "input-id-1",
      payload: "npm test\n",
    }))).toEqual({
      type: CLIENT_MESSAGE_TYPES.INPUT,
      instance_id: "instance-id",
      input_id: "input-id-1",
      payload: "npm test\n",
    } satisfies InputMessagePayload);

    expect(protocol.serializeInputAck({
      instanceId: "instance-id",
      inputId: "input-id-1",
      status: INPUT_ACK_STATUSES.ACCEPTED,
    })).toEqual({
      type: SERVER_MESSAGE_TYPES.INPUT_ACK,
      instance_id: "instance-id",
      input_id: "input-id-1",
      status: INPUT_ACK_STATUSES.ACCEPTED,
    } satisfies InputAckMessagePayload);
  });

  it("parses heartbeat messages and serializes connection state transitions", () => {
    const protocol = createWebSocketProtocolService();

    expect(protocol.parseClientMessage(JSON.stringify({
      type: CLIENT_MESSAGE_TYPES.HEARTBEAT,
      sent_at: "2026-04-25T12:00:00.000Z",
    }))).toEqual({
      type: CLIENT_MESSAGE_TYPES.HEARTBEAT,
      sent_at: "2026-04-25T12:00:00.000Z",
    } satisfies HeartbeatMessagePayload);

    expect(protocol.serializeConnectionState(CONNECTION_STATES.DEGRADED)).toEqual({
      type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
      state: CONNECTION_STATES.DEGRADED,
    } satisfies ConnectionStateMessagePayload);
  });

  it("moves from connected to degraded and disconnected when heartbeats time out", () => {
    const tracker = createConnectionStateTracker({
      degradedAfterMs: 1_000,
      disconnectedAfterMs: 3_000,
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });

    tracker.markHeartbeat(new Date("2026-04-25T12:00:00.000Z"));

    expect(tracker.evaluate(new Date("2026-04-25T12:00:00.500Z"))).toEqual({
      type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
      state: CONNECTION_STATES.CONNECTED,
    } satisfies ConnectionStateMessagePayload);
    expect(tracker.evaluate(new Date("2026-04-25T12:00:02.000Z"))).toEqual({
      type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
      state: CONNECTION_STATES.DEGRADED,
    } satisfies ConnectionStateMessagePayload);
    expect(tracker.evaluate(new Date("2026-04-25T12:00:04.000Z"))).toEqual({
      type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
      state: CONNECTION_STATES.DISCONNECTED,
    } satisfies ConnectionStateMessagePayload);
  });
});
