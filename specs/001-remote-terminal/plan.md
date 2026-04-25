# Implementation Plan: Remote Terminal

**Branch**: `001-remote-terminal` | **Date**: 2026-04-25 | **Spec**: `specs/001-remote-terminal/spec.md`
**Input**: Feature specification from `/specs/001-remote-terminal/spec.md`

## Summary

Build Claude Code Anywhere as a terminal-first remote access system for Claude Code PTY sessions. The MVP focuses on secure device pairing, PTY session hosting, WebSocket-based terminal streaming, xterm.js rendering, input acknowledgement, and reconnect recovery with offset-based output replay.

## Technical Context

**Language/Version**: TypeScript on Node.js 20+ using ESM  
**Primary Dependencies**: node-pty, ws, xterm.js, better-sqlite3, bcrypt/argon2-compatible password hashing, browser WebSocket APIs  
**Storage**: SQLite for devices, pairings, sessions, input acknowledgements, and notification state; in-memory bounded output ring buffers with persistent offsets for recovery  
**Testing**: TypeScript test runner to be finalized during setup; Vitest is the preferred default unless the implementation stack chooses Node's built-in test runner  
**Target Platform**: Local Node.js host running Claude Code sessions plus browser client; later phases may add desktop and mobile clients  
**Project Type**: Web application with backend service, browser frontend, and shared protocol types  
**Performance Goals**: Stream terminal output with perceived latency under 200ms on normal networks; reconnect without losing buffered output; preserve xterm.js rendering fidelity for ANSI/TUI content  
**Constraints**: Fixed 120-column terminal model, 1MB bounded output ring buffer per active instance, WSS/TLS for production access, pairing-code based authorization, FIFO input arbitration, idempotent input messages  
**Scale/Scope**: Phase 1 supports one local server with multiple paired devices and multiple Claude Code instances; V2/V3 extend collaboration, notifications, mobile optimization, and Agent Team visualization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- PASS: Terminal-first architecture preserves PTY semantics instead of translating Claude Code into chat UI.
- PASS: xterm.js is the canonical browser renderer for ANSI/TUI output.
- PASS: Plan keeps fixed 120-column layout and client-side scaling as a core constraint.
- PASS: Reliable connection design includes WebSocket state, heartbeat, reconnect, offset replay, and `output_gap` handling.
- PASS: Input protocol requires unique message IDs, ACK, retry, de-duplication, and FIFO arbitration.
- PASS: Security model uses pairing codes, hashed credentials/tokens, single administrator semantics, and WSS/TLS in production.
- PASS: Notification design is priority-based and explicitly separated from terminal transport.
- PASS: Delivery is phase-gated: MVP remote terminal first, collaboration/mobile/team visibility later.

No constitution violations are introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-remote-terminal/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   ├── auth/
│   ├── db/
│   ├── pty/
│   ├── protocol/
│   ├── sessions/
│   └── notifications/
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

frontend/
├── src/
│   ├── components/
│   ├── terminal/
│   ├── protocol/
│   ├── pages/
│   └── services/
└── tests/
    ├── integration/
    └── unit/

shared/
└── protocol/
    ├── messages.ts
    └── errors.ts
```

**Structure Decision**: Use a web application structure with separate backend, frontend, and shared protocol package. This keeps PTY/server authority isolated from browser rendering while preventing protocol drift between client and server.

## Complexity Tracking

No constitution gate violations require complexity justification.
