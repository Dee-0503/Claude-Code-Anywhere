# GitHub Repository Workflow

## Purpose

Keep the repository safe for team-scale collaboration: small reversible commits, protected main branch, and PR-based integration.

## Branching

- `main` is protected and must always be releasable.
- `develop` is the integration branch: it collects completed spec-kit and topic-branch work for joint testing and phase-level self-checks, but does not represent production stability.
- Spec-kit feature branches such as `001-remote-terminal` are authoritative long-lived feature branches for their spec. Keep spec-kit implementation state on the `001-xxx` branch unless the branch is explicitly promoted or retired.
- Short-lived review branches may be created for user-story PRs, but they must preserve the spec identity in the branch name, for example `001-remote-terminal-us1`, `001-remote-terminal-us2`, or `review/001-remote-terminal-us2`.
- Avoid generic `feature/*` branches for spec-kit work when a `001-xxx` branch already exists; they obscure the authoritative implementation line and make stacked PR history harder to audit.
- `feature/*`, `fix/*`, `docs/*`, and other topic branches are for non-spec-kit work or work that has no active `001-xxx` branch. Branch from `develop`, keep scope to one independent feature point, fix, or documentation change, then merge back to `develop` through PR.
- `test` is the validation/staging branch: promote from `develop` through PR when a release candidate is ready for acceptance testing.
- All merges into `main` must happen through PRs from `test`, `hotfix/*`, or explicitly approved release branches.
- `hotfix/*` branches are created from `main` for urgent production fixes, then merged back to both `main` and `develop` through PRs.
- All feature, fix, refactor, and documentation work happens on topic branches.
- Branch naming should communicate scope, for example:
  - `001-remote-terminal` for the authoritative spec-kit branch
  - `001-remote-terminal-us1` or `review/001-remote-terminal-us1` for short-lived spec-kit review branches
  - `feature/<short-name>` for non-spec feature work
  - `fix/<short-name>`
  - `hotfix/<short-name>`
  - `docs/<short-name>`

Recommended promotion flow:

```text
001-remote-terminal
  └── 001-remote-terminal-us1
          ↓ PR
develop
          ↓ sync/rebase
001-remote-terminal
  └── 001-remote-terminal-us2
          ↓ PR
develop
          ↓ PR
test
          ↓ PR
main
```

## Branch Protection Expectations

- `main` uses strict protection: PR review required, stale reviews dismissed, conversation resolution required, linear history required, force-push/deletion disabled, and admins are also enforced.
- `develop` is a lower-friction integration branch: repository owners may merge after validation evidence is present; branch protection may be relaxed to support stacked PR integration and rapid phase-level testing.
- `test` keeps release-like protection strength: PR review required, stale reviews dismissed, conversation resolution required, linear history required, force-push/deletion disabled, and admins are also enforced because it gates promotion to `main`.

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
- For spec-kit work, open review PRs from short-lived `001-xxx-usN` or `review/001-xxx-usN` branches, and keep the authoritative implementation line on the matching `001-xxx` branch.
- Delete or stop using short-lived review branches after merge. Never continue pushing new commits to an already-merged PR branch; create a new spec-scoped review branch instead.
- Workflow or repository-rule changes must use their own docs branch/PR and must not be bundled into user-story implementation PRs.
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
