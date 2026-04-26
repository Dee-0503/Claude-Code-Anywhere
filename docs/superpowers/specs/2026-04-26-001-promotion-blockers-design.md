# Develop to Test Promotion Blocker Fix Design

Date: 2026-04-26
Branch: `fix/001-promotion-blockers`

## Goal

Unblock promotion from `develop` to `test` by fixing all P0 blockers and P1 high-risk items before rerunning phase-level audit.

## Scope

This design covers:

- SQLite-backed runtime persistence for backend repositories.
- Instance-level authorization for all device-scoped operations.
- WebSocket handshake authentication and authorization boundaries.
- Real xterm rendering, output replay, and frontend reconnect recovery.
- Format gate repair and regular code CI workflow.
- Pairing brute-force mitigation and PTY resource/path constraints.
- Final validation and delivery evidence.

## Branch and Commit Strategy

Create one integration branch from `develop`:

```text
fix/001-promotion-blockers
```

Use focused commits by functional point:

1. Runtime SQLite persistence.
2. Instance authorization boundary.
3. WebSocket authenticated attach boundary.
4. Frontend xterm and reconnect recovery.
5. CI workflow and formatting repair.
6. Pairing rate limits and PTY constraints.

Do not modify `develop` directly. After validation, open a PR from `fix/001-promotion-blockers` to `develop`. Only after the fix PR and phase audit pass should `develop` be promoted to `test` by PR.

## Workstreams

### Backend Persistence

Replace runtime service wiring that defaults to in-memory repositories with SQLite-backed repositories. In-memory repositories remain available only for tests or explicit development/test configuration.

Persistent state must include:

- Devices and device tokens.
- Pairings.
- Instance/session metadata.
- Input acknowledgements and queued input state.
- Notification state where implemented.

Add SQLite integration tests proving state survives service restart.

### Backend Authorization and WebSocket Security

Add device-to-instance authorization checks to every instance-level operation:

- Attach instance.
- Stop instance.
- List and read instance metadata.
- Read output buffer and replay output.
- Send input and submit input acknowledgements.

A valid device token alone is insufficient. The device must be authorized for the target instance.

WebSocket connection establishment must clearly separate parsing from authenticated attach. The handshake must reject:

- Missing token.
- Invalid token.
- Valid token without target instance authorization.
- Invalid origin/path according to configured policy.
- Attach attempts to missing or non-attachable instances.

Add contract/security tests for unauthorized device access across attach, stop, output read, input submit, and input ack.

### Frontend Terminal and Recovery

Verify that xterm is the primary terminal path, not the fallback text UI. Ensure:

- `Terminal.open(...)` mounts to the DOM.
- Backend output and replay output write into xterm.
- User input flows from xterm `onData` to the WebSocket/input client path.
- Fallback UI remains available but is not the primary rendering path.

Add automatic WebSocket reconnect:

- Enter `reconnecting` on retryable disconnects.
- Use bounded backoff and avoid duplicate sockets/listeners.
- Restore attach/subscription after reconnect.
- Resume from last acknowledged output/input offsets.
- Do not retry close codes that represent authentication, authorization, protocol, or intentional shutdown failures.

Add unit/integration coverage for reconnect, replay, and pending input non-duplication.

### Quality Gates and P1 Hardening

Repair Prettier differences without unrelated formatting churn where practical. Add a regular code CI workflow for PRs targeting `develop`, `test`, and `main` that runs:

- `npm ci`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Add pairing brute-force mitigation using rate limits, failed-attempt tracking, cooldown or lockout, and security audit logging.

Add PTY safeguards:

- Restrict requested `cwd` to allowed workspace roots.
- Limit per-device and global active instance counts.
- Ensure PTY lifecycle cleanup and timeout handling.

## Integration and Verification

After all workstreams merge into the fix branch, run in a clean or CI-like environment:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run targeted backend tests for security and recovery:

```bash
npm test -- backend/tests/security/auth-security.test.ts backend/tests/contract/websocket-protocol.test.ts backend/tests/integration/weak-network-input.test.ts backend/tests/integration/multi-client-coordination.test.ts
```

Browser verification must be delegated to a subagent. It should verify desktop xterm display, input, scrolling, copy/select, replay consistency, multi-client attach, reconnect after 10-30 seconds offline, and mobile checks where feasible.

## Delivery Evidence

The final handoff must include:

- Fix branch name.
- Commit list.
- P0 and P1 item-by-item fix summary.
- Full validation command results.
- CI workflow run link or screenshot once available.
- Known unresolved risks.
- Fresh phase-level audit result before any `develop` to `test` promotion PR.
