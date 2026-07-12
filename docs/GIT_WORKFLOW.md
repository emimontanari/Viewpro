# Git Workflow — ViewPro / InmoView

How we branch, integrate, release, and hotfix once real users are on production.
Simple by design: two long-lived branches + short feature branches. No full
GitFlow ceremony.

## Mental model

- **`main` = production.** Real clients live here. Never touch it without certainty.
- **`develop` = staging / integration.** The "model apartment" — break and test
  finishes here before replicating them in the client's real one.

**Golden rule:** nothing reaches `main` without passing (and working) on
`develop` first. The only exception is an emergency hotfix.

## Branch types

| Branch | Purpose | Branches from | Merges back to |
|---|---|---|---|
| `main` | Production (clients) | — | — |
| `develop` | Staging / integration | — | — |
| `feat/<name>` | A new feature | `develop` | `develop` |
| `fix/<name>` | Non-urgent bug fix | `develop` | `develop` |
| `hotfix/<name>` | Urgent production fix | **`main`** | `main` **and** `develop` |

Branch naming: `feat/property-search`, `fix/seguimiento-filter`,
`hotfix/login-500`. Lowercase, kebab-case, descriptive.

## Everyday flow (a feature)

```bash
git checkout develop && git pull
git checkout -b feat/mi-feature
# work, commit (conventional commits)
git push -u origin feat/mi-feature
# open a PR -> develop, review, merge
```

Merging to `develop` auto-deploys to **staging** (`demo.inmoview.app`). Test it
there before promoting.

## Release (develop -> production)

When a batch of features is tested and ready on staging:

```bash
# open a PR: develop -> main, review, merge
# merging main auto-deploys to PRODUCTION
git checkout main && git pull
git tag v1.1.0        # bump from the previous tag
git push origin v1.1.0
```

Every production release gets a **tag**. The tag is the rollback anchor: if a
release breaks, redeploy the previous tag.

## Hotfix (production is broken, cannot wait)

```bash
git checkout main && git pull
git checkout -b hotfix/login-500
# minimal fix, commit
git push -u origin hotfix/login-500
# PR -> main, merge -> deploys to prod immediately
git tag v1.1.1 && git push origin v1.1.1
# CRITICAL: bring the fix back into develop so the next release doesn't undo it
git checkout develop && git pull
git merge main && git push
```

The last step (merge `main` back into `develop`) is the one people forget. Skip
it and the next release re-breaks what you just fixed.

## Safety nets (because there are users now)

1. **Branch protection** on `main` and `develop`: no direct pushes, changes go
   through PRs, no force-pushes, no branch deletion.
2. **Tag every production release** (`v1.0.0`, `v1.1.0`, ...): rollback =
   redeploy the previous tag.
3. **Never `git push --force`** to `main` or `develop`.
4. **Test on staging** (`develop` -> `demo.inmoview.app`) before promoting to
   `main`.

## Versioning

Semantic-ish: `vMAJOR.MINOR.PATCH`.
- **PATCH** (`v1.0.1`) — hotfix / small fix.
- **MINOR** (`v1.1.0`) — new features (normal release).
- **MAJOR** (`v2.0.0`) — big breaking change.

## Deploy wiring

| Branch | Environment | Deploy |
|---|---|---|
| `develop` | Staging / demo | `demo.inmoview.app` (Dokploy autoDeploy on push) + Vercel |
| `main` | Production | `app.inmoview.app` / `api.inmoview.app` — wired during production hardening (Track 1) |

## Repo layout note

Git, `openspec/` (SDD planning), and `docs/` live at the repo root (`Viewpro/`).
Application code lives in `viewpro-app/`. SDD/planning work happens at the root;
code work happens in `viewpro-app/`.
