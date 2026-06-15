# Spec — Stage 26.3 Full Seeded E2E

Proves the entire pilot workflow with automated Playwright seeded tests, closing audit gaps G-1 through G-7 that remain uncovered after the 13/13 baseline established by PRs #152–#159.

## Slice contract (verbatim from proposal)

```txt
Stage: 26
Slice: 26.3 — Full seeded E2E
Objective: prove the entire pilot workflow in one reproducible Playwright/seeded suite that exits clean.
Evidence needed: a single `pnpm --filter next-shadcn-dashboard-starter test:seeded` run that covers manager → seller → owner → property → Seguimiento → documents → notifications → WhatsApp → admin status/limits and exits green.
Do not touch: new product features, the 26.2 deterministic seed contract, the 26.2.1 image fixtures, the API 403 guard, or any unrelated UI.
Done: every audit-confirmed pilot flow is covered by an automated seeded test, the full Playwright suite runs in <2 minutes, and the suite is reproducible from a clean `pnpm demo:seed`.
Next slice: 26.4 — Security and isolation regression.
```

## Functional requirements

### G-1 — Manager creates a property engagement from scratch

| ID | Requirement | Audit row |
|----|------------|-----------|
| FR-1 | A PRINCIPAL_MANAGER or MANAGER user must be able to navigate to a "new property" entry point from the dashboard or property list. | Coverage matrix: "Manager creates/opens property engagement — PARTIAL" |
| FR-2 | Submitting the creation form with required fields must produce a new engagement that appears in the property list under the same tenant. | Same audit row |
| FR-3 | The newly created engagement must reflect the correct initial status and the creator as the responsible manager. | Same audit row |
| FR-4 | A seller assigned to that engagement (or not, if none is assigned at creation) must see or not see the property according to their assignment state. | Same audit row |

### G-2 — Manager assigns and unassigns a seller through the UI

| ID | Requirement | Audit row |
|----|------------|-----------|
| FR-5 | A manager must be able to open "Gestionar vendedores" on any property detail and add a seller who is not currently assigned. | Coverage matrix: "Manager assigns seller — PARTIAL" |
| FR-6 | After a seller is assigned, their product list API response must include the newly assigned property. | Same audit row |
| FR-7 | A manager must be able to remove an assignment from the same panel. After removal, the seller's product list must no longer include that property. | Same audit row |

### G-3 — Manager creates a plain movement without an outcome

| ID | Requirement | Audit row |
|----|------------|-----------|
| FR-8 | A manager or authorized user must be able to open the "Agregar actualización" dialog and submit a movement without selecting any outcome label. | Coverage matrix: "Manager creates movement/status update — PARTIAL" |
| FR-9 | The resulting movement item in the Seguimiento feed must not display an outcome chip. | Same audit row |
| FR-10 | The property engagement status must remain unchanged after a plain movement creation (extends the FR-11 invariant established by Test 10). | Same audit row |

### G-4 — Manager creates a document request through the UI

| ID | Requirement | Audit row |
|----|------------|-----------|
| FR-11 | A manager must be able to open an existing property detail and create a new document request by clicking "Solicitar documento" and filling the request form. | Coverage matrix: "Manager requests document — PARTIAL" |
| FR-12 | After submission the request must appear in the property's document list with status "Pendiente". | Same audit row |
| FR-13 | The owner associated with the property must receive a notification for the new request (verified via owner notification API). | Same audit row |

### G-5 — Manager rejects a submitted document

| ID | Requirement | Audit row |
|----|------------|-----------|
| FR-14 | A manager must be able to reject a submitted document request that has a document version in the UPLOADED state, optionally providing a rejection reason. | Coverage matrix: "Manager approves/rejects document — PARTIAL (approve only)" |
| FR-15 | After rejection the request must transition to "Rechazado" and display the rejection reason. | Same audit row |
| FR-16 | The owner must receive a notification for the rejection and be able to see the rejection reason and a re-upload action in their document view. | Same audit row |

### G-6 — Owner opens the WhatsApp contact link

