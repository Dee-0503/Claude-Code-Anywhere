# Promotion Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0 promotion blockers and P1 high-risk items so `develop` can be audited and promoted to `test` safely.

**Architecture:** Use one integration branch, `fix/001-promotion-blockers`, and implement by isolated workstreams with TDD. Runtime backend wiring must use SQLite-backed repositories by default, security checks must move to explicit device-to-instance authorization boundaries, and frontend terminal recovery must use xterm plus reconnect/resume semantics. CI and hardening changes close the remaining promotion gaps.

**Tech Stack:** TypeScript, Node.js 20 ESM, better-sqlite3, ws, node-pty, React, xterm.js, Vitest, ESLint, Prettier, GitHub Actions.

---

## File Structure

### Backend persistence

- Modify `backend/src/db/schema.sql`: add any missing tables/indexes for persistent devices, pairings, instances, input messages, and notification state.
- Modify `backend/src/db/migrations.ts`: ensure schema is applied idempotently and versioned.
- Modify `backend/src/db/connection.ts`: keep `openDatabaseConnection` as the low-level database entrypoint.
- Modify `backend/src/auth/device-repository.ts`: keep `DeviceRepository`; add SQLite implementation factory beside in-memory factory.
- Modify `backend/src/auth/pairing-repository.ts`: keep `PairingRepository`; add SQLite implementation and rate-limit persistence primitives.
- Modify `backend/src/sessions/instance-repository.ts`: keep `InstanceRepository`; add SQLite implementation.
- Modify `backend/src/sessions/input-repository.ts`: keep `InputRepository`; add SQLite implementation.
- Modify `backend/src/notifications/notification-repository.ts`: keep existing repository interface; add SQLite implementation if notification state is present.
- Modify `backend/src/index.ts`: runtime composition uses SQLite repositories by default.
- Modify `backend/src/config.ts`: add database path, explicit repository mode, allowed workspace roots, and PTY instance limits.
- Test `backend/tests/integration/sqlite-persistence.test.ts`: prove restart persistence.

### Backend authorization and WebSocket security

- Modify `backend/src/sessions/instance-service.ts`: add device-scoped instance lookup, ownership checks, stop guards, cwd validation, and instance limits.
- Modify `backend/src/api/instance-routes.ts`: call device-to-instance authorization for list/read/stop/output/replay/input/ack operations.
- Modify `backend/src/sessions/replay-service.ts`: require authorized access before replaying output.
- Modify `backend/src/sessions/input-stream.ts`: require authorized access before accepting input or ack.
- Modify `backend/src/api/websocket-auth.ts`: authenticate token, validate origin/path, authorize instance attach.
- Modify `backend/src/api/websocket-server.ts`: call authenticated attach path before protocol connection is accepted.
- Test `backend/tests/security/auth-security.test.ts`: unauthorized cross-device denial.
- Test `backend/tests/contract/instance-api.test.ts`: route-level denial contract.
- Test `backend/tests/contract/websocket-protocol.test.ts`: handshake denial contract.

### Frontend terminal and reconnect

- Modify `frontend/src/terminal/TerminalView.tsx`: ensure xterm is the primary renderer, output replay writes to xterm, and input uses xterm `onData`.
- Modify `frontend/src/protocol/client.ts`: add reconnect state machine, bounded backoff, non-retryable close handling, and attach restore.
- Modify `frontend/src/protocol/reconnect.ts`: add or refine reconnect policy helpers.
- Modify `frontend/src/protocol/input-client.ts`: preserve pending input without duplicate submission after reconnect.
- Test `frontend/tests/integration/terminal-display.test.tsx`: xterm write/input path.
- Test `frontend/tests/integration/terminal-view-output-sync.test.tsx`: replay writes to xterm.
- Test `frontend/tests/unit/input-client.test.ts`: pending input is not duplicated.
- Test `frontend/tests/unit/connection-recovery-ui.test.ts`: reconnect state and retry policy.

### Quality gates and hardening

