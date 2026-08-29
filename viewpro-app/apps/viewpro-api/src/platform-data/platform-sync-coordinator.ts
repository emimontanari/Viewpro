import { Inject, Injectable } from '@nestjs/common'
import { ChangeFeedClient, ChangeFeedTimeoutError } from './change-feed.client'
import { CursorRepository } from './cursor.repository'
import { IngestService } from './ingest.service'
import { SENTRY_CAPTURE, type SentryCapture } from '../observability/sentry.service'

export type PlatformSyncStatus = {
  state: 'current' | 'updating' | 'stale' | 'failed'
  inFlight: boolean
  attemptCount: number
  consecutiveFailureCount: number
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastObservedCursor: number | null
  lastBatchCount: number | null
  failureCode: 'CURSOR_READ_FAILED' | 'FEED_TIMEOUT' | 'FEED_FAILED' | 'PROJECTION_FAILED' | 'CURSOR_ADVANCE_FAILED' | null
}

@Injectable()
export class PlatformSyncCoordinator {
  private inFlight: Promise<PlatformSyncStatus> | null = null
  private status: PlatformSyncStatus = { state: 'stale', inFlight: false, attemptCount: 0, consecutiveFailureCount: 0, lastAttemptAt: null, lastSuccessAt: null, lastFailureAt: null, lastObservedCursor: null, lastBatchCount: null, failureCode: null }

  constructor(
    private readonly feed: ChangeFeedClient,
    private readonly ingest: IngestService,
    private readonly cursor: CursorRepository,
    @Inject(SENTRY_CAPTURE) private readonly sentryService: SentryCapture | undefined,
  ) {}

  /**
   * Synchronous status snapshot. Reads only the in-memory field — no cursor,
   * feed, or ingest call — so authenticated demand can be answered even when
   * a race falls back to it without cancelling admitted work.
   */
  getStatus(): PlatformSyncStatus {
    return this.status
  }

  runOneBatch(): Promise<PlatformSyncStatus> {
    if (this.inFlight) return this.inFlight
    this.status = { ...this.status, state: 'updating', inFlight: true, attemptCount: this.status.attemptCount + 1, lastAttemptAt: new Date().toISOString(), failureCode: null }
    const run = this.execute().finally(() => { this.inFlight = null; this.status = { ...this.status, inFlight: false } }).then(() => this.status)
    this.inFlight = run
    return run
  }

  private async execute(): Promise<void> {
    let cursor: number
    try { cursor = await this.cursor.getCursor() } catch { return this.fail('CURSOR_READ_FAILED') }
    this.status = { ...this.status, lastObservedCursor: cursor }
    let events: Awaited<ReturnType<ChangeFeedClient['fetchChanges']>>['events']
    try { events = (await this.feed.fetchChanges(cursor)).events } catch (error) { return this.fail(error instanceof ChangeFeedTimeoutError ? 'FEED_TIMEOUT' : 'FEED_FAILED') }
    let outcome: Awaited<ReturnType<IngestService['ingestBatch']>>
    try { outcome = await this.ingest.ingestBatch(events) } catch { return this.fail('PROJECTION_FAILED') }
    if (outcome.kind === 'failed') return this.fail(outcome.stage === 'projection' ? 'PROJECTION_FAILED' : 'CURSOR_ADVANCE_FAILED')
    const now = new Date().toISOString()
    this.status = events.length === 0
      ? { ...this.status, state: 'current', consecutiveFailureCount: 0, lastSuccessAt: now, lastBatchCount: 0 }
      : { ...this.status, state: 'updating', consecutiveFailureCount: 0, lastSuccessAt: now, lastBatchCount: events.length, lastObservedCursor: outcome.advancedCursor ?? this.status.lastObservedCursor }
  }

  private fail(failureCode: NonNullable<PlatformSyncStatus['failureCode']>): void {
    try { this.sentryService?.captureException({ type: 'PlatformSyncFailure', statusCode: 500, failureCode }) } catch {}
    this.status = { ...this.status, state: 'failed', consecutiveFailureCount: this.status.consecutiveFailureCount + 1, lastFailureAt: new Date().toISOString(), failureCode }
  }
}