| ID | Requirement | Audit row |
|----|------------|-----------|
| FR-17 | The owner portal must expose a WhatsApp contact link for an engagement whose contact is configured. | Coverage matrix: "WhatsApp contact configured or no-config state — PARTIAL" |
| FR-18 | The WhatsApp URL must contain the phone number matching the tenant or seller contact configuration for that engagement. | Same audit row; audit evidence row `Owner property contact — PASS` confirmed `contact.targetType = tenant` and `+5493510000000` |
| FR-19 | Clicking the contact link must produce an analytics tracking event (verified via tracking API response or analytics event in DB state). | Same audit row |

### G-7 — Tenant limit exceeded error surfaces in the UI

| ID | Requirement | Audit row |
|----|------------|-----------|
| FR-20 | When a manager attempts to create a property engagement that would exceed the tenant's `maxActivePropertyEngagements` limit, the UI must display a clear error message preventing the creation. | Coverage matrix: "Tenant suspended/limit behavior — PARTIAL" |
| FR-21 | The error state must not leave a partially created engagement in the database. | Same audit row |
| FR-22 | The UI must remain functional after the error (no crash, able to navigate away). | Same audit row |

## Acceptance scenarios

### S-1 — Manager creates a new engagement (G-1)

- **Given** the user is signed in as `demo@viewpro.local` (PRINCIPAL_MANAGER)
- **When** they navigate to the property creation entry point and fill the required fields with valid data, then submit
- **Then** the new engagement appears in the property list at `/dashboard/product`
- **And** the list count increases by one
- **And** the engagement detail page is reachable and shows the correct title and initial status

### S-2 — Newly created engagement is not visible to unassigned seller (G-1/G-2)

- **Given** the engagement from S-1 was created without assigning a seller
- **When** `martin.demo@viewpro.local` calls `/api/products?limit=50`
- **Then** the response does not include the new engagement

### S-3 — Manager assigns a seller through Gestionar vendedores (G-2)

- **Given** the user is signed in as `demo@viewpro.local` and is on the detail page of the engagement created in S-1
- **When** they open "Gestionar vendedores", select `martin.demo@viewpro.local`, and confirm
- **Then** `martin.demo@viewpro.local`'s product list API response includes the new engagement

### S-4 — Manager unassigns the seller (G-2)

- **Given** the seller from S-3 is currently assigned
- **When** the manager opens "Gestionar vendedores" on the same engagement and removes the assignment
- **Then** `martin.demo@viewpro.local`'s product list API response no longer includes the engagement

### S-5 — Manager creates a movement without an outcome (G-3)

- **Given** the user is signed in as `demo@viewpro.local` and is on any seeded property detail page
- **When** they click "Agregar actualización", fill only the observation field (no outcome selected), and save
- **Then** the new movement appears in the Seguimiento feed
- **And** no outcome chip is visible next to that movement entry
- **And** the engagement status returned by `/api/products/:id` is unchanged

### S-6 — Manager creates a document request (G-4)

- **Given** the user is signed in as `demo@viewpro.local` and is on the detail page for "Casa familiar con pileta en Villa Centenario" (property index 0, linked to `propietario.demo@viewpro.local`)
- **When** they click "Solicitar documento", fill in the request title and any required fields, and submit
- **Then** the document list for that property shows a new entry with status "Pendiente"
- **And** `/api/owner/notifications` for `propietario.demo@viewpro.local` includes a `DOCUMENT_REQUESTED` notification for this property

### S-7 — Manager rejects an uploaded document (G-5)

- **Given** the user is signed in as `demo@viewpro.local` and is on the detail page for "Casa familiar con pileta en Villa Centenario"
- **And** the seeded "DNI del propietario observado" document request exists in REJECTED state (from the seed fixture)
- **When** a test-created SUBMITTED document request exists (or the test uses a fresh upload from S-6 flow) and the manager clicks "Rechazar" and provides a rejection reason
- **Then** the request transitions to "Rechazado" and the rejection reason is visible in the manager view
- **And** `/api/owner/notifications` for `propietario.demo@viewpro.local` includes a `DOCUMENT_REJECTED` notification

_Note: The seeded "DNI del propietario observado" fixture is already REJECTED and is consumed by Test 8. This scenario must use a freshly created request or a dedicated fixture; the design phase must decide which._

### S-8 — Owner sees rejection and can re-upload (G-5)

