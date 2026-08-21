# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Completed: 2/15 tasks (WU1/WU2 history only).
- Current work unit: WU3 remains unchecked and pending this corrected planning review; WU4–WU7 remain unchanged and sequentially blocked.
- Delivery: `sequential-to-develop`; planning base is `0df5519`. After the planning PR, WU3 requires a fresh clean worktree and explicit reset/acquire approval. No implementation, completion, or pass claim is recorded.

## Completed Foundation History

- [x] 1.1 **WU1:** RED→GREEN platform-sync/tenant/platform-data evidence, visible render, zero-I/O idle receipt; reviewed `develop` merge `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`.
- [x] 1.2 **WU2:** #347 implementation merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f` and exact remediation-manifest closure. `3212c43…` is closure metadata only, never a runtime patch or base.

## WU3 Failure History and Pending Work

- Production reconstruction remains the original prefix `main@868dc70` + #331/#333/#334/#335/#336 + reviewed WU1/WU2 + future reviewed WU3–WU7 patches. #338/#341/#344/#351 remain excluded; normal `develop` history is retained.
- Attempt 5 remains terminal failed with full evidence `sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`; preserve it as negative evidence.
- Attempt 6 remains terminal failed with full evidence `sha256:666da4d8ae325d2c0ef01351db0ecb8b05bad374d1b3c794d9f6ae25f02d27f3`; its 307-line diff is non-mergeable negative evidence and MUST NOT be copied or salvaged. Deterministic attacks included child-lifetime source swap, post-validation config/alternates injection, `core.trustctime=false` same-size+mtime dirtiness bypass, and post-cleanliness mutation.
- Maintainer correction restores issue #340’s single WU3 scope. Do not add snapshot A/B/C tasks, capabilities, descriptors, or authority; the operator-controlled disposable worktree is a precondition, followed by post-WU7 provisional assembly and independent reassembly/digest verification.
- **WU3 pending:** Create the candidate config/tool/spec, closed release-manifest schema, and intentionally unpopulated template at the design’s exact paths. Cover exact identity/order, final-tree classifier, closed manifests, bounded subprocess failure, RED-CUT-01–04, and additive CI only; forecast 330–350, pause before >350, hard 390 with no over-350 approval.

## Authority and Native Admission

- No proposal/spec amendment is made. These planning artifacts create no candidate, populated manifest, provider, runtime, deployment, traffic, or production authority.
- No native reset, acquire, or settle occurs in this planning phase. After the planning PR merges, a fresh clean WU3 worktree and explicit maintainer phase approval are required before reset/acquire; settlement remains gated by strict TDD, fresh three-lens review, and final evidence.

## Remaining Work

- [ ] 2.1 WU3 — planning review/PR, then fresh clean worktree and explicit reset/acquire approval.
- [ ] 2.2 WU4 — blocked on reviewed/merged WU3, then review/green CI/merge/fetch/overlap audit.
- [ ] 3.1 WU5; [ ] 3.2 WU6; [ ] 4.1 WU7 — sequentially blocked on the preceding reviewed merge.

## Next Action

Next action: planning review/PR only. After it merges, create the fresh clean WU3 worktree and obtain explicit maintainer phase approval before reset/acquire. No provider, application, source, test, package, lock, CI, or production mutation is authorized here.
