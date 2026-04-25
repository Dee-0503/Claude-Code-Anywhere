# Tasks: Remote Terminal

**Input**: Design documents from `/specs/001-remote-terminal/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the feature spec requires mandatory user scenario testing and core module coverage.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the TypeScript web application structure and baseline tooling.

- [X] T001 Create backend, frontend, shared, and test directories per plan in `backend/`, `frontend/`, and `shared/`
- [X] T002 Initialize root TypeScript workspace and package metadata in `package.json`, `tsconfig.json`, and `tsconfig.base.json`
- [X] T003 [P] Configure backend TypeScript ESM settings in `backend/tsconfig.json`
- [X] T004 [P] Configure frontend TypeScript ESM settings in `frontend/tsconfig.json`
- [X] T005 [P] Configure shared protocol package settings in `shared/tsconfig.json`
- [X] T006 Configure Vitest test runner for backend, frontend, and shared packages in `vitest.config.ts`
- [X] T007 Configure linting and formatting baseline in `eslint.config.js` and `.prettierrc.json`
- [X] T008 Update root `.gitignore` with Node.js, TypeScript, build, coverage, log, and env patterns in `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared infrastructure required by every user story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 Define shared WebSocket message types and error codes in `shared/protocol/messages.ts` and `shared/protocol/errors.ts`
- [X] T010 Define shared domain types for Device, PairingCode, ClaudeInstance, OutputBuffer, InputMessage, ClientConnection, and NotificationEvent in `shared/protocol/domain.ts`
- [X] T011 Create SQLite connection and migration runner in `backend/src/db/connection.ts` and `backend/src/db/migrations.ts`
- [X] T012 Create initial SQLite schema for devices, pairing codes, instances, input messages, connections, and notifications in `backend/src/db/schema.sql`
- [X] T013 Implement configuration loading for host, port, database path, TLS mode, and buffer limits in `backend/src/config.ts`
- [X] T014 Implement structured error helpers and request validation utilities in `backend/src/api/errors.ts` and `backend/src/api/validation.ts`
- [X] T015 Implement token hashing and verification utilities in `backend/src/auth/tokens.ts`
- [X] T016 Implement WebSocket server bootstrap and connection registry in `backend/src/api/websocket-server.ts`
- [X] T017 Implement PTY process adapter interface in `backend/src/pty/pty-adapter.ts`
- [X] T018 Implement bounded output ring buffer in `backend/src/sessions/output-buffer.ts`
- [X] T019 Create frontend protocol client foundation in `frontend/src/protocol/client.ts`
- [X] T020 Create frontend app shell and routing foundation in `frontend/src/pages/App.tsx`

**Checkpoint**: Foundation ready; user story implementation can now begin in priority order.

---

## Phase 3: User Story 1 - Remote access and session continuity (Priority: P1) MVP

**Goal**: A paired browser device can access a local Claude Code PTY session, render terminal output, and reconnect with buffered output replay.

**Independent Test**: Pair the first browser device, create a Claude instance, render xterm.js output, disconnect, reconnect with last offset, and verify replay or `output_gap` behavior.

### Tests for User Story 1

- [X] T021 [P] [US1] Add contract tests for bootstrap pairing and device token verification in `backend/tests/contract/auth-pairing.test.ts`
- [X] T022 [P] [US1] Add contract tests for WebSocket hello, output, ack_output, and output_gap messages in `backend/tests/contract/websocket-protocol.test.ts`
- [X] T023 [P] [US1] Add unit tests for output replay and 1MB gap behavior in `backend/tests/unit/output-buffer.test.ts`
- [X] T024 [P] [US1] Add integration test for first-device pairing and terminal attach flow in `backend/tests/integration/remote-terminal-session.test.ts`

### Implementation for User Story 1

