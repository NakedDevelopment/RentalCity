/**
 * One-time backfill: geocode existing `properties` and `tenant_application_profiles`
 * rows that have an address but no lat/lng yet.
 *
 * Usage: tsx scripts/backfill-geocode.ts
 */
import { config } from 'dotenv'
config({ path: '.env.development.local' })
config({ path: '.env.local' })
config()
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { geocodeAddress, buildAddressString } from '../server/geocode'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const apiKey = process.env.GOOGLE_MAPS_API_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const DELAY_MS = 100
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type FailedRow = { id: string; status: string; error_message?: string }

async function backfillProperties(): Promise<{ total: number; succeeded: number; failed: FailedRow[] }> {
  const { data, error } = await supabase
    .from('properties')
    .select('id, address_line1, address_line2, city, state, postal_code')
    .is('lat', null)
    .not('address_line1', 'is', null)
  if (error) throw error

  const rows = (data ?? []) as Array<{
    id: string; address_line1: string | null; address_line2: string | null
    city: string | null; state: string | null; postal_code: string | null
  }>

  let succeeded = 0
  const failed: FailedRow[] = []
  for (const row of rows) {
    const address = buildAddressString({
      addressLine1: row.address_line1, addressLine2: row.address_line2,
      city: row.city, state: row.state, postalCode: row.postal_code,
    })
    const result = await geocodeAddress(address, apiKey)
    if (result.ok) {
      const { error: updateError } = await supabase
        .from('properties')
        .update({ lat: result.lat, lng: result.lng })
        .eq('id', row.id)
      if (updateError) {
        failed.push({ id: row.id, status: 'db_update_failed', error_message: updateError.message })
      } else {
        succeeded++
      }
    } else {
      console.error(`properties ${row.id}: status=${result.status}${result.error_message ? ` error_message=${result.error_message}` : ''}`)
      failed.push({ id: row.id, status: result.status, error_message: result.error_message })
    }
    await sleep(DELAY_MS)
  }
  return { total: rows.length, succeeded, failed }
}

async function backfillTenantApplicationProfiles(): Promise<{ total: number; succeeded: number; failed: FailedRow[] }> {
  const { data, error } = await supabase
    .from('tenant_application_profiles')
    .select('tenant_id, address_line1, address_line2, city, state, postal_code')
    .is('lat', null)
    .not('address_line1', 'is', null)
  if (error) throw error

  const rows = (data ?? []) as Array<{
    tenant_id: string; address_line1: string | null; address_line2: string | null
    city: string | null; state: string | null; postal_code: string | null
  }>

  let succeeded = 0
  const failed: FailedRow[] = []
  for (const row of rows) {
    const address = buildAddressString({
      addressLine1: row.address_line1, addressLine2: row.address_line2,
      city: row.city, state: row.state, postalCode: row.postal_code,
    })
    const result = await geocodeAddress(address, apiKey)
    if (result.ok) {
      const { error: updateError } = await supabase
        .from('tenant_application_profiles')
        .update({ lat: result.lat, lng: result.lng })
        .eq('tenant_id', row.tenant_id)
      if (updateError) {
        failed.push({ id: row.tenant_id, status: 'db_update_failed', error_message: updateError.message })
      } else {
        succeeded++
      }
    } else {
      console.error(`tenant_application_profiles ${row.tenant_id}: status=${result.status}${result.error_message ? ` error_message=${result.error_message}` : ''}`)
      failed.push({ id: row.tenant_id, status: result.status, error_message: result.error_message })
    }
    await sleep(DELAY_MS)
  }
  return { total: rows.length, succeeded, failed }
}

async function main() {
  const properties = await backfillProperties()
  const tenantProfiles = await backfillTenantApplicationProfiles()

  const totalFailed = [...properties.failed, ...tenantProfiles.failed]
  console.log('\n=== SUMMARY ===')
  console.log(`properties: total=${properties.total} succeeded=${properties.succeeded} failed=${properties.failed.length}`)
  console.log(`tenant_application_profiles: total=${tenantProfiles.total} succeeded=${tenantProfiles.succeeded} failed=${tenantProfiles.failed.length}`)
  if (totalFailed.length > 0) {
    console.log('\nFailed rows:')
    for (const f of totalFailed) {
      console.log(`  ${f.id} — status=${f.status}${f.error_message ? ` error_message=${f.error_message}` : ''}`)
    }
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
