# Data Model: Remote Terminal

## Device

Represents a physical or browser client authorized to access the local Claude Code server.

- `id`: Stable server-generated identifier
- `name`: Human-readable device name
- `role`: `admin` or `member`
- `tokenHash`: Hash of the long-lived access token
- `createdAt`, `lastSeenAt`, `revokedAt`

Validation:

- Exactly one active admin device exists after first pairing.
- Revoked devices cannot open new terminal connections.

## PairingCode

Short-lived code used to authorize a new device.

- `id`
- `codeHash`
- `createdByDeviceId`
- `expiresAt`
- `usedAt`
- `usedByDeviceId`

Validation:

- Pairing codes are single-use.
- Expired or used codes are rejected.
- Only admin devices can create new pairing codes after initial bootstrap.

## ClaudeInstance

Represents a hosted Claude Code PTY process.

- `id`
- `name`
- `status`: `idle`, `running`, `exited`, `error`
- `ptyPid`
- `cwd`
- `createdByDeviceId`
- `createdAt`, `lastActiveAt`, `exitedAt`

Relationships:

- Has one output buffer.
- Has many client connections.
- Has many input messages.

## OutputBuffer

Bounded replay window for terminal output.

- `instanceId`
- `baseOffset`
- `nextOffset`
- `capacityBytes`: default 1MB
- `chunks`: ordered output chunks with offset ranges

Validation:

- Offset ranges are monotonic and non-overlapping.
- Replay from an offset below `baseOffset` returns `output_gap`.

## InputMessage

Client-originated input sent to a PTY.

- `id`: Client-generated idempotency key
- `instanceId`
- `deviceId`
- `payload`
- `status`: `queued`, `injected`, `acked`, `cancelled`, `failed`
- `createdAt`, `injectedAt`, `ackedAt`

Validation:

- Duplicate `(deviceId, id)` messages return the existing acknowledgement result.
- Normal input is processed FIFO per instance.
- Interrupt input such as Ctrl+C may bypass queued text after explicit confirmation.

## ClientConnection

Ephemeral WebSocket connection from a device to an instance.

- `connectionId`
- `deviceId`
- `instanceId`
- `state`: `connected`, `degraded`, `disconnected`
- `lastAckedOutputOffset`
- `connectedAt`, `lastHeartbeatAt`, `disconnectedAt`

Validation:

- Reconnect uses `lastAckedOutputOffset` to request replay.
- Heartbeat timeout transitions the connection to `degraded` then `disconnected`.

## NotificationEvent

Event emitted when terminal or collaboration state requires user attention.

- `id`
- `instanceId`
- `type`: `permission_request`, `long_running_complete`, `error`, `mention`, `input_required`
- `priority`: `low`, `normal`, `high`, `urgent`
- `status`: `pending`, `delivered`, `read`, `escalated`, `expired`
- `createdAt`, `deliveredAt`, `readAt`

Validation:

- Reading a notification on one device clears equivalent pending prompts for the same user scope.
- Escalation follows priority-specific routing rules.

## State Transitions

- PairingCode: `active` → `used` or `expired`
- ClaudeInstance: `idle` → `running` → `exited` or `error`
- InputMessage: `queued` → `injected` → `acked`; or `queued` → `cancelled`; or any active state → `failed`
- ClientConnection: `connected` → `degraded` → `disconnected` → `connected`
- NotificationEvent: `pending` → `delivered` → `read`; or `pending` → `escalated` → `read`; or `pending` → `expired`
