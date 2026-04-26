# Claude Code Anywhere Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-25

## Active Technologies
- TypeScript on Node.js 20+ using ESM + node-pty, ws, xterm.js, better-sqlite3, bcrypt/argon2-compatible password hashing, browser WebSocket APIs (001-remote-terminal)
- SQLite for devices, pairings, sessions, input acknowledgements, and notification state; in-memory bounded output ring buffers with persistent offsets for recovery (001-remote-terminal)

[EXTRACTED FROM ALL PLAN.MD FILES]

## Project Structure

```text
[ACTUAL STRUCTURE FROM PLANS]
```

## Commands

[ONLY COMMANDS FOR ACTIVE TECHNOLOGIES]

## Code Style

[LANGUAGE-SPECIFIC, ONLY FOR LANGUAGES IN USE]

## Recent Changes
- 001-remote-terminal: Added TypeScript on Node.js 20+ using ESM + node-pty, ws, xterm.js, better-sqlite3, bcrypt/argon2-compatible password hashing, browser WebSocket APIs

[LAST 3 FEATURES AND WHAT THEY ADDED]

<!-- MANUAL ADDITIONS START -->
## Repository Workflow

GitHub repo operations must follow protected-main, PR-only integration, and one-functional-point-per-commit discipline.

→ @.claude/rules/github-repository-workflow.md

## Development Flow

Spec-kit is the primary workflow; implementation constraints such as TDD are execution details, not separate process tracks. Report progress by spec-kit phase and task ID.

When a functional point is completed and verified, create a focused commit for that functional point before moving too far ahead; avoid large end-of-phase commits that are hard to review or roll back.

## PR Review Communication

Review feedback must be posted directly as ordinary PR comments after review; do not first provide a suggested comment in chat unless the user explicitly asks for a preview. After addressing feedback, the submitter must reply in the PR comments with the fix summary, commit reference, and fresh validation evidence before requesting re-review.
<!-- MANUAL ADDITIONS END -->