- **Given** `propietario.demo@viewpro.local` is signed in to the owner portal
- **When** they navigate to the document tab for their property
- **Then** the rejected document entry shows status "Rechazado" and the rejection reason
- **And** a re-upload action is available on the same entry

### S-9 — Owner WhatsApp contact link is wired to tenant phone (G-6)

- **Given** `propietario.demo@viewpro.local` is signed in to the owner portal
- **When** they open their property and retrieve the contact data via `/api/owner/properties/:id/engagements`
- **Then** the first engagement contact has `available: true`, `targetType: "tenant"`, and `whatsappPhone: "+5493510000000"`
- **And** a WhatsApp link constructed from this data resolves to a URL containing `+5493510000000` or the E.164 equivalent

### S-10 — WhatsApp click produces a tracking event (G-6)

- **Given** the setup from S-9
- **When** the owner clicks or activates the WhatsApp contact CTA in the browser
- **Then** an analytics event is recorded (verified via API query or DB assertion that the tracking endpoint was called with the expected payload)

_Note: If the current UI does not fire a client-side tracking call on link click, the design phase must decide whether to add a server-side tracking endpoint or accept the existing contact-fetch event as sufficient proof. See Minimal UI wiring section._

### S-11 — Tenant engagement limit blocks creation with a UI error (G-7)

- **Given** the demo tenant's `maxActivePropertyEngagements` limit is 25 (seeded)
- **And** there are already 25 or more ACTIVE/non-archived engagements (requires seed extension or test setup that archives engagements to reach the limit — design phase decides)
- **When** the manager attempts to create one more active engagement via the UI
- **Then** the UI surfaces an error message that clearly communicates the limit has been reached
- **And** no new engagement is created
- **And** the UI remains navigable after the error

_Note: Reaching the limit in a seeded context requires either: (a) extending the seed with additional engagements or (b) temporarily lowering the limit for the tenant in a test setup step. The design phase must choose the approach. See Minimal UI wiring and Open questions._

## Acceptance map

| Scenario | FR(s) proven | Audit row | Planned test name | Pre-conditions |
|----------|-------------|-----------|-------------------|----------------|
| S-1 | FR-1, FR-2, FR-3 | Coverage matrix: Manager creates/opens property engagement | `manager can create a new property engagement through the UI` | Signed in as `demo@viewpro.local`; no setup beyond seed |
| S-2 | FR-4 | Same | (part of S-1 test or standalone) | S-1 completed; martin not assigned to the new property |
| S-3 | FR-5, FR-6 | Coverage matrix: Manager assigns seller | `manager can assign a seller via Gestionar vendedores` | New engagement exists; martin not assigned |
| S-4 | FR-7 | Same | (continuation of S-3 test or standalone) | Martin assigned from S-3 |
| S-5 | FR-8, FR-9, FR-10 | Coverage matrix: Manager creates movement/status update | `manager can create a movement without an outcome (plain status update)` | Any seeded property detail; signed in as manager |
| S-6 | FR-11, FR-12, FR-13 | Coverage matrix: Manager requests document | `manager can create a document request through the UI` | Property index 0 with linked owner; signed in as manager |
| S-7 | FR-14, FR-15, FR-16 | Coverage matrix: Manager approves/rejects document (reject path) | `manager can reject an uploaded document with a reason` | A SUBMITTED document request must exist; design picks source |
| S-8 | FR-16 (owner side) | Same | (continuation of S-7 or standalone owner check) | S-7 completed; signed in as owner |
| S-9 | FR-17, FR-18 | Coverage matrix: WhatsApp contact configured or no-config state | `owner WhatsApp contact link points to configured tenant phone` | Signed in as `propietario.demo@viewpro.local` |
| S-10 | FR-19 | Same | (part of S-9 or standalone) | S-9 setup complete; tracking endpoint available |
| S-11 | FR-20, FR-21, FR-22 | Coverage matrix: Tenant suspended/limit behavior | `tenant engagement limit exceeded surfaces a clear UI error` | Limit must be reachable; design picks approach |

## Non-functional requirements

