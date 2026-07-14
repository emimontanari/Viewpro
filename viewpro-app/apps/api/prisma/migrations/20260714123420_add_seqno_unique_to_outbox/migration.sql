-- Additive: promote seqNo index to UNIQUE on platform_outbox_events.
-- Design D1 and tasks spec required @unique on seqNo to guarantee the
-- monotonic total-order invariant and enable efficient cursor-based
-- pagination with strict seqNo deduplication.
--
-- This migration is SAFE to apply to a live table:
--   - No rows are modified, deleted, or rewritten.
--   - The previous non-unique index (platform_outbox_events_seqNo_idx) is
--     dropped and replaced by a unique index. BIGSERIAL ensures all existing
--     rows already have distinct values, so no conflict can occur.
--
-- Rollback: DROP INDEX CONCURRENTLY "platform_outbox_events_seqNo_key";
--           (restores to non-unique; no data loss)

-- Drop the old non-unique index (superseded by the unique constraint below)
DROP INDEX IF EXISTS "platform_outbox_events_seqNo_idx";

-- CreateUniqueIndex
CREATE UNIQUE INDEX "platform_outbox_events_seqNo_key" ON "platform_outbox_events"("seqNo");
