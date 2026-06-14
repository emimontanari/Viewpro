# Proposal — Stage 23.5 Owner Contact CTA Semantics and Priority Proof

**Status:** proposed, no product decision required.
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-6, manual demo walkthrough 2026-06-13.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase B, slice B4.

## Slice contract

```txt
Stage: 23
Slice: 23.5 — Owner contact CTA semantics and priority proof
Objective: align owner contact buttons with meeting decision and prove deterministic WhatsApp routing.
Evidence needed: Cuenta Madre phone, seller phone, missing phone no-config state, click tracking, and WhatsApp URL/message tests.
Do not touch: WhatsApp Business API, bots, automated reminders, chat inbox.
Done: `Contactar inmobiliaria` routes to the tenant/Cuenta Madre contact; seller contact remains separate and safe.
Next slice: Stage 24.5 or Phase B5 next.
```

## Findings to fix

- Owner movement timeline renders movement-level actions as `Contacto no configurado` even when seller WhatsApp data exists for the assigned seller.
- Property-level `Contactar inmobiliaria` already resolves to tenant WhatsApp `+5493510000000` per audit and stays correct.
- Click-tracking proof for owner contact is partial.

## Out of scope

WhatsApp Business API, automated reminders, chat inboxes, message templates, or any sender-side messaging integration.

## Dependency

Runs after `23.3` and `23.4` because tenant and seller phone configuration must be operationally editable before priority proof.

## Next phases

Move to SDD `sdd-spec` once Phase B reaches B3.
