# Proposal — Stage 21.7 Minimal Transactional Invitation Email Delivery

**Status:** proposed, awaiting product decision D2 (manual copy-link vs real email for beta).
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-5.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase D, slice D1s.

## Slice contract

```txt
Stage: 21
Slice: 21.7 — Minimal transactional invitation email delivery
Objective: if approved, send real owner/team invitation emails while preserving manual copy-link fallback.
Evidence needed: provider env docs, mocked provider tests, failure behavior, staging smoke or delivery proof.
Do not touch: marketing campaigns, password reset, full email verification, social auth.
Done: beta users can receive invitation emails without developer DB/support intervention.
Next slice: Stage 26.5 deploy checklist.
```

## Open product decision (D2)

Is manual copy-link acceptable for beta invitation onboarding, or must transactional email delivery ship now?

- If D2 = email must ship: P0, runs in Phase D. Scope is limited to invitation emails (owner + team), not reset/verification/marketing.
- If D2 = copy-link OK: slice moves to backlog. Manual flow remains the documented beta path.

## Out of scope

Password reset emails, email verification flows, social auth, marketing campaigns, transactional email for non-invitation flows, multi-provider abstraction.

## Provider considerations to surface during SDD

- Provider choice (SES, Resend, Postmark, SMTP) is a deploy-time decision; the slice must accept any provider via interface.
- Failure must not break invitation creation; copy-link remains the safe fallback.
- Env vars and provider keys must follow the `26.5` deploy checklist conventions.

## Next phases

Move to SDD `sdd-explore` once D2 is recorded and the answer is `email must ship`.
