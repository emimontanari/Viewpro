# Pilot Route Hardening Specification

## Purpose

Ensure normal pilot tenant users cannot see unfinished billing/starter/demo/template surfaces before Stage 26.2 proceeds.

## Requirements

### Requirement: Pilot Navigation Excludes Non-MVP Surfaces

Pilot-visible dashboard navigation MUST NOT expose billing, starter, demo, or template surfaces.

#### Scenario: Normal pilot tenant opens dashboard navigation

- GIVEN a normal pilot tenant user is authenticated
- WHEN dashboard navigation, account menus, or navigation-derived commands are shown
- THEN no label, action, or link points to `/dashboard/billing` or starter/demo/template routes.

### Requirement: Direct Billing Route Is Safe

`/dashboard/billing` MUST NOT render placeholder, plan-management, pricing, subscription, or billing UI to normal pilot tenant users.

#### Scenario: Normal pilot tenant requests billing route directly

- GIVEN a normal pilot tenant user enters `/dashboard/billing`
- WHEN the route handles the request
- THEN the user receives a safe non-product outcome such as redirect to `/dashboard`
- AND no billing placeholder copy is rendered.

### Requirement: Cleanup Adds No Billing Scope

The cleanup MUST NOT introduce billing capability, paid-plan flows, provider integrations, schema, seed data, runtime config, or new billing UX.

#### Scenario: Cleanup artifacts are reviewed

- GIVEN implementation artifacts are ready
- WHEN they are checked
- THEN they only remove or safely gate non-MVP route surfaces.

### Requirement: Stage 26.2 Remains Gated Until Evidence Passes

Stage 26.2 MUST remain blocked until focused route-hardening evidence passes.

#### Scenario: Gate evidence passes

- GIVEN validation demonstrates billing/starter/demo/template surfaces are absent or safe
- WHEN current MVP status is evaluated
- THEN Stage 26.2 MAY proceed if other handoff-required gates also pass.
