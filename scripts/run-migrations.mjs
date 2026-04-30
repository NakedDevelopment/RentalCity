#!/usr/bin/env node
/**
 * Run Supabase migrations via direct Postgres connection.
 * Intended for an empty database: replays the full chain from initial_schema.
 * On an existing DB, use `npm run db:apply-sql` with a single migration file instead.
 * Requires: SUPABASE_DB_URL or DATABASE_URL
 * Get from: Supabase Dashboard > Project Settings > Database > Connection string (URI)
 */
import { config } from 'dotenv'
config({ path: '.env.development.local' })
config({ path: '.env.local' })
config()

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL')
  console.error('Get it from: Supabase Dashboard > Project Settings > Database > Connection string (URI)')
  process.exit(1)
}

const migration1 = readFileSync(
  join(__dirname, '../supabase/migrations/20250225000001_initial_schema.sql'),
  'utf-8'
)
const migration2 = readFileSync(
  join(__dirname, '../supabase/migrations/20250225000002_rls_policies.sql'),
  'utf-8'
)
const migration3 = readFileSync(
  join(__dirname, '../supabase/migrations/20250302000001_tenant_preferences_extend.sql'),
  'utf-8'
)
const migration4 = readFileSync(
  join(__dirname, '../supabase/migrations/20250307000001_support_requests_and_tenant_ratings.sql'),
  'utf-8'
)
const migration5 = readFileSync(
  join(__dirname, '../supabase/migrations/20250307000002_property_metadata.sql'),
  'utf-8'
)
const migration6 = readFileSync(
  join(__dirname, '../supabase/migrations/20250307000003_message_thread_touch.sql'),
  'utf-8'
)
const migration7 = readFileSync(
  join(__dirname, '../supabase/migrations/20250307000004_related_profile_reads.sql'),
  'utf-8'
)
const migration8 = readFileSync(
  join(__dirname, '../supabase/migrations/20250310000001_application_unlocked_at.sql'),
  'utf-8'
)
const migration8b = readFileSync(
  join(__dirname, '../supabase/migrations/20250310000002_landlord_survey_completed.sql'),
  'utf-8'
)
const migration9 = readFileSync(
  join(__dirname, '../supabase/migrations/20250310000003_property_images_bucket.sql'),
  'utf-8'
)
const migration10 = readFileSync(
  join(__dirname, '../supabase/migrations/20250310000004_property_photo_urls.sql'),
  'utf-8'
)
const migration11 = readFileSync(
  join(__dirname, '../supabase/migrations/20250312000001_tenant_survey_completed.sql'),
  'utf-8'
)

const migration12 = readFileSync(
  join(__dirname, '../supabase/migrations/20260319000001_universal_applications.sql'),
  'utf-8'
)
const migration13 = readFileSync(
  join(__dirname, '../supabase/migrations/20260329000001_applications_unlock_before_decision.sql'),
  'utf-8'
)
const migration14 = readFileSync(
  join(__dirname, '../supabase/migrations/20260329140000_landlord_tenant_invites.sql'),
  'utf-8'
)
const migration15 = readFileSync(
  join(__dirname, '../supabase/migrations/20260329160000_decline_applications_when_property_filled.sql'),
  'utf-8'
)
const migration16 = readFileSync(
  join(__dirname, '../supabase/migrations/20260330120000_sample_landlord_property_photos.sql'),
  'utf-8'
)
const migration17 = readFileSync(
  join(__dirname, '../supabase/migrations/20260330200000_message_threads_one_per_landlord_tenant.sql'),
  'utf-8'
)
const migration18 = readFileSync(
  join(__dirname, '../supabase/migrations/20260331100000_tenant_ratings_public_read.sql'),
  'utf-8'
)
const migration19 = readFileSync(
  join(__dirname, '../supabase/migrations/20260331120000_universal_applications_landlord_read.sql'),
  'utf-8'
)
const migration20 = readFileSync(
  join(__dirname, '../supabase/migrations/20260331140000_landlord_tenant_universal_application_rpc.sql'),
  'utf-8'
)
const migration21 = readFileSync(
  join(__dirname, '../supabase/migrations/20260331150000_tenant_ratings_and_profiles_read_for_reviews.sql'),
  'utf-8'
)
const migration22 = readFileSync(
  join(__dirname, '../supabase/migrations/20260331160000_landlord_universal_application_access_expand.sql'),
  'utf-8'
)

const migration23 = readFileSync(
  join(__dirname, '../supabase/migrations/20260401090000_background_checks_universal_screenings.sql'),
  'utf-8'
)

const migration24 = readFileSync(
  join(__dirname, '../supabase/migrations/20260401113000_landlord_profile_business_fields.sql'),
  'utf-8'
)

