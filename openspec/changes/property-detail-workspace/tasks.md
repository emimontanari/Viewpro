# Tasks: Property detail workspace

- [x] **RED — stable targets:** Add behavior-first tests proving the four group links resolve to unique existing target IDs; fail when a link is missing, malformed, or targets absent content. Cover property data/images as a real destination and preserve `/edit` as the edit affordance (no inline-edit expectation).
- [x] **RED — authority/state:** Cover manager versus seller owner/agent management gates, seller viewing and existing status-request/document actions, and archived-property behavior before adding navigation; assert no new operation/permission path.
- [x] **GREEN — navigation:** Implement minimal same-page semantic link navigation and stable anchors in the existing detail rendering, reusing components. Keep groups visible on narrow/wide layouts, keyboard-operable, and preserve `/edit`, list return, and edit save/cancel destinations. No hidden tabs, API, mutation, permission, or inline editing changes.
- [x] Run focused tests, then applicable typecheck and lint; record exact commands and outcomes. Do not claim unavailable checks passed.
- [x] When local fixture environment is available, browser-check desktop/mobile and keyboard navigation, then existing edit/save/cancel/list-return flows. Record unavailable fixture/browser checks honestly.
- [ ] Final diff/readback and native RDD: report additions plus deletions against the 400-line ceiling, exact candidate, test evidence, remaining unavailable checks, and review focus; do not implement if forecast exceeds the limit without splitting/approval.
