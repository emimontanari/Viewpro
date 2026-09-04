# Delta for operator-console

## ADDED Requirements
### Requirement: Authenticated Visible Demand [AC2–AC4]
An authenticated global operator opening, focusing, explicitly refreshing, or retaining a visible console MUST request catch-up only through authorized `viewpro-api`. The browser MUST NOT call the product API. Visible cadence MUST be four seconds; hidden/unmounted state MUST stop new demand without unload. Demand joining an active run MUST NOT queue another run.

#### Scenario: Authorized open and unauthorized request
- GIVEN the console is opened with a valid or invalid operator session
- WHEN synchronization demand is attempted
- THEN valid demand targets only `viewpro-api`; invalid demand is rejected and starts no run

#### Scenario: Backgrounding stops demand
- GIVEN a demand has resolved
- WHEN the console becomes hidden or unmounts
- THEN no later cadence demand occurs until a new visible action

### Requirement: Explicit Projection State [AC4–AC6]
The console MUST remain usable with existing projection data. Process status after restart MUST be `stale` with null observation fields and MUST transition to `updating` when demand starts. Backend demand MUST race/return by four seconds. A response MAY remain `updating` with successful non-empty batch metadata; the web MUST then invalidate, read, and render the target projection. If the target batch's projection write and cursor advance are not durable at the four-second race, the event is outside the normal-path SLO and the console MUST render updating, stale, or failed state by five seconds; it MUST NOT imply completion. It MUST preserve valid empty zero states. Repeated visible cadence MUST eventually drain one bounded batch at a time, and a later empty batch confirms `current`.

#### Scenario: Cold, backlog, or failure degrades explicitly
- GIVEN cold activation, possible backlog, timeout, or synchronization failure
- WHEN backend work returns/races by four seconds or failure occurs
- THEN by five seconds available projection data renders refreshed or with updating, stale, or failed state and is not discarded

### Requirement: Conditional Normal-Path Freshness [AC6, AC9]
A feed-visible event MUST render within ten seconds only when it is returned in one feed-visible producer-bounded batch, the console is visible/authenticated, no cold start, backlog, timeout, or failure exists, the target event's projection write and cursor advance become durable within the four-second backend budget, and invalidation, projection read, and render complete within the next one-second client budget. Eligibility MUST NOT require overall coordinator state `current`: the successful response MAY remain `updating` until a later empty batch confirms feed head. Measure `t0` when the feed would first include the event and `t1` when its matching projection renders. The total permits up to four seconds to the next demand cadence plus four backend seconds plus one client second: at most nine seconds, with one second margin. Outside these conditions the console MUST expose the applicable degraded state rather than claim the SLO.

#### Scenario: Deterministic normal-path oracle
- GIVEN a fake clock places `t0` immediately after the prior cadence under all normal-path conditions
- WHEN demand starts at `t0 + 4s`, the target projection write and cursor advance are durable by `t0 + 8s` while status may remain `updating`, and invalidation/read/render use the next one second
- THEN the component oracle observes the matching projection by `t0 + 9s`, within the ten-second SLO

#### Scenario: SLO precondition is absent
- GIVEN cold start, backlog, timeout, failure, hidden/unauthenticated state, or work unfinished at the four-second backend race
- WHEN the event is not eligible for normal-path completion
- THEN no completion guarantee is claimed and the truthful updating/stale/failed/auth state renders by five seconds from demand where applicable
