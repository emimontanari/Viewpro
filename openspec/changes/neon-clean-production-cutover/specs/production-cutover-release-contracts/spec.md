# Production Cutover Release Contracts
## Requirements
- Release validation MUST parse closed duplicate-free JSON through captured intrinsics, reject transparent or revoked proxies before reflection, and validate exact ordered WU1–WU7 records with WU1/WU2 reviewed identities and receipts.
- Each root and closure MUST have the exact Lineage prefix `main@868dc70`, `#331`, `#333`, `#334`, `#335`, `#336`; its final is that prefix followed by the same ordered identities.
- The committed schema/template are unpopulated `external-only`; this pure validator grants no repository, Git, process, network, provider, deployment, promotion, traffic, release, or final-WU3 authority.
## Scenarios
- GIVEN valid recursively identical prefixed contracts WHEN validated THEN they pass deterministically.
- GIVEN malformed, duplicate, reordered, retargeted, unknown, authority-shaped, proxy, or poisoned-intrinsic input WHEN validated THEN it fails closed.
- GIVEN the committed template WHEN inspected THEN it is unpopulated and non-authoritative.
