# ViewPro Stage 9 Frontend MVP Vertical Design

Stage 9 turns the completed backend MVP into an app people can actually use. The goal is not to build every possible dashboard. The goal is to deliver the core ViewPro loop with a premium, clear, editorial interface: an agency creates and updates a property engagement, and an owner understands progress without asking for repeated updates.

## Outcome

ViewPro will ship a real frontend for the pilot:

```txt
manager registers/logs in
→ chooses tenant
→ creates or opens an engagement
→ seller posts a movement
→ owner reads the timeline
→ documents move through request/upload/approval
→ manager reads pilot metrics
```

## Product decision

Build a polished frontend vertical before MVP hardening.

The backend now supports auth, tenant permissions, property engagements, movements, owner portal reads, documents, and pilot analytics. The biggest remaining product risk is usability: can a real agency and a real owner operate the product without Postman or engineering help?

## Visual direction

Use a **clear/editorial premium** style.

| Area | Direction |
|------|-----------|
| Mood | Premium real estate editorial, not generic SaaS template. |
| Background | Warm ivory / soft stone, not pure cold white. |
| Text | Petroleum ink / deep green for trust and readability. |
| Accent | Restrained teal and muted brass, used sparingly. |
| Typography | Elegant serif for major headings; refined sans for UI and dense data. |
| Layout | Generous spacing, asymmetry where useful, clear hierarchy, strong empty states. |
| Motion | Subtle transitions only; no distracting animation in operational flows. |
| Icons | SVG icons only. No emoji UI. |

Avoid:

- generic dashboard cards with no hierarchy
- purple/blue AI gradients
- emoji icons
- over-animated UI
- dark luxury UI as the default
- fake demo data presented as real state

## Frontend architecture

| Topic | Decision |
|-------|----------|
| Framework | Next.js App Router in `viewpro-app/apps/web`. |
| Auth | Browser requests use `credentials: 'include'` so NestJS httpOnly cookies remain the authority. |
| Tenant context | Store selected tenant client-side and attach `x-tenant-id` in the API client for internal routes. |
| API client | Small typed fetch wrapper first; no generated contracts until OpenAPI generation is configured. |
| Rendering | Server layouts/shells where practical; client components for forms, filters, mutations, and tenant selection. |
| Design system | Local minimal component system: buttons, inputs, cards, badges, tables, page shell, timeline, empty states. |
| State | Keep state local first. Introduce a query/cache library only when repeated fetching becomes painful. |
| Testing | Start with typecheck/build and add smoke tests once flows exist. |

## Roles and screens

### 1. Entry screens

| Screen | User | Purpose | Primary action |
|--------|------|---------|----------------|
| Login | Manager, seller, owner | Enter ViewPro using email/password. | Sign in. |
| Register agency | First manager | Create initial agency tenant and manager account. | Create agency. |
| Tenant selector | Multi-tenant internal user | Choose which agency context to operate. | Enter tenant workspace. |

Entry screens should feel premium and simple. They should explain ViewPro in one sentence, but not become a landing page.

### 2. Internal agency workspace

| Screen | User | Purpose | Primary action |
|--------|------|---------|----------------|
| Internal dashboard | Manager/seller | See urgent work and pilot health quickly. | Open stale engagement or create movement. |
| Engagement list | Manager/seller | Find property engagements by status/activity. | Open engagement or create one. |
| Create engagement | Manager/seller with permission | Create property asset + tenant engagement. | Save engagement. |
| Engagement detail | Manager/seller | Operate a property from one place. | Create movement. |
| Create movement | Manager/seller | Publish a short owner-visible update. | Publish movement. |

The engagement detail is the operational center. It should show property summary, current status, sellers, movement timeline, document requests, and the main action: publish an update.

### 3. Documents