- Create `.github/workflows/code-ci.yml`: regular CI for PRs to `develop`, `test`, and `main`.
- Modify formatting only where `npm run format:check` reports differences.
- Modify `backend/src/auth/pairing-service.ts`: enforce pairing consumption rate limits and cooldown/lockout.
- Modify `backend/src/pty/node-pty-adapter.ts`: enforce cwd constraints at spawn boundary if this file owns PTY spawning.
- Test `backend/tests/contract/auth-pairing.test.ts`: rate-limit contract.
- Test `backend/tests/integration/remote-terminal-session.test.ts`: PTY/session lifecycle constraints.

---

### Task 0: Prepare the fix branch

**Files:**

- No code files.

- [ ] **Step 1: Confirm current branch and cleanliness**

Run:

```bash
git status --short --branch
```

Expected: current branch is `develop` and no uncommitted changes except the already committed design/plan work.

- [ ] **Step 2: Create the integration branch**

Run:

```bash
git switch -c fix/001-promotion-blockers
```

Expected: branch switches to `fix/001-promotion-blockers`.

- [ ] **Step 3: Commit plan if it is not already committed**

Run:

```bash
git status --short
git add docs/superpowers/plans/2026-04-26-promotion-blockers.md
git commit -m "$(cat <<'EOF'
Plan promotion blocker fixes
EOF
)"
```

Expected: a focused planning commit, or no commit if the plan was already committed by the coordinator.

---

### Task 1: Add SQLite repository persistence and runtime wiring

**Files:**

- Modify: `backend/src/db/schema.sql`
- Modify: `backend/src/db/migrations.ts`
- Modify: `backend/src/auth/device-repository.ts`
- Modify: `backend/src/auth/pairing-repository.ts`
- Modify: `backend/src/sessions/instance-repository.ts`
- Modify: `backend/src/sessions/input-repository.ts`
- Modify: `backend/src/notifications/notification-repository.ts`
- Modify: `backend/src/config.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/tests/integration/sqlite-persistence.test.ts`

- [ ] **Step 1: Write failing restart-persistence tests**

Create `backend/tests/integration/sqlite-persistence.test.ts` with tests that use a temporary database path, construct SQLite repositories, write state, close/reopen the database, and assert state remains readable. Cover devices/token verification, pairings, instance metadata, input ack/queued status, and notification state if the repository exists.

Use this shape and adapt only names that differ in the current interfaces:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabaseConnection } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createSqliteDeviceRepository } from '../../src/auth/device-repository.js';
import { createSqlitePairingRepository } from '../../src/auth/pairing-repository.js';
import { createSqliteInstanceRepository } from '../../src/sessions/instance-repository.js';
import { createSqliteInputRepository } from '../../src/sessions/input-repository.js';

const dirs: string[] = [];