const migration25 = readFileSync(
  join(__dirname, '../supabase/migrations/20260402140000_reports_rls_messaging_counterpart.sql'),
  'utf-8'
)

const migration26 = readFileSync(
  join(__dirname, '../supabase/migrations/20260403100000_site_settings.sql'),
  'utf-8'
)

const client = new pg.Client({ connectionString: dbUrl })

const APPLY_SINGLE_HINT = `This project’s Supabase DB already has schema (or you are not on an empty database).

  "${'npm run db:migrate'}" replays the entire migration chain from zero and only succeeds on a fresh database.

  To add new SQL to an existing Supabase project, apply one file at a time, for example:

    npm run db:apply-sql -- supabase/migrations/20260401113000_landlord_profile_business_fields.sql

  Or paste that file into Supabase Dashboard → SQL → New query.`

async function assertEmptyForFullMigrate() {
  const { rows } = await client.query(`
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
    LIMIT 1
  `)
  if (rows.length > 0) {
    console.error(APPLY_SINGLE_HINT)
    process.exit(1)
  }
}

async function run() {
  try {
    await client.connect()
    await assertEmptyForFullMigrate()
    console.log('Running initial schema...')
    await client.query(migration1)
    console.log('Initial schema OK')
    console.log('Running RLS policies...')
    await client.query(migration2)
    console.log('RLS policies OK')
    console.log('Running tenant_preferences extend...')
    await client.query(migration3)
    console.log('Tenant preferences extend OK')
    console.log('Running support requests and tenant ratings updates...')
    await client.query(migration4)
    console.log('Support requests and tenant ratings updates OK')
    console.log('Running property metadata updates...')
    await client.query(migration5)
    console.log('Property metadata updates OK')
    console.log('Running message thread touch updates...')
    await client.query(migration6)
    console.log('Message thread touch updates OK')
    console.log('Running related profile read updates...')
    await client.query(migration7)
    console.log('Related profile read updates OK')
    console.log('Running application unlocked_at...')
    await client.query(migration8)
    console.log('Application unlocked_at OK')
    console.log('Running landlord survey completed...')
    await client.query(migration8b)
    console.log('Landlord survey completed OK')
    console.log('Running property images bucket...')
    await client.query(migration9)
    console.log('Property images bucket OK')
    console.log('Running property photo_urls...')
    await client.query(migration10)
    console.log('Property photo_urls OK')
    console.log('Running tenant survey completed...')
    await client.query(migration11)
    console.log('Tenant survey completed OK')

    console.log('Running universal applications...')
    await client.query(migration12)
    console.log('Universal applications OK')
    console.log('Running applications unlock-before-decision trigger...')
    await client.query(migration13)
    console.log('Applications unlock-before-decision OK')
    console.log('Running landlord tenant invites...')
    await client.query(migration14)
    console.log('Landlord tenant invites OK')
    console.log('Running decline applications when property off-market...')
    await client.query(migration15)
    console.log('Decline applications when property off-market OK')
    console.log('Running sample landlord property photos...')
    await client.query(migration16)
    console.log('Sample landlord property photos OK')
    console.log('Running message threads one-per landlord-tenant...')
    await client.query(migration17)
    console.log('Message threads one-per landlord-tenant OK')
    console.log('Running tenant_ratings public read RLS...')
    await client.query(migration18)
    console.log('tenant_ratings public read RLS OK')
    console.log('Running universal_applications landlord read RLS...')
    await client.query(migration19)
    console.log('universal_applications landlord read RLS OK')
    console.log('Running landlord_tenant_universal_application RPC...')
    await client.query(migration20)
    console.log('landlord_tenant_universal_application RPC OK')
    console.log('Running tenant_ratings + profiles read for shared reviews...')
    await client.query(migration21)
    console.log('tenant_ratings + profiles read for shared reviews OK')
    console.log('Running landlord universal application access expand...')
    await client.query(migration22)
    console.log('landlord universal application access expand OK')
    console.log('Running universal application screenings...')
    await client.query(migration23)
    console.log('universal application screenings OK')
    console.log('Running landlord profile business fields...')
    await client.query(migration24)
    console.log('landlord profile business fields OK')
    console.log('Running reports RLS (messaging counterpart)...')
    await client.query(migration25)
    console.log('reports RLS OK')
    console.log('Running site_settings...')
    await client.query(migration26)
    console.log('site_settings OK')
    console.log('Migrations complete.')
  } catch (err) {
    const msg = err?.message ?? String(err)
    console.error('Migration failed:', msg)
    if (/already exists/i.test(msg)) {
      console.error('')
      console.error(APPLY_SINGLE_HINT)
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