| Screen | User | Purpose | Primary action |
|--------|------|---------|----------------|
| Request document | Manager/seller | Ask an owner for a needed document. | Send request. |
| Internal document review | Manager/requesting seller | Approve or reject owner uploads. | Approve/reject. |
| Owner documents | Owner | Upload and track requested documents. | Upload document. |

Documents should be clear and calm because they carry sensitive information. Never expose raw storage keys or private document content in lists.

### 4. Owner portal

| Screen | User | Purpose | Primary action |
|--------|------|---------|----------------|
| My properties | Owner | See properties where the owner has active access. | Open property. |
| Owner property detail | Owner | Understand status, recent updates, and pending docs. | Review timeline or upload document. |

The owner portal must feel simpler than the internal workspace. Owners should not see tenant internals, assigned sellers management, private observations, or cross-tenant data.

### 5. Pilot metrics

| Screen | User | Purpose | Primary action |
|--------|------|---------|----------------|
| Pilot metrics dashboard | Manager | Understand whether owners are being updated. | Open inactive engagements. |

This screen uses Stage 8 endpoints:

- `GET /api/analytics/pilot-summary`
- `GET /api/analytics/inactive-engagements`
- `GET /api/analytics/events`

It should prioritize the north-star metric: active engagements with at least one weekly owner-visible update.

## ViewPro admin backoffice requirement

Before the MVP is considered finished, ViewPro also needs an internal **ViewPro Admin Backoffice** for the product operator.

This is not the same as the tenant manager dashboard.

Scope for the first version:

- read all agencies/tenants
- see global pilot activity
- detect inactive tenants
- inspect tenant-level engagement/document/event counts
- support pilot operations without impersonating users

Initial version should be read-only. Editing tenants, deleting data, impersonation, billing, and access to private document contents are out of scope until explicit admin security rules exist.

## Implementation slices

### Slice 1 — Frontend foundation and premium shell

- Global CSS variables and typography.
- App shell, public auth shell, internal workspace shell, owner portal shell.
- Minimal reusable components.
- API client with cookie and tenant support.

### Slice 2 — Auth and tenant selection

- Register agency.
- Login.
- `/me` session load.
- Tenant selector and selected tenant persistence.

### Slice 3 — Internal engagements workspace

- Dashboard skeleton with real counts where available.
- Engagement list.
- Engagement detail.
- Create engagement.

### Slice 4 — Movement publishing

- Movement timeline in detail screen.
- Mobile-first create movement form.
- Status update option.
- Empty/loading/error states.

### Slice 5 — Owner portal

- Owner property list.
- Owner property detail.
- Owner timeline.

### Slice 6 — Documents UX

- Internal document request/review screens.
- Owner upload flow.
- Document status states.

### Slice 7 — Pilot metrics dashboard

- Manager analytics dashboard.
- Inactive engagement list from analytics.
- Event audit view.

### Later MVP requirement — ViewPro Admin Backoffice

- Global internal operator dashboard.
- Read-only pilot operations view across tenants.

## Acceptance checklist

- [ ] UI uses the clear/editorial premium direction consistently.
- [ ] Auth works with httpOnly cookies.
- [ ] Tenant-scoped requests attach `x-tenant-id` only for internal tenant routes.
- [ ] Manager/seller can list and open engagements.
- [ ] Manager/seller can create a movement in under 60 seconds.
- [ ] Owner can see properties and movement timelines.
- [ ] Documents can be requested, uploaded, approved, and rejected from UI.
- [ ] Manager can see pilot metrics.
- [ ] Frontend typecheck and build pass.
- [ ] MVP roadmap includes ViewPro Admin Backoffice before final MVP closure.

## Out of scope for Stage 9

- Native mobile app.
- Public marketplace.
- PostHog dashboards.
- Advanced BI.
- Editable permissions UI.
- Full ViewPro admin backoffice implementation, unless promoted into a dedicated Stage 9B/10.
- Sentry/rate limiting/deploy hardening, handled after the vertical frontend is usable.