function openRepositories() {
  const dir = mkdtempSync(join(tmpdir(), 'cca-sqlite-'));
  dirs.push(dir);
  const database = openDatabaseConnection({ path: join(dir, 'state.sqlite') });
  runMigrations(database);
  return {
    database,
    devices: createSqliteDeviceRepository(database),
    pairings: createSqlitePairingRepository(database),
    instances: createSqliteInstanceRepository(database),
    inputs: createSqliteInputRepository(database)
  };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('SQLite runtime persistence', () => {
  it('persists devices and verifies tokens after repository restart', async () => {
    const first = openRepositories();
    await first.devices.create({
      id: 'device-a',
      name: 'Browser A',
      role: 'browser',
      tokenHash: 'hash'
    });
    first.database.close();

    const second = openRepositories();
    const device = second.devices.get('device-a');
    expect(device?.id).toBe('device-a');
    second.database.close();
  });

  it('persists instance metadata and queued input state after repository restart', () => {
    const first = openRepositories();
    first.instances.save({
      id: 'instance-a',
      cwd: process.cwd(),
      status: 'running',
      createdByDeviceId: 'device-a',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Persisted',
      teamMetadata: null
    });
    first.inputs.save({
      id: 'input-a',
      instanceId: 'instance-a',
      deviceId: 'device-a',
      payload: 'echo persisted\\n',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    first.database.close();

    const second = openRepositories();
    expect(second.instances.get('instance-a')?.createdByDeviceId).toBe('device-a');
    expect(second.inputs.get('instance-a', 'input-a')?.status).toBe('queued');
    second.database.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- backend/tests/integration/sqlite-persistence.test.ts
```

Expected: FAIL because `createSqlite*Repository` factories or persistence behavior do not exist yet.

- [ ] **Step 3: Implement SQLite repository factories**

Add SQLite-backed factories next to the in-memory factories. Preserve existing interfaces and do not remove in-memory factories. Use prepared statements and JSON serialization only for structured metadata fields.

Factories to export:

```ts
export function createSqliteDeviceRepository(database: SqliteDatabase): DeviceRepository;
export function createSqlitePairingRepository(database: SqliteDatabase): PairingRepository;
export function createSqliteInstanceRepository(database: SqliteDatabase): InstanceRepository;
export function createSqliteInputRepository(database: SqliteDatabase): InputRepository;
```

If notification state is implemented, export:

```ts
export function createSqliteNotificationRepository(
  database: SqliteDatabase
): NotificationRepository;
```

- [ ] **Step 4: Wire runtime to SQLite by default**

In `backend/src/config.ts`, add configuration fields equivalent to:

```ts
export interface BackendConfig {
  readonly databasePath: string;
  readonly repositoryMode: 'sqlite' | 'memory';
  readonly allowedWorkspaceRoots: readonly string[];
  readonly maxInstancesPerDevice: number;
  readonly maxInstancesGlobal: number;
}
```

In `backend/src/index.ts`, construct SQLite repositories when `repositoryMode !== 'memory'`, run migrations before service construction, and reserve in-memory factories for tests or explicit development mode.

- [ ] **Step 5: Run persistence test to verify it passes**

Run:

```bash
npm test -- backend/tests/integration/sqlite-persistence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run focused backend integration tests**

Run:

```bash
npm test -- backend/tests/integration/remote-terminal-session.test.ts backend/tests/integration/weak-network-input.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add backend/src/db/schema.sql backend/src/db/migrations.ts backend/src/auth/device-repository.ts backend/src/auth/pairing-repository.ts backend/src/sessions/instance-repository.ts backend/src/sessions/input-repository.ts backend/src/notifications/notification-repository.ts backend/src/config.ts backend/src/index.ts backend/tests/integration/sqlite-persistence.test.ts
git commit -m "$(cat <<'EOF'
Persist runtime state in SQLite
EOF
)"
```

---

### Task 2: Enforce instance authorization boundaries

**Files:**

- Modify: `backend/src/sessions/instance-service.ts`
- Modify: `backend/src/api/instance-routes.ts`
- Modify: `backend/src/sessions/replay-service.ts`
- Modify: `backend/src/sessions/input-stream.ts`
- Test: `backend/tests/security/auth-security.test.ts`
- Test: `backend/tests/contract/instance-api.test.ts`

- [ ] **Step 1: Add failing security tests for cross-device access**

Extend `backend/tests/security/auth-security.test.ts` with tests named:

```ts
it('rejects device A attaching to device B instance', async () => {});
it('rejects device A stopping device B instance', async () => {});
it('rejects device A reading device B output', async () => {});
it('rejects device A sending or acknowledging input for device B instance', async () => {});
```

Each test should create two valid devices, start an instance owned by device B, then attempt the operation with device A. Expect a clear authorization failure status or protocol error matching existing API error conventions.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- backend/tests/security/auth-security.test.ts backend/tests/contract/instance-api.test.ts
```

Expected: FAIL because valid tokens are not yet scoped to instances.

- [ ] **Step 3: Add authorization helpers to instance service**

In `backend/src/sessions/instance-service.ts`, add methods equivalent to:

```ts
function getAuthorizedInstance(input: {
  instanceId: ClaudeInstanceId;
  deviceId: DeviceId;
}): ClaudeInstance {
  const instance = repository.get(input.instanceId);
  if (instance === undefined) throw serviceError('INSTANCE_NOT_FOUND', 'Instance not found');
  if (instance.createdByDeviceId !== input.deviceId)
    throw serviceError('INSTANCE_FORBIDDEN', 'Device is not authorized for this instance');
  return instance;
}

function stopAuthorizedInstance(input: {
  instanceId: ClaudeInstanceId;
  deviceId: DeviceId;
}): ClaudeInstance {
  getAuthorizedInstance(input);
  return stopInstance(input.instanceId)!;
}
```

If the project already has a broader sharing/authorization model, implement the helper through that model instead of raw ownership, but keep denial-by-default for unrelated devices.

- [ ] **Step 4: Apply authorization at all route/service entrypoints**

Update `backend/src/api/instance-routes.ts`, `backend/src/sessions/replay-service.ts`, and `backend/src/sessions/input-stream.ts` so every operation with `instance_id` first resolves `device_id` from the authenticated token and then calls the authorization helper.

Required operations:

```ts
attach instance;
stop instance;
list/read instance metadata;
read output buffer;
replay output;
send input;
submit input ack;
```

- [ ] **Step 5: Run focused authorization tests**

Run:

```bash
npm test -- backend/tests/security/auth-security.test.ts backend/tests/contract/instance-api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/sessions/instance-service.ts backend/src/api/instance-routes.ts backend/src/sessions/replay-service.ts backend/src/sessions/input-stream.ts backend/tests/security/auth-security.test.ts backend/tests/contract/instance-api.test.ts
git commit -m "$(cat <<'EOF'
Enforce device instance authorization
EOF
)"
```

---

### Task 3: Harden WebSocket authenticated attach

**Files:**

- Modify: `backend/src/api/websocket-auth.ts`
- Modify: `backend/src/api/websocket-server.ts`
- Modify: `backend/src/api/websocket-protocol.ts`
- Test: `backend/tests/contract/websocket-protocol.test.ts`
- Test: `backend/tests/security/auth-security.test.ts`

- [ ] **Step 1: Write failing WebSocket handshake tests**

Extend `backend/tests/contract/websocket-protocol.test.ts` with tests named:

```ts
it('rejects websocket attach without a device token', async () => {});
it('rejects websocket attach with an invalid device token', async () => {});
it('rejects websocket attach when the device does not own the instance', async () => {});
it('rejects websocket attach from a disallowed origin', async () => {});
it('rejects websocket attach on a disallowed path', async () => {});
```

Expected denial should happen before protocol `accept`/attach is returned.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- backend/tests/contract/websocket-protocol.test.ts backend/tests/security/auth-security.test.ts
```

Expected: FAIL for missing origin/path/authorization checks.

- [ ] **Step 3: Separate parsing from authenticated attach**

In `backend/src/api/websocket-auth.ts`, keep a pure parse/validate helper for fields and add an authenticated helper equivalent to:

```ts
export interface AuthenticatedWebSocketAttach {
  readonly deviceId: DeviceId;
  readonly instanceId: ClaudeInstanceId;
}

export async function authenticateWebSocketAttach(
  input: WebSocketAuthInput
): Promise<AuthenticatedWebSocketAttach> {
  const parsed = validateWebSocketHandshake(input);
  const device = await devices.verifyToken(parsed.deviceId, parsed.accessToken);
  if (device === undefined) throw serviceError('INVALID_DEVICE_TOKEN', 'Invalid device token');
  instances.getAuthorizedInstance({ instanceId: parsed.instanceId, deviceId: device.id });
  return { deviceId: device.id, instanceId: parsed.instanceId };
}
```

Implement origin/path policy from config and reject before attach when policy fails.

- [ ] **Step 4: Enforce authenticated attach in server setup**

In `backend/src/api/websocket-server.ts`, ensure the server only calls the protocol connection registry after `authenticateWebSocketAttach` succeeds. Close/reject the socket with a clear auth/forbidden close code for denied handshakes.

- [ ] **Step 5: Run WebSocket tests**

Run:

```bash
npm test -- backend/tests/contract/websocket-protocol.test.ts backend/tests/security/auth-security.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/api/websocket-auth.ts backend/src/api/websocket-server.ts backend/src/api/websocket-protocol.ts backend/tests/contract/websocket-protocol.test.ts backend/tests/security/auth-security.test.ts
git commit -m "$(cat <<'EOF'
Require authenticated websocket attach
EOF
)"
```

---

### Task 4: Add P1 pairing and PTY hardening

**Files:**

- Modify: `backend/src/auth/pairing-service.ts`
- Modify: `backend/src/auth/pairing-repository.ts`
- Modify: `backend/src/db/schema.sql`
- Modify: `backend/src/config.ts`
- Modify: `backend/src/sessions/instance-service.ts`
- Modify: `backend/src/pty/node-pty-adapter.ts`
- Test: `backend/tests/contract/auth-pairing.test.ts`
- Test: `backend/tests/contract/instance-api.test.ts`

- [ ] **Step 1: Write failing pairing rate-limit tests**

Extend `backend/tests/contract/auth-pairing.test.ts` with tests named:

```ts
it('rate limits repeated invalid pairing code consumption from the same device', async () => {});
it('locks or cools down a pairing code after repeated failed attempts', async () => {});
it('allows valid pairing after cooldown expires', async () => {});
```

Use fake time if the existing test harness supports it; otherwise configure a short cooldown in the service options.

- [ ] **Step 2: Write failing PTY constraint tests**

Extend `backend/tests/contract/instance-api.test.ts` with tests named:

```ts
it('rejects starting an instance outside allowed workspace roots', async () => {});
it('rejects starting more than the per-device instance limit', async () => {});
it('rejects starting more than the global instance limit', async () => {});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- backend/tests/contract/auth-pairing.test.ts backend/tests/contract/instance-api.test.ts
```

Expected: FAIL because rate limits and PTY constraints are not implemented.

- [ ] **Step 4: Implement pairing attempt tracking**

Add repository methods for failed attempt recording and cooldown lookup. Persist attempt records in SQLite and mirror them in the in-memory repository for tests.

Service behavior:

```ts
if (rateLimit.isBlocked({ code, deviceId, ipAddress })) {
  throw serviceError('PAIRING_RATE_LIMITED', 'Too many pairing attempts');
}

if (pairingCodeInvalid) {
  pairings.recordFailedAttempt({ code, deviceId, ipAddress, attemptedAt: now() });
  throw serviceError('INVALID_PAIRING_CODE', 'Invalid pairing code');
}
```

- [ ] **Step 5: Implement cwd and instance limits**

In `backend/src/sessions/instance-service.ts`, normalize requested `cwd` with `realpathSync` or `resolve`, require it to be inside one configured workspace root, and count active instances by device and globally before spawning.

Reject with clear service errors:

```ts
'INSTANCE_CWD_FORBIDDEN';
'INSTANCE_LIMIT_EXCEEDED';
```

- [ ] **Step 6: Enforce cwd at PTY spawn boundary**

In `backend/src/pty/node-pty-adapter.ts`, do not spawn if the caller passes an unvalidated cwd. Prefer receiving already validated `cwd` from `instance-service`, and keep the adapter narrow.

- [ ] **Step 7: Run P1 tests**

Run:

```bash
npm test -- backend/tests/contract/auth-pairing.test.ts backend/tests/contract/instance-api.test.ts backend/tests/integration/remote-terminal-session.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add backend/src/auth/pairing-service.ts backend/src/auth/pairing-repository.ts backend/src/db/schema.sql backend/src/config.ts backend/src/sessions/instance-service.ts backend/src/pty/node-pty-adapter.ts backend/tests/contract/auth-pairing.test.ts backend/tests/contract/instance-api.test.ts
git commit -m "$(cat <<'EOF'
Harden pairing and PTY constraints
EOF
)"
```

---

### Task 5: Implement frontend xterm replay and reconnect recovery

**Files:**

- Modify: `frontend/src/terminal/TerminalView.tsx`
- Modify: `frontend/src/protocol/client.ts`
- Modify: `frontend/src/protocol/reconnect.ts`
- Modify: `frontend/src/protocol/input-client.ts`
- Test: `frontend/tests/integration/terminal-display.test.tsx`
- Test: `frontend/tests/integration/terminal-view-output-sync.test.tsx`
- Test: `frontend/tests/unit/input-client.test.ts`
- Test: `frontend/tests/unit/connection-recovery-ui.test.ts`

- [ ] **Step 1: Write failing xterm write/input tests**

Extend `frontend/tests/integration/terminal-display.test.tsx` and `frontend/tests/integration/terminal-view-output-sync.test.tsx` so the xterm mock records calls to:

```ts
open(element: HTMLElement): void;
write(data: string): void;
onData(handler: (data: string) => void): { dispose(): void };
```

Assert that backend output and replay messages call `write`, and simulated `onData('ls\n')` calls the client input path exactly once.

- [ ] **Step 2: Write failing reconnect tests**

Extend `frontend/tests/unit/connection-recovery-ui.test.ts` or create it if missing. Cover:

```ts
it('enters reconnecting and retries after retryable disconnect', async () => {});
it('does not reconnect after authentication or authorization close code', async () => {});
it('restores attach using last acknowledged offsets after reconnect', async () => {});
it('does not duplicate pending input after reconnect', async () => {});
```

- [ ] **Step 3: Run frontend tests to verify they fail**

Run:

```bash
npm test -- frontend/tests/integration/terminal-display.test.tsx frontend/tests/integration/terminal-view-output-sync.test.tsx frontend/tests/unit/input-client.test.ts frontend/tests/unit/connection-recovery-ui.test.ts
```

Expected: FAIL for missing reconnect behavior or incomplete xterm write path.

- [ ] **Step 4: Make xterm the primary renderer**

In `frontend/src/terminal/TerminalView.tsx`, ensure one terminal instance is opened once per container lifecycle, server output calls a renderer that writes to xterm, replay messages use the same writer, and `terminal.onData` is the source of user input.

Required behavior:

```ts
terminal.open(containerRef.current);
terminal.onData((payload) => inputClient.send(payload));
terminal.write(outputPayload.data);
```

Keep fallback text UI for failure/no-xterm states only.

- [ ] **Step 5: Implement reconnect policy**

In `frontend/src/protocol/reconnect.ts`, expose a bounded policy equivalent to:

```ts
export function shouldReconnect(closeCode: number): boolean {
  return ![1000, 1008, 4001, 4003, 4401, 4403].includes(closeCode);
}

export function nextReconnectDelay(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** Math.min(attempt, 6));
}
```

Use existing project close-code constants if present.

- [ ] **Step 6: Implement client reconnect state machine**

In `frontend/src/protocol/client.ts`, keep at most one active socket, dispose old listeners before retrying, emit `reconnecting`, then reconnect using last saved output/input offsets. On successful connect, restore attach/subscription and reset attempt counter.

- [ ] **Step 7: Preserve pending input semantics**

In `frontend/src/protocol/input-client.ts`, ensure pending input IDs survive reconnect and are not resubmitted if already injected or acknowledged. Use existing last-acknowledged state helpers where present.

- [ ] **Step 8: Run frontend focused tests**

Run:

```bash
npm test -- frontend/tests/integration/terminal-display.test.tsx frontend/tests/integration/terminal-view-output-sync.test.tsx frontend/tests/unit/input-client.test.ts frontend/tests/unit/connection-recovery-ui.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add frontend/src/terminal/TerminalView.tsx frontend/src/protocol/client.ts frontend/src/protocol/reconnect.ts frontend/src/protocol/input-client.ts frontend/tests/integration/terminal-display.test.tsx frontend/tests/integration/terminal-view-output-sync.test.tsx frontend/tests/unit/input-client.test.ts frontend/tests/unit/connection-recovery-ui.test.ts
git commit -m "$(cat <<'EOF'
Recover terminal websocket sessions
EOF
)"
```

---

### Task 6: Add regular code CI and repair formatting

**Files:**

- Create: `.github/workflows/code-ci.yml`
- Modify: files reported by `npm run format:check`

- [ ] **Step 1: Add code CI workflow**

Create `.github/workflows/code-ci.yml`:

```yaml
name: Code CI

on:
  pull_request:
    branches: [develop, test, main]

permissions:
  contents: read

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Check formatting
        run: npm run format:check

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Run format check**

Run:

```bash
npm run format:check
```

Expected: FAIL only if Prettier differences remain.

- [ ] **Step 3: Apply formatting**

Run:

```bash
npm run format
```

Review the diff and ensure it is only Prettier output, not semantic code changes.

- [ ] **Step 4: Run format check again**

Run:

```bash
npm run format:check
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add .github/workflows/code-ci.yml
git add backend frontend shared .claude .specify package.json package-lock.json
git commit -m "$(cat <<'EOF'
Add code CI quality gates
EOF
)"
```

If formatting touched a very large number of unrelated files, split into two commits: one for CI and one for formatting.

---

### Task 7: Run full validation and browser acceptance

**Files:**

- No code files unless validation reveals a defect.

- [ ] **Step 1: Run clean install**

Run:

```bash
npm ci
```

Expected: PASS.

- [ ] **Step 2: Run full quality gates**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 3: Run targeted security/recovery tests**

Run:

```bash
npm test -- backend/tests/security/auth-security.test.ts backend/tests/contract/websocket-protocol.test.ts backend/tests/integration/weak-network-input.test.ts backend/tests/integration/multi-client-coordination.test.ts
```

Expected: PASS.

- [ ] **Step 4: Dispatch browser acceptance verification**

Use a browser-capable subagent. The subagent must start the dev server if needed and verify:

```text
Desktop Chrome: xterm displays output, accepts input, scrolls, selects/copies text.
Output replay: reconnect or cross-device open writes replay to xterm.
Multi-client: two clients attached to the same authorized instance see consistent output.
Weak network: disconnect for 10-30 seconds, reconnect automatically, no duplicate pending input.
Mobile where feasible: soft keyboard, IME, paste confirmation, orientation behavior.
Notifications: denied/default/granted states if notification UI is reachable.
Teammate tab/deep-link behavior if reachable.
```

Expected: subagent returns PASS/FAIL summary only, without raw screenshots or snapshots.

- [ ] **Step 5: Commit validation notes only if a tracked artifact is required**

If the project requires a validation artifact, create or update the existing validation document. Do not create extra docs unless requested.

---

### Task 8: Prepare delivery and phase audit

**Files:**

- No code files unless audit fixes are required.

- [ ] **Step 1: Collect commit list**

Run:

```bash
git log --oneline develop..HEAD
```

Expected: focused commits matching the plan tasks.

- [ ] **Step 2: Check final diff scope**

Run:

```bash
git diff --stat develop...HEAD
```

Expected: changes map to P0/P1 blockers, CI, tests, and necessary formatting.

- [ ] **Step 3: Rerun phase-level audit**

Run the project’s phase-level audit or review workflow. Include the full validation evidence from Task 7.

Expected: no remaining P0 blockers.

- [ ] **Step 4: Prepare handoff summary**

The handoff must include:

```text
Fix branch: fix/001-promotion-blockers
Commits: <git log --oneline develop..HEAD>
P0 fixes: persistence, authorization, WebSocket auth, xterm/reconnect, format, CI
P1 fixes: pairing rate limit, PTY cwd/resource constraints, browser validation notes
Validation: npm ci, format:check, lint, typecheck, test, build, targeted backend tests, browser acceptance
CI evidence: workflow file and run link after PR opens
Known risks: only issues confirmed by validation or audit
```

- [ ] **Step 5: Open PR to develop only after validation passes**

Use the repository PR workflow. Do not open `develop` to `test` promotion until this fix PR is merged and the fresh phase audit passes.