- [X] T025 [US1] Implement device and pairing repositories in `backend/src/auth/device-repository.ts` and `backend/src/auth/pairing-repository.ts`
- [X] T026 [US1] Implement bootstrap pairing service in `backend/src/auth/pairing-service.ts`
- [X] T027 [US1] Implement authenticated WebSocket handshake in `backend/src/api/websocket-auth.ts`
- [X] T028 [US1] Implement Claude Code PTY launcher using node-pty in `backend/src/pty/node-pty-adapter.ts`
- [X] T029 [US1] Implement Claude instance repository and service in `backend/src/sessions/instance-repository.ts` and `backend/src/sessions/instance-service.ts`
- [X] T030 [US1] Wire PTY output to output buffer and WebSocket `output` messages in `backend/src/sessions/output-stream.ts`
- [X] T031 [US1] Implement reconnect replay and `output_gap` handling in `backend/src/sessions/replay-service.ts`
- [X] T032 [US1] Implement browser pairing screen in `frontend/src/pages/PairingPage.tsx`
- [X] T033 [US1] Implement xterm.js terminal view in `frontend/src/terminal/TerminalView.tsx`
- [X] T034 [US1] Implement frontend reconnect offset persistence in `frontend/src/protocol/reconnect.ts`
- [X] T035 [US1] Connect app shell to pairing and terminal routes in `frontend/src/pages/App.tsx`

**Checkpoint**: MVP remote terminal is independently usable and recoverable after reconnect.

---

## Phase 4: User Story 2 - Weak network and input recovery (Priority: P1)

**Goal**: User input is acknowledged, retried, de-duplicated, and safely recovered across degraded or disconnected networks.

**Independent Test**: Send input with a unique ID, delay ACK, verify retry without duplicate PTY injection, disconnect with queued input, reconnect, and confirm before replay.

### Tests for User Story 2

- [X] T036 [P] [US2] Add contract tests for input, input_ack, heartbeat, and connection_state messages in `backend/tests/contract/input-recovery.test.ts`
- [X] T037 [P] [US2] Add unit tests for FIFO input queue and duplicate input IDs in `backend/tests/unit/input-queue.test.ts`
- [X] T038 [P] [US2] Add integration test for degraded connection retry and reconnect confirmation in `backend/tests/integration/weak-network-input.test.ts`

### Implementation for User Story 2

- [X] T039 [US2] Implement input message repository in `backend/src/sessions/input-repository.ts`
- [X] T040 [US2] Implement FIFO input queue with idempotency in `backend/src/sessions/input-queue.ts`
- [X] T041 [US2] Wire acknowledged input injection to PTY stdin in `backend/src/sessions/input-stream.ts`
- [X] T042 [US2] Implement heartbeat timeout and connection state transitions in `backend/src/api/connection-state.ts`
- [X] T043 [US2] Implement frontend input retry and duplicate suppression in `frontend/src/protocol/input-client.ts`
- [X] T044 [US2] Implement degraded, disconnected, and reconnecting UI states in `frontend/src/components/ConnectionStatus.tsx`
- [X] T045 [US2] Implement offline input confirmation UI in `frontend/src/components/OfflineInputConfirm.tsx`

**Checkpoint**: Input remains safe and recoverable under weak network conditions.

---

## Phase 5: User Story 3 - Notification and authorization loop (Priority: P2)

**Goal**: Important terminal events and sensitive authorization prompts can notify the user and close the decision loop remotely.

**Independent Test**: Emit a permission request notification, deliver it to paired devices, approve or reject it, and verify the terminal flow receives the decision.

### Tests for User Story 3

- [X] T046 [P] [US3] Add unit tests for notification priority routing in `backend/tests/unit/notification-routing.test.ts`
- [X] T047 [P] [US3] Add integration test for permission request approval flow in `backend/tests/integration/authorization-loop.test.ts`

### Implementation for User Story 3

- [X] T048 [US3] Implement notification repository in `backend/src/notifications/notification-repository.ts`
- [X] T049 [US3] Implement notification routing and escalation service in `backend/src/notifications/notification-service.ts`
- [X] T050 [US3] Implement terminal authorization event bridge in `backend/src/notifications/authorization-bridge.ts`
- [X] T051 [US3] Implement notification center UI in `frontend/src/components/NotificationCenter.tsx`
- [X] T052 [US3] Implement authorization approval prompt UI in `frontend/src/components/AuthorizationPrompt.tsx`

**Checkpoint**: Notification and authorization loop works independently of later multi-instance features.

---

## Phase 6: User Story 4 - Multi-device and multi-instance management (Priority: P2)

**Goal**: Users can manage paired devices and switch between multiple Claude Code instances.

**Independent Test**: Pair a second device, create two instances, switch between them, stop one instance, revoke a device, and verify access changes.

### Tests for User Story 4

- [X] T053 [P] [US4] Add contract tests for instance list, create, status, and stop operations in `backend/tests/contract/instance-api.test.ts`
- [X] T054 [P] [US4] Add integration test for multi-device revocation and instance switching in `backend/tests/integration/multi-device-instance.test.ts`

