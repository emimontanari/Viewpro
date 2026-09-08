# U11B exploration — approval replay split

- Skill resolution: `paths-injected` (`gentle-ai`). Parent selected `seller-property-proposals` OpenSpec apply-ready, repo-local U11B1 at fresh `develop` `2d0db052`; no ambient status is used.
- Preflight is auto / OpenSpec / ask-on-risk / 400 lines. U11B's former combined scope exceeds 400, so the accepted work is split without changing product behavior.

## Accepted replay decision

1. Lock proposal, acquire the tenant lease even for replay, then lock sorted reviewer/proposer identities.
2. Revalidate active reviewer manager/principal-manager role and capability, then deny durable proposer self-review before replay.
3. Read the latest round/decision and classify a replay only for `APROBADA`, exact round, same reviewer, `APPROVED`, and exactly one same-tenant source engagement.
4. An authorized exact replay returns the raw durable approved proposal without calling quota assertion, materializer, decision create, or proposal update. Proposer inactivity or role change after approval does not invalidate that replay.
5. A different reviewer, stale round, rejected/missing decision, missing source, or cross-tenant source conflicts with 409 and writes nothing. New approval alone checks proposer eligibility and quota before materialization.

## Delivery split

- **U11B1 (this slice):** helper, approval use case, and focused replay/approval/quota specs; no barriers, race clients, or transport. Forecast: ≤400 total physical lines including OpenSpec closure.
- **U11B2:** same-proposal approval/approval and approval/rejection PostgreSQL lock proof.
- **U11B3:** final-slot approval/approval and approval/direct-create/restore proof.
- U12 remains verification-only. Canonical result visibility remains U10B/U13 authorization work and is not bypassed here.
