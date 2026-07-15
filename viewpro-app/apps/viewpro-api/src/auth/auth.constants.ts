export const ACCESS_TOKEN_COOKIE = 'viewpro_platform_access_token'
export const STEP_UP_TOKEN_COOKIE = 'viewpro_platform_stepup_token'

// D5 — re-issue the access cookie once at least this fraction of the idle
// window has elapsed since the token's `iat`, capping Set-Cookie churn.
export const IDLE_REISSUE_THRESHOLD = 0.5

// D6 — clock-skew allowance applied to both the sliding `exp` verification
// and the manual absolute `sessionExp` comparison.
export const CLOCK_TOLERANCE_SECONDS = 5
