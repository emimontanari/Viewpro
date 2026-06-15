/**
 * Constraint name for the partial unique index enforcing FR-21:
 * at most one PENDING StatusChangeRequest per PropertyEngagement.
 *
 * This name is load-bearing: the create use case catches Prisma P2002
 * errors and checks against this constant to distinguish the PENDING
 * invariant violation from other unique constraint errors.
 *
 * The index is created via raw SQL in the migration
 * (20260615023015_add_status_change_requests/migration.sql).
 * Do NOT rename without updating both the migration comment and this constant.
 */
export const STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT =
  'status_change_requests_pending_engagement_key'
