/**
 * Discriminated union for audit actor identity.
 *
 * - `{type:'user', userId}` — product user acting via the /admin route (existing behaviour)
 * - `{type:'operator', operatorId}` — platform operator acting via the control lane
 *
 * Using a discriminated union ensures only one of the two actor fields is ever set,
 * making illegal actor states unrepresentable (Design: Reuse services with operator actor).
 */
export type CommandActor =
  | { type: 'user'; userId: string }
  | { type: 'operator'; operatorId: string }
