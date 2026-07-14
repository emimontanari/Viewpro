-- W1: Widen seqNo columns from INTEGER to BIGINT to match the producer
-- platform_outbox_events.seqNo which is BIGSERIAL (BIGINT). This is an
-- additive/widening change — integer values are promoted without data loss.

ALTER TABLE "platform_mirror_events" ALTER COLUMN "seqNo" TYPE BIGINT;
ALTER TABLE "platform_ingest_cursor" ALTER COLUMN "seqNo" TYPE BIGINT;
