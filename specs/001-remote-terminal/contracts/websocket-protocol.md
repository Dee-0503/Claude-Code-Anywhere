# WebSocket Protocol Contract

## Connection

Clients connect to the backend using WSS in production and WS only for local development.

Required query or handshake fields:

- `device_id`
- `access_token`
- `instance_id`
- `last_output_offset`

The server authenticates the device before attaching it to a Claude instance.

## Server to Client Messages

### `hello`

```json
{
  "type": "hello",
  "server_id": "local-server-id",
  "instance_id": "instance-id",
  "connection_id": "connection-id",
  "next_output_offset": 1234
}
```

### `output`

```json
{
  "type": "output",
  "instance_id": "instance-id",
  "offset": 1234,
  "data": "ansi encoded terminal bytes as utf-8 string"
}
```

### `output_gap`

```json
{
  "type": "output_gap",
  "instance_id": "instance-id",
  "requested_offset": 100,
  "available_from_offset": 900
}
```

### `input_ack`

```json
{
  "type": "input_ack",
  "instance_id": "instance-id",
  "input_id": "client-input-id",
  "status": "accepted"
}
```

### `connection_state`

```json
{
  "type": "connection_state",
  "state": "connected"
}
```

## Client to Server Messages

### `input`

```json
{
  "type": "input",
  "instance_id": "instance-id",
  "input_id": "client-generated-id",
  "payload": "terminal input"
}
```

### `ack_output`

```json
{
  "type": "ack_output",
  "instance_id": "instance-id",
  "offset": 2048
}
```

### `heartbeat`

```json
{
  "type": "heartbeat",
  "sent_at": "2026-04-25T12:00:00.000Z"
}
```

## Ordering and Recovery Rules

- Output offsets are monotonic per instance.
- Clients persist the latest rendered offset and provide it on reconnect.
- Server replays from `last_output_offset` when the buffer still contains the range.
- Server sends `output_gap` when replay history has been evicted.
- Input messages are idempotent by `(device_id, input_id)`.
- Clients retry unacknowledged input after 3 seconds unless the connection is closed.
