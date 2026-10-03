type SessionIdentity = { user: { id: string } } | null

/** Only an SDK-validated PASSWORD_RECOVERY event authorizes the reset form.
 * Keep it in memory so React mounting after URL-token consumption cannot miss it.
 * An ordinary persisted login, URL marker, or router state is not sufficient.
 */
export function createRecoverySessionTracker() {
  let recoveryUserId: string | null = null
  return {
    record(event: string, session: SessionIdentity) {
      if (event === 'PASSWORD_RECOVERY') recoveryUserId = session?.user.id ?? null
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        recoveryUserId = null
      }
    },
    isRecovery(session: SessionIdentity): boolean {
      return Boolean(recoveryUserId && session?.user.id === recoveryUserId)
    },
  }
}