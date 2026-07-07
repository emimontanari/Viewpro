# InmoView Public Demo Checklist

Use this checklist after the demo environment is deployed, migrated, and seeded. Record pass/fail evidence in apply/verify artifacts; do not store secrets in this file.

## Demo target

| Surface | URL |
|---|---|
| Frontend | `https://demo.inmoview.app` |
| API | `https://api-demo.inmoview.app/api` |
| API health | `https://api-demo.inmoview.app/api/health` |

## Preconditions

- [ ] `demo.inmoview.app` serves HTTPS without certificate warnings.
- [ ] `api-demo.inmoview.app` serves HTTPS without certificate warnings.
- [ ] API health check passes.
- [ ] Demo DB is the dedicated Railway Postgres database.
- [ ] Demo seed/reset has been run only against the dedicated demo DB with `INMOVIEW_ENVIRONMENT=demo`, `INMOVIEW_DEMO_SEED_ALLOWED=true`, and a matching `INMOVIEW_DEMO_DATABASE_IDENTIFIER`.
- [ ] Demo credentials are available from the approved secret store or handoff channel.
- [ ] Sentry env variables are configured for frontend and API.
- [ ] No local `.env` or secret file is needed to use the deployed demo.

## Smoke commands

```bash
curl -fsS https://api-demo.inmoview.app/api/health
curl -fsS https://api-demo.inmoview.app/api/docs >/dev/null
curl -I https://demo.inmoview.app
```

Expected result: all commands succeed over HTTPS.

## Manager / account owner walkthrough

- [ ] Log in as the manager demo account.
- [ ] Confirm the dashboard loads without localhost URLs.
- [ ] Confirm InmoView-facing copy appears in user-facing surfaces.
- [ ] Open the property list.
- [ ] Open a seeded property detail.
- [ ] Confirm property images render.
- [ ] Confirm movements/engagements render for the property.
- [ ] Confirm assigned sellers are visible where expected.
- [ ] Confirm owner card/details are visible where expected.
- [ ] Open documents for a property or movement.
- [ ] Confirm document request status and history are understandable.
- [ ] Open `Seguimiento`.
- [ ] Confirm activity and filters render.
- [ ] Confirm tenant limits/admin controls only appear for roles that should see them.

## Seller walkthrough

- [ ] Log out or use a clean browser session.
- [ ] Log in as a seller demo account.
- [ ] Confirm seller sees assigned work only.
- [ ] Confirm seller can view relevant property/movement/contact information.
- [ ] Confirm seller does not see forbidden management controls.
- [ ] Confirm restricted direct URLs return denial or redirect behavior as expected.
- [ ] Confirm WhatsApp/contact CTA semantics resolve to the expected assigned seller/contact path.

## Owner walkthrough

- [ ] Log out or use a clean browser session.
- [ ] Log in as the owner demo account.
- [ ] Confirm owner portal loads.
- [ ] Confirm owner sees only their property/properties.
- [ ] Confirm timeline/movement status renders.
- [ ] Confirm owner notifications appear where expected.
- [ ] Click notification deep links and confirm they land on the exact expected document or timeline context.
- [ ] Confirm document upload/read flow works in the browser.
- [ ] Confirm WhatsApp/contact CTA appears where expected.
- [ ] Confirm owner cannot access dashboard management surfaces.

## Admin/global demo flow

Run this only if the current demo story includes the admin/global account.

- [ ] Log in as the admin/global demo account.
- [ ] Confirm the admin/tenant limit surface loads.
- [ ] Confirm tenant status/limits shown are demo data only.
- [ ] Do not make destructive tenant changes unless the demo script explicitly calls for it.

## Documents and storage

- [ ] Document upload URL creation works.
- [ ] Document read URL creation works.
- [ ] Browser can upload/read demo-safe document content.
- [ ] Document storage uses S3/R2 in demo mode.
- [ ] No document bytes are committed to the repository.

## Property images

PR 2 implements local and S3/R2 property image storage. These checks pass only
after the future demo environment is wired with the S3/R2 driver and approved
public image host.

- [ ] Property images render from the deployed frontend.
- [ ] Property images use the approved public object-storage host or API-mediated URL.
- [ ] Property images still render after API redeploy/restart.
- [ ] No property image bytes are committed to the repository.

## Notifications

- [ ] Manager/internal notifications appear where expected.
- [ ] Owner notifications appear where expected.
- [ ] Notification read/unread state persists after reload.
- [ ] Notification deep links land on the exact expected document or movement context.

## Route isolation and template cleanup

Verify starter/template routes remain inaccessible.

- [ ] `/dashboard/chat` is inaccessible.
- [ ] `/dashboard/kanban` is inaccessible.
- [ ] `/dashboard/forms` is inaccessible.
- [ ] `/dashboard/forms/simple` is inaccessible.
- [ ] `/dashboard/elements/icons` is inaccessible.
- [ ] `/dashboard/react-query` is inaccessible.
- [ ] `/dashboard/exclusive` is inaccessible.
- [ ] Billing route behavior matches the accepted MVP gate.

## Auth, cookies, and refresh

- [ ] Login sets HTTPS-safe cookies for the demo topology.
- [ ] Protected routes survive page refresh.
- [ ] API calls include credentials successfully.
- [ ] Token refresh works without localhost assumptions.
- [ ] Logging out clears access as expected.

## Sentry evidence

- [ ] API logs or a safe controlled event prove Sentry initialization.
- [ ] Frontend logs, build output, or a safe controlled event prove Sentry initialization.
- [ ] Any missing source-map/release tracking setup is documented as a follow-up.

## Backup, restore, and rollback evidence

- [ ] Database backup/snapshot evidence exists before public handoff.
- [ ] Restore procedure is documented.
- [ ] API rollback path is documented.
- [ ] Frontend rollback path is documented.
- [ ] R2/S3 cleanup/reseed stance is documented.

## Final handoff check

- [ ] Demo URL works in a clean browser profile.
- [ ] Demo credentials are available through an approved private channel.
- [ ] Known limitations are documented.
- [ ] Guarded seed reset evidence is captured in the runbook/apply or verify artifact.
