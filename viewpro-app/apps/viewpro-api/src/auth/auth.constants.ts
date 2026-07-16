export const ACCESS_TOKEN_COOKIE = 'viewpro_platform_access_token'
export const STEP_UP_TOKEN_COOKIE = 'viewpro_platform_stepup_token'

// Stable, machine-readable error code carried on EVERY AuthGuard 401 body
// (mirrors the StepUpGuard's `STEP_UP_REQUIRED` convention). Lets the FE
// distinguish a session-expiry 401 from a wrong-password 401 WITHOUT
// string-matching the human message — a change to the message never silently
// regresses that FE branch. Single source of truth for the 4 reject sites.
export const AUTH_REQUIRED_CODE = 'AUTH_REQUIRED'

// D5 — re-issue the access cookie once at least this fraction of the idle
// window has elapsed since the token's `iat`, capping Set-Cookie churn.
export const IDLE_REISSUE_THRESHOLD = 0.5

// D6 — clock-skew allowance applied to both the sliding `exp` verification
// and the manual absolute `sessionExp` comparison.
export const CLOCK_TOLERANCE_SECONDS = 5