### Implementation for User Story 4

- [X] T055 [US4] Implement instance API handlers in `backend/src/api/instance-routes.ts`
- [X] T056 [US4] Implement device management API handlers in `backend/src/api/device-routes.ts`
- [X] T057 [US4] Implement admin transfer and device revocation logic in `backend/src/auth/admin-service.ts`
- [X] T058 [US4] Implement instance switcher UI in `frontend/src/components/InstanceSwitcher.tsx`
- [X] T059 [US4] Implement device management UI in `frontend/src/components/DeviceManager.tsx`

**Checkpoint**: Multiple devices and instances are manageable through authenticated UI flows.

---

## Phase 7: User Story 5 - Multi-client input coordination (Priority: P2)

**Goal**: Multiple connected clients can observe the same terminal while input is coordinated safely.

**Independent Test**: Connect two clients to one instance, send queued input from both, cancel one queued message, and verify Ctrl+C behavior is explicit and safe.

### Tests for User Story 5

- [ ] T060 [P] [US5] Add unit tests for multi-client FIFO ordering and cancellation in `backend/tests/unit/multi-client-input.test.ts`
- [ ] T061 [P] [US5] Add integration test for two-client same-instance coordination in `backend/tests/integration/multi-client-coordination.test.ts`

### Implementation for User Story 5

- [ ] T062 [US5] Extend input queue with cancellation and interrupt classification in `backend/src/sessions/input-queue.ts`
- [ ] T063 [US5] Implement multi-client presence broadcast in `backend/src/sessions/presence-service.ts`
- [ ] T064 [US5] Implement queued input visibility messages in `shared/protocol/messages.ts`
- [ ] T065 [US5] Implement queued input UI and cancel action in `frontend/src/components/InputQueuePanel.tsx`
- [ ] T066 [US5] Implement explicit Ctrl+C confirmation UI in `frontend/src/components/InterruptConfirm.tsx`

**Checkpoint**: Multi-client viewing and input coordination are independently verifiable.

---

## Phase 8: User Story 6 - Mobile command and input optimization (Priority: P3)

**Goal**: Mobile users can send common terminal input efficiently and safely.

**Independent Test**: Use mobile command shortcuts, command templates, paste confirmation, and optional speech-to-text entry without corrupting terminal input.

### Tests for User Story 6

- [ ] T067 [P] [US6] Add frontend unit tests for mobile shortcut and paste confirmation behavior in `frontend/tests/unit/mobile-input.test.tsx`

### Implementation for User Story 6

- [ ] T068 [US6] Implement mobile command shortcut bar in `frontend/src/components/MobileShortcutBar.tsx`
- [ ] T069 [US6] Implement command template picker in `frontend/src/components/CommandTemplatePicker.tsx`
- [ ] T070 [US6] Implement paste confirmation flow in `frontend/src/components/PasteConfirm.tsx`
- [ ] T071 [US6] Implement optional speech-to-text input adapter boundary in `frontend/src/services/speechInput.ts`

**Checkpoint**: Mobile input helpers operate without changing backend terminal semantics.

---

## Phase 9: User Story 7 - Cross-device display consistency (Priority: P3)

**Goal**: Terminal display remains consistent across desktop and mobile while supporting search and scroll performance.

**Independent Test**: Open the same instance on desktop and mobile widths, verify 120-column scaling, search terminal output, and scroll through large output without UI stalls.

### Tests for User Story 7

- [ ] T072 [P] [US7] Add frontend unit tests for terminal scaling calculations in `frontend/tests/unit/terminal-scaling.test.ts`
- [ ] T073 [P] [US7] Add frontend integration test for search and scroll behavior in `frontend/tests/integration/terminal-display.test.tsx`

### Implementation for User Story 7

- [ ] T074 [US7] Implement fixed 120-column scaling helper in `frontend/src/terminal/scaling.ts`
- [ ] T075 [US7] Integrate scaling helper into terminal view in `frontend/src/terminal/TerminalView.tsx`
- [ ] T076 [US7] Implement terminal search UI in `frontend/src/components/TerminalSearch.tsx`
- [ ] T077 [US7] Optimize terminal output append and scroll handling in `frontend/src/terminal/outputRenderer.ts`

**Checkpoint**: Display consistency is validated without altering backend PTY behavior.

---

