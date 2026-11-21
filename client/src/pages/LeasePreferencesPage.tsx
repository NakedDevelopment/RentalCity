import { useAuth } from '../lib/useAuth'
import { useTrackTenantStep } from '../lib/trackTenantStep'
import { EditLeasePreferencesPage } from './EditLeasePreferencesPage'

export function LeasePreferencesPage() {
  const { user } = useAuth()
  useTrackTenantStep('lease_preferences', user?.id, user?.user_metadata?.role as string | undefined)
  return (
    <EditLeasePreferencesPage
      backPath="/matches"
      cancelPath="/tenant-questionnaire"
      nextPath="/tenant-questionnaire"
      backLabel="Back"
      cancelLabel="Skip"
      title="Set your lease preferences"
      subtitle="Share your move date, budget, and preferences so we can match you with the right properties."
      framed
    />
  )
}
