import type { PlatformOutboxEvent } from './platform-outbox-event.js'

// TODO: migrate to BigInt/string when seqNo > 2^53 events accumulate
export type ChangeFeedCursor = number

export type ChangeFeedResponse = {
  events: PlatformOutboxEvent[]
  nextCursor: ChangeFeedCursor
}
