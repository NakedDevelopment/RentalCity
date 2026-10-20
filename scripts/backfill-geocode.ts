/**
 * Exact RentCast locations for existing listings with missing coordinates.
 * Default is read-only, no provider calls. Use --apply to resolve and update.
 * Tenant data is deliberately excluded from this listing-only operation.
 */
import { config } from 'dotenv'
config({ path: '.env.development.local' })
config({ path: '.env.local' })
config()
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { mkdir, writeFile } from 'node:fs/promises'
import { lookupPropertyLocation, type AddressParts } from '../server/geocode'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const apiKey = process.env.RENTCAST_API_KEY
const apply = process.argv.includes('--apply')
if (!url || !serviceKey || (apply && !apiKey)) throw new Error('Missing backfill configuration')
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})
const columns = ['address_line1', 'address_line2', 'city', 'state', 'postal_code'] as const
type Row = { id: string; lat: number | null; lng: number | null } & Record<typeof columns[number], string | null>
const { data, error } = await db.from('properties')
  .select('id,address_line1,address_line2,city,state,postal_code,lat,lng')
  .or('lat.is.null,lng.is.null').order('id')
if (error) throw new Error('Could not read listing coordinates')
const rows = (data ?? []) as Row[]
console.log(`Listings with missing coordinates: ${rows.length}. Mode: ${apply ? 'apply' : 'read-only (no provider calls)'}`)
const results: Array<{ id: string; status: string }> = []
if (apply) {
  for (const row of rows) {
    const address: AddressParts = {
      addressLine1: row.address_line1, addressLine2: row.address_line2,
      city: row.city, state: row.state, postalCode: row.postal_code,
    }
    const result = await lookupPropertyLocation(address, apiKey)
    if (result.ok) {
      let update = db.from('properties').update({ lat: result.lat, lng: result.lng }).eq('id', row.id)
      // Don't overwrite concurrent address edits or locations resolved by a user.
      for (const column of [...columns, 'lat', 'lng'] as const) {
        update = row[column] == null ? update.is(column, null) : update.eq(column, row[column]!)
      }
      const { data: changed, error: updateError } = await update.select('id')
      results.push({ id: row.id, status: updateError ? 'update_failed' : changed?.length ? 'updated' : 'skipped_concurrent_change' })
    } else {
      results.push({ id: row.id, status: result.status })
      // Stop rather than multiply requests after a credential/quota/provider failure.
      if (['missing_key', 'provider_401', 'provider_403', 'provider_429', 'request_failed'].includes(result.status) ||
        result.status.startsWith('provider_5')) {
        console.log(`Stopping: ${result.status}`)
        break
      }
    }
    if (results.length % 10 === 0) console.log(`Processed ${results.length}/${rows.length}`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  const counts: Record<string, number> = {}
  for (const row of results) counts[row.status] = (counts[row.status] ?? 0) + 1
  const report = { total: rows.length, processed: results.length, counts, results }
  await mkdir('generated-artifacts', { recursive: true })
  await writeFile('generated-artifacts/listing-coordinate-backfill.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ total: rows.length, processed: results.length, counts }))
  if (results.some((row) => row.status === 'update_failed') || results.length < rows.length) process.exitCode = 1
}
