import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  TENANT_REVIEWS_CARD_TITLE,
  TENANT_REVIEWS_DESCRIPTION_AS_TENANT,
  TenantReviewListRowContent,
} from '../components/TenantReviewDisplay'
import { useAuth } from '../lib/useAuth'
import {
  normalizeLandlordReviewRows,
  type LandlordReviewAboutTenantRow,
} from '../lib/landlordReviewsAboutTenant'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'

export function TenantAccountReviewsPage() {
  const { user } = useAuth()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [rows, setRows] = useState<LandlordReviewAboutTenantRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data: ratingsRaw } = await supabase
        .from('tenant_ratings')
        .select(
          'id, rating, comment, property_name, property_address, created_at, landlord:landlord_id(display_name)',
        )
        .eq('tenant_external_id', user.id)
        .order('created_at', { ascending: false })
      setRows(normalizeLandlordReviewRows((ratingsRaw ?? []) as unknown as LandlordReviewAboutTenantRow[]))
      setLoading(false)
    }
    void load()
  }, [user])

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
        <span className="text-sm text-gray-500">Loading…</span>
      </div>
    )
  }

  if (profileRole !== 'tenant') {
    return <Navigate to="/account" replace />
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-4">
      <Link
        to="/account"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to profile
      </Link>

      <h1 className="text-[1.6rem] font-medium text-gray-900">{TENANT_REVIEWS_CARD_TITLE}</h1>
      <p className="mt-3 text-sm leading-6 text-gray-500">{TENANT_REVIEWS_DESCRIPTION_AS_TENANT}</p>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-8 w-full">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {TENANT_REVIEWS_CARD_TITLE} ({rows.length})
          </h2>
          <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">No reviews yet.</p>
            ) : (
              rows.map((row) => {
                const landlordName = row.landlord?.display_name?.trim() || 'Landlord'
                return (
                  <div key={row.id} className="p-5">
                    <TenantReviewListRowContent
                      authorLabel={landlordName}
                      createdAtIso={row.created_at}
                      rating={row.rating}
                      propertyName={row.property_name}
                      propertyAddress={row.property_address}
                      comment={row.comment}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
