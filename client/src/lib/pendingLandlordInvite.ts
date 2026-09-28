const KEY = 'rental-city-pending-landlord-invite-token'
const PROPERTY_KEY = 'rental-city-invited-property'

export function setPendingLandlordInviteToken(token: string) {
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    /* ignore */
  }
}

export function getPendingLandlordInviteToken(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingLandlordInviteToken() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// Keep the property destination through new-account onboarding. This is only a
// navigation hint: property visibility still comes from the invite and RLS.
export function setPendingInvitedProperty(userId: string, propertyId: string) {
  try {
    sessionStorage.setItem(PROPERTY_KEY, JSON.stringify({ userId, propertyId }))
  } catch {
    /* ignore */
  }
}

export function getPendingInvitedProperty(userId: string): string | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PROPERTY_KEY) || 'null') as { userId?: string; propertyId?: string } | null
    return value?.userId === userId && /^[0-9a-f-]{36}$/i.test(value.propertyId || '') ? value.propertyId! : null
  } catch {
    return null
  }
}

export function clearPendingInvitedProperty() {
  try {
    sessionStorage.removeItem(PROPERTY_KEY)
  } catch {
    /* ignore */
  }
}
