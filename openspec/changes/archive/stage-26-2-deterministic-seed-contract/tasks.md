# Tasks — Stage 26.2 Deterministic Seed Contract

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–800 total; split recommended |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 seed contract core → PR 2 seeded smoke proof/docs |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Tasks

- [x] RED — Confirm current seed gaps: no admin persona, notifications, deterministic image contract, fixed date contract, or Stage 26.2 smoke proof.
- [x] GREEN — Add deterministic seed contract data: admin user, tenant limits, fixed seed clock, seller contact phone, local generated images, notifications, and admin audit events.
- [x] GREEN — Extend seeded smoke with focused assertions for notifications/read-unread, safe links, owner contact paths, admin tenant limits, and images.
- [x] TRIANGULATE — Preserve production safety guards and avoid product feature/scope changes.
- [x] REFACTOR — Keep Stage 26.2 focused on seed contract; leave full choreography to Stage 26.3.
- [x] VERIFY — Run seed and seeded E2E against a local Postgres database; passed.

## Acceptance

- [x] Seed defines stable demo personas including ViewPro admin.
- [x] Seed creates deterministic images, tenant limits, notifications, contact fixtures, and admin audit evidence.
- [x] Seed summary logs the contract without leaking env-provided passwords.
- [x] Seeded smoke contains focused Stage 26.2 contract assertions.
- [x] Production data behavior is not changed.
- [x] `pnpm demo:seed` and `test:seeded` pass against a migrated local/dev database.
