# Phase 0 Research: Remote Terminal

## Decision: TypeScript/Node.js backend with browser frontend

**Rationale**: Claude Code sessions are naturally hosted from a local developer environment, and Node.js provides mature PTY, WebSocket, SQLite, and web tooling. TypeScript shared types reduce protocol drift between backend and frontend.

**Alternatives considered**: Go would provide strong binaries and concurrency but adds friction for xterm.js/web shared contracts. Python has PTY libraries but weaker browser protocol sharing and packaging ergonomics for this product.

## Decision: node-pty for Claude Code process hosting

**Rationale**: The product must preserve terminal semantics rather than reinterpret Claude Code output. node-pty provides PTY behavior, ANSI/TUI compatibility, resize control, and stdin/stdout streams suitable for xterm.js.

**Alternatives considered**: `child_process.spawn` cannot accurately preserve interactive terminal behavior. Rebuilding Claude Code as API/chat output violates the terminal-first constitution.

## Decision: WebSocket protocol with offset-based replay

**Rationale**: Terminal output and user input are bidirectional, ordered, and latency-sensitive. WebSocket is the simplest fit. Monotonic output offsets allow clients to reconnect and request replay from the last acknowledged offset.

**Alternatives considered**: Server-Sent Events do not support bidirectional input. Polling adds latency and complicates replay. WebRTC is unnecessary for MVP complexity.

## Decision: xterm.js as canonical terminal renderer

**Rationale**: xterm.js is purpose-built for browser terminal rendering, including ANSI escape sequences, alternate screen, cursor behavior, and TUI output.

**Alternatives considered**: DOM-based rendering or markdown conversion would break TUI fidelity and create unacceptable divergence from Claude Code's native terminal behavior.

## Decision: SQLite for local metadata persistence

**Rationale**: The product is local-first for Phase 1. SQLite keeps deployment simple while supporting durable device pairing, session metadata, input acknowledgements, and notification state.

**Alternatives considered**: PostgreSQL is unnecessary for single-host MVP. File-only JSON persistence would make transactional token/session updates and recovery harder.

## Decision: 1MB bounded ring buffer per active instance

**Rationale**: Reconnect recovery needs recent output history without unbounded memory growth. A bounded buffer plus monotonic offsets supports replay and explicit `output_gap` signaling when history is no longer available.

**Alternatives considered**: Infinite transcript storage is unsafe and unnecessary for MVP. No buffer would make reconnect unreliable.

## Decision: pairing code with hashed verification material and administrator ownership

**Rationale**: Remote access must be explicit and revocable. Pairing codes support simple onboarding; hashed verifier/token material protects local storage; single-administrator ownership gives clear authority for creating/revoking device access.

**Alternatives considered**: Passwordless open LAN discovery is unsafe. Full OAuth is excessive for local-first MVP and does not solve local device trust by itself.

## Decision: Vitest preferred for TypeScript tests, final runner selected during setup

**Rationale**: Vitest integrates well with TypeScript ESM and browser-adjacent packages. If the implementation avoids bundler-specific behavior, Node's built-in test runner remains a simpler alternative.

**Alternatives considered**: Jest is mature but heavier for ESM projects and may require more transform configuration.