| Area | Requirement |
|------|-------------|
| Test duration | Each new test SHOULD complete in <10s. Tests that require API polling or complex UI flow (S-11 if it requires DB setup) may exceed 10s and MUST be flagged in the design phase with justification. |
| Execution model | Serial mode (`fullyParallel: false, workers: 1`) and per-test fresh page context are inherited from `playwright.seeded.config.ts`. |
| Wall-clock independence | No new fixture may use a TTL or expiry window shorter than 365 days. Any fixture with time-bounded validity MUST use a 10-year window (`daysFromNow(3650)`) per the lesson from infra/seed-clock-expiry-mismatch (engram #4121). |
| Seed additive only | Any seed extension for new prerequisites is append-only. The existing 20 properties, 4 seller assignments, and all document/movement/notification fixtures remain unchanged. |
| Baseline preservation | All 13 existing tests in `demo-smoke.spec.ts` must continue to pass without modification. |
| Suite total target | ≥20 tests green in a single run under 2 minutes wall-clock. |
| Authorization | Tests must flow through the same auth paths as real users. No test may bypass guards or mutate the API 403 contract. |
| Cross-test state | Tests must not depend on state left by a prior test unless they are explicitly chained and documented. Fresh `page` context per test prevents cookie/session leak. |

## Minimal UI wiring required

The following gaps may require minimal UI additions that do not introduce new product behavior. These are flagged for the design phase decision:

| Item | Gap | Scope | Decision needed |
|------|-----|-------|----------------|
| MUI-1 | G-7 limit error surface | If the property creation form currently shows a generic server error when the limit is hit, a user-readable message mapping the API error code to a clear explanation may be needed. No new product feature — wiring only. | Decision needed in design phase: confirm current error surface or add single error-message mapping. |
| MUI-2 | G-6 WhatsApp click tracking | If the current contact CTA is a plain `<a href>` with no tracking call, a minimal onClick handler that fires the tracking endpoint before or after navigation may be needed. | Decision needed in design phase: confirm whether existing contact-fetch analytics event is sufficient proof or whether click-time tracking is required for the audit row. |
| MUI-3 | G-4 document request creation UI | Confirm "Solicitar documento" button and request form exist on the property detail page accessible to managers. If the button is hidden or the form is absent, a minimal reveal is needed. | Decision needed in design phase: verify current state against seeded manager session. |

## Open questions

| # | Question | Impact |
|---|----------|--------|
| OQ-1 | For S-11 (G-7 limit test): should the test extend the seed with 25 engagements all at ACTIVE_PUBLICATION status, or temporarily lower the tenant limit at test setup time via an admin API call? The seed currently has 20 properties, only some of which count as active. | Affects whether seed extension is needed (additive-only rule). |
| OQ-2 | For S-7 (G-5 reject test): the seeded "DNI del propietario observado" fixture is already in REJECTED state and is used by Test 8. Should the test create a fresh SUBMITTED request (via API call within the test) or should the seed add a second SUBMITTED-state document fixture? | Affects seed extension scope and test isolation. |
| OQ-3 | Should S-1 through S-4 live in `demo-smoke.spec.ts` alongside the existing 13 tests, or in a new sibling file `pilot-choreography.spec.ts`? The proposal defers this to design. | Affects file structure and cohesion of the audit trace table. |

## Trace — FR to proposal scope

| FR(s) | Gap | Proposal scope item |
|-------|-----|---------------------|
| FR-1 – FR-4 | G-1 | "Add new Playwright seeded smoke tests covering G-1 through G-7… no test creates one through the UI" |
| FR-5 – FR-7 | G-2 | "Seed pre-assigns sellers; no browser flow exercises Gestionar vendedores" |
| FR-8 – FR-10 | G-3 | "Test 10 covers movement-with-outcome; no test exercises a plain status update without outcome" |
| FR-11 – FR-13 | G-4 | "Owner upload + manager review covered; the manager-side request creation flow is not" |
| FR-14 – FR-16 | G-5 | "Approve covered (test 11), reject is not" |
| FR-17 – FR-19 | G-6 | "No browser test follows the WhatsApp link logic from property → owner contact → tracking event" |
| FR-20 – FR-22 | G-7 | "API blocks correctly (covered in unit tests); browser UX of 'you hit the limit' is not exercised" |
