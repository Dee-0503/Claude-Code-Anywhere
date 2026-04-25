# GitHub Repository Workflow

## Purpose

Keep the repository safe for team-scale collaboration: small reversible commits, protected main branch, and PR-based integration.

## Branching

- `main` is protected and must always be releasable.
- `develop` is the integration branch: it collects completed `feature/*` work for joint testing and phase-level self-checks, but does not represent production stability.
- `feature/*` branches are individual work branches: branch from `develop`, keep scope to one independent feature point, fix, or documentation change, then merge back to `develop` through PR.
- `test` is the validation/staging branch: promote from `develop` through PR when a release candidate is ready for acceptance testing.
- All merges into `main` must happen through PRs from `test`, `hotfix/*`, or explicitly approved release branches.
- `hotfix/*` branches are created from `main` for urgent production fixes, then merged back to both `main` and `develop` through PRs.
- All feature, fix, refactor, and documentation work happens on topic branches.
- Branch naming should communicate scope, for example:
  - `feature/<short-name>`
  - `fix/<short-name>`
  - `hotfix/<short-name>`
  - `docs/<short-name>`
  - spec-kit feature branches such as `001-remote-terminal` are valid and should be treated as feature branches unless explicitly promoted.

Recommended promotion flow:

```text
develop
  └── feature/remote-terminal-auth
          ↓ PR
develop
          ↓ PR
test
          ↓ PR
main
```

## Commit Rhythm

- Prefer one functional point per commit.
- Do not bundle unrelated changes in the same commit.
- Commit when the change forms a coherent, reviewable, and reversible unit.
- Avoid huge end-of-phase commits; they make rollback and review difficult.
- Do not commit generated noise, secrets, local settings, or unrelated formatting churn.

## Pull Requests

- Every merge into `main` must go through a Pull Request.
- Do not push directly to `main`.
- PR scope should usually match one complete user story (US) or another independently testable spec-kit increment.
- Keep commits inside the PR at functional-point granularity so review and rollback can target the smallest coherent change.
- If foundational work is large or blocks multiple user stories, split it into a separate foundational PR before story-level PRs.
- When a later US depends on an unmerged earlier PR, use a stacked PR: create the later US branch from the earlier PR head, open the later PR against that head branch, then after the earlier PR merges, rebase the later branch onto `develop` and retarget the later PR to `develop`.
- PRs should describe the intent, scope, test evidence, and any known risks.
- Keep PRs focused. Split when rollback or review ownership would otherwise be unclear.
- Before requesting merge, run the relevant spec-kit validation/checklist for the current phase.

## Review and Merge

- Merge only after required checks pass and review feedback is resolved.
- Prefer squash or merge strategy according to repository settings; do not bypass branch protection.
- If a PR contains multiple independent functional points, consider splitting before merge.

## Release/Phase Gate

At the end of each phase, verify:

- `main` has no direct commits bypassing PRs.
- `develop`, `test`, and active `hotfix/*` branches follow PR-based promotion and back-merge rules.
- Feature branches are either merged through PRs or intentionally retained.
- Each feature point has traceable commits and PR discussion.
- Spec-kit artifacts remain consistent with implementation state.
