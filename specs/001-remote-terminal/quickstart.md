# Quickstart: Remote Terminal MVP

## Prerequisites

- Node.js 20+
- Local Claude Code CLI installed and authenticated
- A browser capable of WebSocket connections

## Scenario 1: Bootstrap and Pair First Device

1. Start the local Claude Code Anywhere server.
2. Confirm the terminal prints a short-lived pairing code.
3. Open the browser client.
4. Enter the pairing code and a device name.
5. Verify the device becomes the administrator.
6. Verify the pairing code cannot be reused.

## Scenario 2: Start and View a Claude Code Instance

1. Create a Claude instance from the browser client.
2. Verify the backend launches Claude Code through a PTY.
3. Verify terminal output renders through xterm.js.
4. Verify ANSI colors, cursor movement, and TUI layout remain intact.
5. Verify the terminal uses the fixed 120-column model with client-side scaling.

## Scenario 3: Send Input Reliably

1. Type a command from the browser terminal.
2. Verify the client sends a unique `input_id`.
3. Verify the server acknowledges the input.
4. Simulate a delayed acknowledgement and confirm the client retries after 3 seconds.
5. Verify duplicate input IDs do not inject duplicate PTY input.

## Scenario 4: Reconnect and Replay Output

1. Keep a Claude instance producing output.
2. Disconnect the browser network.
3. Reconnect with the last rendered output offset.
4. Verify buffered output is replayed in order.
5. Force output history past the 1MB buffer.
6. Reconnect from an old offset and verify `output_gap` is shown.

## Scenario 5: Pair and Revoke Another Device

1. From the admin device, create a new pairing code.
2. Pair a second browser/device.
3. Verify it can attach to an existing instance.
4. Revoke the second device from the admin device.
5. Verify the revoked device cannot reconnect or send input.

## Scenario 6: Connection State Visibility

1. Start with a healthy WebSocket connection.
2. Simulate heartbeat delay.
3. Verify UI transitions from connected to degraded.
4. Close the connection.
5. Verify UI transitions to disconnected and then reconnecting.
6. Restore the network and verify automatic recovery.

## Expected MVP Result

A paired browser device can securely access a local Claude Code PTY session, render terminal output faithfully, send idempotent input, survive reconnects, and enforce device revocation.