## Phase 10: User Story 8 - Agent Team collaboration visualization (Priority: P3)

**Goal**: Users can identify and switch between multiple Claude-related teammate panes or tabs when available.

**Independent Test**: Simulate multiple teammate sessions, display them as tabs or panes, switch focus, and deep-link to the relevant instance.

### Tests for User Story 8

- [ ] T078 [P] [US8] Add unit tests for teammate session detection mapping in `backend/tests/unit/team-detection.test.ts`
- [ ] T079 [P] [US8] Add frontend integration test for team tabs and deep-link behavior in `frontend/tests/integration/team-visualization.test.tsx`

### Implementation for User Story 8

- [ ] T080 [US8] Implement teammate session detector boundary in `backend/src/sessions/team-detector.ts`
- [ ] T081 [US8] Extend instance metadata with teammate grouping in `shared/protocol/domain.ts`
- [ ] T082 [US8] Implement team tab and pane UI in `frontend/src/components/TeamWorkspace.tsx`
- [ ] T083 [US8] Implement instance deep-link routing in `frontend/src/pages/App.tsx`

**Checkpoint**: Team visualization is isolated from MVP terminal transport and can be enabled later.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Validate security, performance, docs, and phase readiness.

- [ ] T084 [P] Add security tests for revoked devices, expired pairing codes, and token hash verification in `backend/tests/security/auth-security.test.ts`
- [ ] T085 [P] Add performance test for output streaming and 1MB ring buffer behavior in `backend/tests/performance/output-streaming.test.ts`
- [ ] T086 Run quickstart scenario validation and record results in `specs/001-remote-terminal/quickstart.md`
- [ ] T087 Verify coverage for core backend modules and frontend protocol modules in `vitest.config.ts`
- [ ] T088 Audit production WSS/TLS configuration guidance in `backend/src/config.ts`
- [ ] T089 Review spec-kit artifacts for consistency with implementation in `specs/001-remote-terminal/`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup; blocks all user stories.
- User Stories (Phase 3+): Depend on Foundational completion.
- Polish: Depends on all desired stories for the current release scope.

### User Story Dependencies

- US1 (P1 MVP): Starts after Foundational; no dependency on other stories.
- US2 (P1): Starts after Foundational; integrates with US1 terminal session but remains independently testable.
- US3 (P2): Starts after Foundational; benefits from US1 event stream.
- US4 (P2): Starts after Foundational; can be implemented after or alongside US3.
- US5 (P2): Depends on input queue foundation and should follow US2.
- US6 (P3): Frontend-focused; should follow US2.
- US7 (P3): Frontend-focused; should follow US1.
- US8 (P3): Should follow US4 instance metadata.

### Within Each User Story

- Tests must be written first and fail before implementation.
- Shared protocol changes before backend/frontend consumers.
- Models and repositories before services.
- Services before API handlers and UI integration.
- Story checkpoint must pass before moving to the next priority story.

### Parallel Opportunities

- T003, T004, and T005 can run in parallel after T002.
- Contract and unit tests within each story can run in parallel.
- Frontend UI tasks and backend service tasks can run in parallel when they use stable shared protocol types.
- P3 stories can be deferred without blocking MVP delivery.

---

## Parallel Example: User Story 1

```bash
# Tests can be created in parallel:
Task: "T021 auth-pairing contract tests"
Task: "T022 websocket protocol contract tests"
Task: "T023 output buffer unit tests"
Task: "T024 remote terminal integration test"

# After protocol and auth contracts are stable, UI and backend implementation can proceed in parallel:
Task: "T028 node-pty adapter"
Task: "T032 pairing screen"
Task: "T033 terminal view"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational infrastructure.
3. Complete Phase 3 US1.
4. Complete Phase 4 US2.
5. Stop and validate remote terminal, input reliability, and reconnect recovery through quickstart scenarios.

### Incremental Delivery

1. Deliver US1 + US2 as the remote terminal MVP.
2. Add P2 stories for notifications, device/instance management, and multi-client coordination.
3. Add P3 stories for mobile optimization, display polish, and Agent Team visualization.
4. Validate each story independently before promoting through `develop` → `test` → `main`.

### Commit Strategy

- Keep commits aligned to one functional point or one task group with a single rollback reason.
- Merge feature work to `develop` through PRs.
- Promote `develop` to `test` through PR for validation.
- Promote `test` to `main` through PR after phase validation.
