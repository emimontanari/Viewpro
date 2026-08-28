# Transactional email — health and recovery

Covers the five things this system sends: email verification, password reset,
team invitation, owner invitation, owner notification. All five share one
provider (Resend), so they fail together.

## Why this needs a procedure at all

Every send is **best-effort by design**. The use cases catch a provider failure,
log it, and return normally:

```ts
} catch (error) {
  this.logger.error(`Failed to send email verification to ${user.email}: …`)
}
```

That is deliberate — a dead mail provider must not fail a password reset or an
invitation, because the invitation link still works and can be copied by hand.

The cost is that **nothing fails loudly**. Before this, a total outage looked
exactly like a normal day: 200s everywhere, users quietly not receiving mail.

## Reading the health endpoint

```
GET /api/health/email
```

Unauthenticated, and empty of addresses, subjects and provider prose on purpose:
it answers *is mail working, and for which flows*, not *who was written to*.

```json
{
  "status": "degraded",
  "degradedPurposes": ["password_reset"],
  "purposes": {
    "password_reset": {
      "attempted": 12, "failed": 3,
      "lastFailureAt": "2026-08-28T14:02:11.000Z",
      "lastFailureKind": "rate_limited"
    }
  }
}
```

It is **in-memory and per-process**. It answers "is mail working right now", not
"how much did we send last month"; a restart resetting it is correct, not a gap.
With more than one replica, poll each — a degraded one is degraded even if its
neighbour looks fine.

`status` is never a reason to take the service out of rotation, which is why
this endpoint never returns 503. Auth and invitations work without mail.

## The three failure kinds, and what each one means you should do

| `lastFailureKind` | what happened | what to do |
|---|---|---|
| `rate_limited` | the provider is fine and refusing volume | wait it out; check whether a loop is sending. Retrying immediately makes it worse |
| `unavailable` | the provider could not be reached at all | check Resend status and outbound network. Nothing to fix in the app |
| `rejected` | the provider refused **this** message | retrying it unchanged will be refused again. Check the sending domain's verification and the recipient — a suppressed or invalid address lands here |

The distinction is the point: `rate_limited` resolves itself and `rejected` never
will, so treating them the same wastes the outage.

## Recovery

1. **Confirm it is the provider, not us.** `GET /api/health/email`. If every
   purpose is degraded, it is shared — the provider or the network. If exactly
   one is, look at that flow's own logs first.
2. **Check the kind** in the table above before doing anything.
3. **Verify the key and the domain.** `RESEND_API_KEY` unset selects the no-op
   sender: everything reports `attempted` climbing with zero failures and no mail
   ever leaves. `attempted > 0, failed == 0` and users reporting nothing arriving
   is the signature of that, and it is a **configuration** problem, not an outage.
4. **Serve the users who are stuck, meanwhile.** Every invitation flow shows a
   copyable link in the UI and says so — nobody is blocked on email for
   invitations. Password reset and email verification have no manual path; those
   users must wait.
5. **After recovery**, nothing replays. There is no outbox for transactional
   mail: a send that failed during the outage is gone. Affected users must ask
   again (resend verification, request a new reset link).

## Known gaps

- **No alerting.** The endpoint has to be polled by something. Criterion 2 of
  #293 (alerts before exhaustion) needs an alert destination that has not been
  chosen.
- **No provider-side quota reading.** Criterion 1 needs operational access to
  the Resend account. What is here counts *our* attempts and failures, which is
  a proxy for quota pressure, not the quota itself.
- **No delivery confirmation.** A successful send means the provider accepted
  it. Bounces and spam placement are invisible without Resend webhooks.
