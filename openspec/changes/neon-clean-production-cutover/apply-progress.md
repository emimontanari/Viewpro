# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Completed: 2/16 tasks. WU1 and WU2 are the only completed tasks; all 14 remaining tasks remain unchecked in the task plan.
- Design gate passed and the 16-task plan is generated. This planning branch has no implementation authority.
- Delivery remains `sequential-to-develop`. No active native attempt or objective exists; `decision_required: false` and `next_action: begin`. Neither approved WU3 successor has been acquired.

## Completed Foundation History

- [x] 1.1 **WU1:** RED→GREEN platform-sync/tenant/platform-data evidence, visible render, zero-I/O idle receipt; reviewed `develop` merge `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`.
- [x] 1.2 **WU2:** #347 implementation merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f` and exact remediation-manifest closure. `3212c43…` is closure metadata only, never a runtime patch or base.

## WU3 Historical Failure Evidence

- Production reconstruction remains the original prefix `main@868dc70` + #331/#333/#334/#335/#336 + reviewed WU1/WU2 + future reviewed WU3–WU7 patches. #338/#341/#344/#351 remain excluded; normal `develop` history is retained.
- Attempt 5 is terminal failed with full negative evidence `sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`.
- Attempt 6 is terminal failed with full negative evidence `sha256:666da4d8ae325d2c0ef01351db0ecb8b05bad374d1b3c794d9f6ae25f02d27f3`. Its 307-line diff is non-mergeable negative evidence and MUST NOT be copied or salvaged. Deterministic attacks included child-lifetime source swap, post-validation config/alternates injection, `core.trustctime=false` same-size-plus-mtime dirtiness bypass, and post-cleanliness mutation.
- Attempt 7 is terminal failed with exact evidence `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf`. The failed 229-line candidate remains preserved in `/Users/emimontanari/Work/Apps/Viewpro-worktrees/neon-clean-production-cutover-wu3-bounded`; it is historical negative evidence only. A coherent contract-complete correction forecast is 482 changed lines, above the former 350-line cap.

## Approved Two-Slice WU3 Plan

- The maintainer approved autonomous WU3 slices after attempt 7 failed. The old single-WU3 objective was reset successfully at native revision `sha256:2a94188f48f7cde972531306a952ae5724e808122fb4e787f6f8c8ae16441a50` from clean baseline `c78740b914aa0a2eebac56d286fdd10106cf9b7d`, identity `sha256:fa6a9345db57c2cb272d653d6559130ae865144e2a2eff7c165a018f78403ad5`, and tree `d4067821e79d085766606c81e37179a0bda25ae7`.
- **WU3-Contracts:** target 238, hard 260. It is next only after planning review/merge and explicit apply authorization. It cannot claim final WU3 identity or remediate the failed evidence.
- **WU3-Qualification:** target 244, hard 270. It depends on the reviewed WU3-Contracts merge and refreshed `develop`. Only its final closure may remediate `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf` and bind the single aggregate WU3 identity.
- WU4 remains blocked until both slices merge and the WU3 final closure passes. WU5–WU7 remain sequentially blocked after their preceding reviewed merge.

## Authority and Native Admission

- This synchronization records the maintainer-approved design/task amendments and historical progress. Proposal, specification, source, test, configuration, CI, native, and provider state remain untouched by the synchronization itself. Task-plan checkboxes remain untouched.
- No package, lockfile, provider, manifest, source, test, configuration, CI, runtime, deployment, traffic, or production authority is granted here.
- This synchronization performed no native reset, acquire, or settle. The read-only native status confirms the post-reset idle state recorded above; no successor may start without the stated planning and explicit apply gates.
- Exact delivery rollback ordering remains: Contracts alone before Qualification merges; afterward revert Qualification/CI, then Contracts. Any such rollback invalidates final WU3 closure and re-blocks WU4. Preserve attempts 5, 6, and 7 and the bounded worktree as historical evidence; never reset, acquire, settle, or remove that evidence as part of rollback.

## Remaining Work

- [ ] WU3-Contracts — planning review/merge, then explicit apply authorization before any native acquisition.
- [ ] WU3-Qualification — only after reviewed Contracts merge and refreshed `develop`; its closure is the sole eligible aggregate-WU3 identity and attempt-7 remediation boundary.
- [ ] WU4 — blocked until both WU3 slice merges and WU3 final closure pass.
- [ ] WU5–WU7 — remain sequentially blocked on the preceding reviewed merge.

## Next Action

Next action: planning review only. Do not begin WU3-Contracts until that review/merge completes and explicit apply authorization is granted. No provider, application, source, test, package, lockfile, CI, runtime, deployment, traffic, production, reset, acquire, or settle mutation is authorized by this artifact.
