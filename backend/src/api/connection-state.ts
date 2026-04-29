import {
  CONNECTION_STATES,
  SERVER_MESSAGE_TYPES,
  type ConnectionState,
  type ConnectionStateMessagePayload
} from '../../../shared/protocol/messages.js';

export interface ConnectionStateTrackerOptions {
  readonly degradedAfterMs?: number;
  readonly disconnectedAfterMs?: number;
  readonly now?: () => Date;
}

export function createConnectionStateTracker(options: ConnectionStateTrackerOptions = {}) {
  const degradedAfterMs = options.degradedAfterMs ?? 5_000;
  const disconnectedAfterMs = options.disconnectedAfterMs ?? 15_000;
  const now = options.now ?? (() => new Date());
  let lastHeartbeatAt = now();

  function serialize(state: ConnectionState): ConnectionStateMessagePayload {
    return {
      type: SERVER_MESSAGE_TYPES.CONNECTION_STATE,
      state
    };
  }

  function markHeartbeat(sentAt: Date = now()): ConnectionStateMessagePayload {
    lastHeartbeatAt = sentAt;
    return serialize(CONNECTION_STATES.CONNECTED);
  }

  function evaluate(at: Date = now()): ConnectionStateMessagePayload {
    const elapsed = at.getTime() - lastHeartbeatAt.getTime();
    if (elapsed >= disconnectedAfterMs) {
      return serialize(CONNECTION_STATES.DISCONNECTED);
    }
    if (elapsed >= degradedAfterMs) {
      return serialize(CONNECTION_STATES.DEGRADED);
    }
    return serialize(CONNECTION_STATES.CONNECTED);
  }

  return { markHeartbeat, evaluate, serialize };
}
