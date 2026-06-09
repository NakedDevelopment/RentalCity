import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { supabase } from './supabase'

export type LandlordRatingGivenRow = {
  id: string
  rating: number
  comment: string | null
  property_name: string | null
  property_address: string | null
  created_at: string
  tenant_external_id: string
  tenant_name: string | null
  tenant_id: string | null
  tenant?: { display_name: string | null; avatar_url: string | null } | null
}

function normalizeTenantEmbeds(row: LandlordRatingGivenRow): LandlordRatingGivenRow {
  const t = row.tenant
  const tenant = Array.isArray(t) ? t[0] ?? null : t ?? null
  return { ...row, tenant }
}

export function useLandlordRatingsGiven() {
  const { user } = useAuth()
  const location = useLocation()
  const [rows, setRows] = useState<LandlordRatingGivenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const returnTo = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search])

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError(null)
      const { data, error } = await supabase
        .from('tenant_ratings')
        .select(
          'id, rating, comment, property_name, property_address, created_at, tenant_external_id, tenant_name, tenant_id, tenant:tenant_id(display_name, avatar_url)',
        )
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(error.message)
        setRows([])
      } else {
        setRows(((data ?? []) as unknown as LandlordRatingGivenRow[]).map(normalizeTenantEmbeds))
      }
      setLoading(false)
    }
    void load()
  }, [user])

  return { rows, loading, loadError, returnTo }
}
