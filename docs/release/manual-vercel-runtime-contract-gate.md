# Manual Vercel Runtime-Contract Gate

Use this manual, authenticated gate before releasing the public runtime contract.
It proves an existing App New deployment; it does not change Vercel settings,
collect secrets, or automate release approval.

## Quick path

1. Run the root CI commands from `viewpro-app/` and keep their results with the release record.
2. Inspect one READY deployment for each App New project with an authenticated Vercel CLI session.
3. Record a reviewer pass only when every item below matches the reviewed SHA.

Before any promotion, the maintainer or release operator captures and retains the
immutable full `RESTORE_SHA` and the prior App and Demo deployment IDs outside
the repository.

## Root verification

Run these commands sequentially from `viewpro-app/`:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm exec turbo run test --concurrency=1
```

These are root-only Turbo paths. Do not start application development servers,
use global ports, or replace them with seeded E2E checks for this gate.

## Read-only Vercel inspection

### Versioned ignored-build policy

The prior App promotion `dpl_3yAQxmTu44MwM9qRLLZgDJQ2FLkY` was CANCELED before
build because the dashboard `npx turbo-ignore` found a READY preview at the
same SHA. No production alias moved. The repository now owns the policy in
`viewpro-app/apps/app-new/vercel.json`: `VERCEL_ENV=production` exits `1` to
continue an explicit production build; previews still delegate to
`npx turbo-ignore`. Root-local `ignoreCommand` overrides the dashboard setting.

Do not retry production from the canceled SHA. First merge a reviewed SHA that
contains this configuration, then use that new SHA for the manual production
gate below. Dashboard/settings changes remain forbidden.

The two App New projects are `inmoview-app` and `inmoview-demo`. Their current
Vercel Root Directory is `viewpro-app/apps/app-new`; the dashboard may display
the default Next.js build command, while the repository-owned
`viewpro-app/apps/app-new/vercel.json` supplies the effective filtered-Turbo
build command. Do not edit either setting during this gate.

For each project, authenticate normally, then inspect the selected deployment:

```bash
vercel project inspect inmoview-app
vercel list inmoview-app --status READY
vercel inspect <deployment-url>

vercel project inspect inmoview-demo
vercel list inmoview-demo --status READY
vercel inspect <deployment-url>
```

Use the authenticated deployment inspection to reconcile the deployment ID,
full Git SHA, **production** target, and READY status. A preview can establish
lineage only; it never passes this release gate. Make one bounded HTTPS request
to a non-mutating route on that exact deployment, recording its status (a
configured auth redirect is acceptable when documented):

```bash
curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}\n' \
  https://<deployment-url>/privacy-policy
```

## Reviewer decision

Attach the following facts to the external release record, never to Git: the
project name, deployment ID, full reviewed SHA, target, READY status, current
root/build settings, deployment-specific HTTPS URL, request-smoke result, and
the reviewer’s explicit pass or fail. The reviewer records **fail** and blocks
rollout when any value is missing, stale, mismatched, or shows settings drift.

`inmoview-console` is intentionally outside this App New gate: its ignored
build/non-owner status is expected and must not be used as App New evidence.

## Rollback

Before any rollback, record the immutable full `RESTORE_SHA` outside the
repository. Before reverting Unit 3 or Unit 2, run the current App New and API
runtime smokes as diagnostic evidence only:

```bash
pnpm --filter next-shadcn-dashboard-starter runtime:smoke
pnpm --filter @viewpro/api runtime:smoke
```

Restore units in reverse order (4 → 1). After restoration, verify that both the
checkout revision and the inspected deployed revision equal `RESTORE_SHA`. Run
only checks available at that SHA: frozen install; native sequential build,
typecheck, and test; build/deploy; API `/api/health` and `/api/health/ready`;
and an HTTPS smoke for the restored App deployment. Attach fresh authenticated
deployment evidence bound to `RESTORE_SHA`. Never require a deleted
`runtime:smoke` script, and do not add evidence capture, comparison, hashing,
or Vercel automation.
