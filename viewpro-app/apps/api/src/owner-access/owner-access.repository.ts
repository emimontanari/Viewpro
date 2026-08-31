export const OWNER_ACCESS_REPOSITORY = Symbol('OWNER_ACCESS_REPOSITORY')

export type OwnerAccessRepository = {
  /**
   * Whether this identity can enter the owner portal at all.
   *
   * A boolean, not the records: the session is read by the browser, and
   * post-login routing only needs to know a portal exists. What is inside it
   * stays behind the portal's own authorised calls (#326).
   */
  hasActiveOwnerAccess(userId: string): Promise<boolean>
}
