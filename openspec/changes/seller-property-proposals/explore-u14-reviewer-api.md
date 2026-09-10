# U14A1 reviewer list-only exploration

- Scope is the reviewer collection read only; `get-property-proposal-review` and its spec stay exactly at `HEAD`.
- Keep the C7 reviewer role/capability gate and current trusted tenant context before any repository read.
- Preserve C7 filter, count, pagination, and `COALESCE(latestSubmittedAt, createdAt) DESC, id DESC` ordering.
- Hydrate the page's rounds, canonical result rows, and proposer identities in one tenant-scoped batch each; no N+1 query or direct source field reaches transport.
- A proposer missing current tenant membership must not remove the tenant-scoped proposal row.
- The public response is a literal summary: proposal ID/state/version/title/timestamps, optional current-round/result IDs, and proposer ID/name only.
- U14A2 owns detail/history; U14B owns DTO/controller/module/static routes; U14C owns HTTP E2E.
