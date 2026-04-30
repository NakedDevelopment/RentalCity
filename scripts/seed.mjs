#!/usr/bin/env node
/**
 * Seed script for dummy data (properties, applications, payments, notifications,
 * support_requests + reports for admin Issues, etc.).
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: npm run db:seed
 */

import { config } from 'dotenv'
config({ path: '.env.development.local' })
config({ path: '.env.local' })
config()
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const TEST_PASSWORD = 'TestPassword123!'

/** Unsplash samples for landlord@test.rentalcity.com listings (main + extras by label). */
const SAMPLE_PROPERTY_PHOTOS_BY_ADDRESS = {
  '123 Oak Street, Apt 4B': [
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&h=800&fit=crop',
  ],
  '456 Pine Avenue, Unit 2A': [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop',
  ],
  '789 Maple Drive, Suite 1C': [
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&h=800&fit=crop',
  ],
  '210 Birch Road, Unit 1': [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&h=800&fit=crop',
  ],
}

async function main() {
  console.log('Seeding dummy data...')

  // Create or get test users
  let landlordId, tenantId, declinedTenantId, lockedTenantId, unlockedTenantId
  /** Extra tenant accounts so landlord@test can have many distinct ratings (unique per tenant_external_id). */
  const ratingDemoTenants = []

  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 100 })
  const landlordUser = existingUsers?.users?.find((u) => u.email === 'landlord@test.rentalcity.com')
  const tenantUser = existingUsers?.users?.find((u) => u.email === 'tenant@test.rentalcity.com')
  const declinedTenantUser = existingUsers?.users?.find((u) => u.email === 'declined@test.rentalcity.com')
  const lockedTenantUser = existingUsers?.users?.find((u) => u.email === 'locked@test.rentalcity.com')
  const unlockedTenantUser = existingUsers?.users?.find((u) => u.email === 'unlocked@test.rentalcity.com')

  if (landlordUser) {
    landlordId = landlordUser.id
    console.log('Landlord user exists:', landlordUser.email)
  } else {
    const { data: ld, error: le } = await supabase.auth.admin.createUser({
      email: 'landlord@test.rentalcity.com',
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (le) {
      console.error('Failed to create landlord:', le.message)
      console.error('')
      console.error('Create users manually in Supabase Dashboard > Authentication > Users > Add user')
      console.error('Then run: npm run db:seed')
      console.error('Use emails: landlord@test.rentalcity.com and tenant@test.rentalcity.com')
      process.exit(1)
    }
    landlordId = ld.user.id
    console.log('Created landlord:', ld.user.email)
  }

  if (tenantUser) {
    tenantId = tenantUser.id
    console.log('Tenant user exists:', tenantUser.email)
  } else {
    const { data: td, error: te } = await supabase.auth.admin.createUser({
      email: 'tenant@test.rentalcity.com',
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (te) {
      console.error('Failed to create tenant:', te.message)
      console.error('')
      console.error('Create users manually in Supabase Dashboard > Authentication > Users > Add user')
      console.error('Then run: npm run db:seed')
      console.error('Use emails: landlord@test.rentalcity.com and tenant@test.rentalcity.com')
      process.exit(1)
    }
    tenantId = td.user.id
    console.log('Created tenant:', td.user.email)
  }

  if (declinedTenantUser) {
    declinedTenantId = declinedTenantUser.id
    console.log('Declined tenant user exists:', declinedTenantUser.email)
  } else {
    const { data: dd, error: de } = await supabase.auth.admin.createUser({
      email: 'declined@test.rentalcity.com',
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (de) {
      console.error('Failed to create declined tenant:', de.message)
    } else {
      declinedTenantId = dd.user.id
      console.log('Created declined tenant:', dd.user.email)
    }
  }

  if (lockedTenantUser) {
    lockedTenantId = lockedTenantUser.id
    console.log('Locked tenant user exists:', lockedTenantUser.email)
  } else {
    const { data: dl, error: dlErr } = await supabase.auth.admin.createUser({
      email: 'locked@test.rentalcity.com',
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (dlErr) {
      console.error('Failed to create locked tenant:', dlErr.message)
    } else {
      lockedTenantId = dl.user.id
      console.log('Created locked tenant:', dl.user.email)
    }
  }

  if (unlockedTenantUser) {
    unlockedTenantId = unlockedTenantUser.id
    console.log('Unlocked tenant user exists:', unlockedTenantUser.email)
  } else {
    const { data: du, error: duErr } = await supabase.auth.admin.createUser({
      email: 'unlocked@test.rentalcity.com',
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (duErr) {
      console.error('Failed to create unlocked tenant:', duErr.message)
    } else {
      unlockedTenantId = du.user.id
      console.log('Created unlocked tenant:', du.user.email)
    }
  }

  const ratingDemoTenantSpecs = [
    { email: 'ratingdemo1@test.rentalcity.com', display_name: 'Alex Kim' },
    { email: 'ratingdemo2@test.rentalcity.com', display_name: 'Jordan Martinez' },
    { email: 'ratingdemo3@test.rentalcity.com', display_name: 'Samira Okonkwo' },
    { email: 'ratingdemo4@test.rentalcity.com', display_name: 'Taylor Brooks' },
    { email: 'ratingdemo5@test.rentalcity.com', display_name: 'Riley Chen' },
    { email: 'ratingdemo6@test.rentalcity.com', display_name: 'Casey Nguyen' },
  ]
  for (const spec of ratingDemoTenantSpecs) {
    let u = existingUsers?.users?.find((x) => x.email === spec.email)
    if (!u) {
      const { data: created, error: te } = await supabase.auth.admin.createUser({
        email: spec.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      })
      if (te) {
        console.warn(`Optional rating demo tenant ${spec.email}:`, te.message)
        continue
      }
      u = created.user
      console.log('Created rating demo tenant:', spec.email)
    } else {
      console.log('Rating demo tenant exists:', spec.email)
    }
    ratingDemoTenants.push({ id: u.id, display_name: spec.display_name })
  }

  // Extra landlord accounts so Test Tenant can show reviews from multiple landlords
  const extraLandlordSpecs = [
    { email: 'landlord2@test.rentalcity.com', display_name: 'Morgan Patel' },
    { email: 'landlord3@test.rentalcity.com', display_name: 'Riverside Rentals LLC' },
    { email: 'landlord4@test.rentalcity.com', display_name: 'Jordan Lee' },
    { email: 'landlord5@test.rentalcity.com', display_name: 'Elena Vasquez' },
    { email: 'landlord6@test.rentalcity.com', display_name: 'Northside Properties' },
    { email: 'landlord7@test.rentalcity.com', display_name: 'Sam Okonkwo' },
  ]
  const extraLandlordProfileRows = []
  /** Map email → auth user id (avoids stale listUsers when seeding reviews in the same run). */
  const extraLandlordIdByEmail = new Map()
  for (const spec of extraLandlordSpecs) {
    let u = existingUsers?.users?.find((x) => x.email === spec.email)
    if (!u) {
      const { data: created, error: le } = await supabase.auth.admin.createUser({
        email: spec.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      })
      if (le) {
        console.warn(`Optional landlord ${spec.email}:`, le.message)
        continue
      }
      u = created.user
      console.log('Created landlord:', spec.email)
    } else {
      console.log('Landlord user exists:', spec.email)
    }
    extraLandlordIdByEmail.set(spec.email, u.id)
    extraLandlordProfileRows.push({ id: u.id, role: 'landlord', display_name: spec.display_name })
  }

  // Ensure profiles exist
  const profileRows = [
    { id: landlordId, role: 'landlord', display_name: 'Test Landlord' },
    { id: tenantId, role: 'tenant', display_name: 'Test Tenant' },
  ]
  if (declinedTenantId) {
    profileRows.push({ id: declinedTenantId, role: 'tenant', display_name: 'Declined Tenant' })
  }
  if (lockedTenantId) {
    profileRows.push({ id: lockedTenantId, role: 'tenant', display_name: 'Locked Tenant' })
  }
  if (unlockedTenantId) {
    profileRows.push({ id: unlockedTenantId, role: 'tenant', display_name: 'Unlocked Tenant' })
  }
  for (const t of ratingDemoTenants) {
    profileRows.push({ id: t.id, role: 'tenant', display_name: t.display_name })
  }
  profileRows.push(...extraLandlordProfileRows)
  await supabase.from('profiles').upsert(profileRows, { onConflict: 'id' })

  // Properties
  const { data: props } = await supabase
    .from('properties')
    .select('id')
    .eq('landlord_id', landlordId)
    .limit(1)

  let propertyId
  if (props?.length) {
    propertyId = props[0].id
    console.log('Property exists:', propertyId)
  } else {
    const { data: p, error: pe } = await supabase
      .from('properties')
      .insert({
        landlord_id: landlordId,
        address_line1: '123 Oak Street, Apt 4B',
        city: 'Rochester',
        state: 'NY',
        postal_code: '14616',
        country: 'US',
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        monthly_rent_cents: 145000,
        deposit_cents: 290000,
        description: 'Spacious apartment with modern amenities.',
        status: 'active',
        title: '123 Oak Street, Apt 4B',
        amenities: ['pet_friendly', 'parking', 'laundry'],
        photo_labels: ['living_room', 'kitchen', 'bedroom'],
        photo_urls: SAMPLE_PROPERTY_PHOTOS_BY_ADDRESS['123 Oak Street, Apt 4B'],
      })
      .select('id')
      .single()
    if (pe) {
      console.error('Failed to create property:', pe.message)
      process.exit(1)
    }
    propertyId = p.id
    console.log('Created property:', propertyId)

    // Extra properties for HomePage / browsing
    await supabase.from('properties').insert([
      {
        landlord_id: landlordId,
        address_line1: '456 Pine Avenue, Unit 2A',
        city: 'Rochester',
        state: 'NY',
        postal_code: '14616',
        bedrooms: 1,
        bathrooms: 1,
        sqft: 750,
        monthly_rent_cents: 120000,
        status: 'active',
        title: '456 Pine Avenue, Unit 2A',
        amenities: ['gym', 'balcony'],
        photo_labels: ['living_room'],
        photo_urls: SAMPLE_PROPERTY_PHOTOS_BY_ADDRESS['456 Pine Avenue, Unit 2A'],
      },
      {
        landlord_id: landlordId,
        address_line1: '789 Maple Drive, Suite 1C',
        city: 'Buffalo',
        state: 'NY',
        postal_code: '14224',
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1800,
        monthly_rent_cents: 180000,
        status: 'active',
        title: '789 Maple Drive, Suite 1C',
        amenities: ['pet_friendly', 'yard', 'parking'],
        photo_labels: ['living_room', 'bedroom'],
        photo_urls: SAMPLE_PROPERTY_PHOTOS_BY_ADDRESS['789 Maple Drive, Suite 1C'],
      },
    ])
  }

  const { data: landlordPropsForPhotos } = await supabase
    .from('properties')
    .select('id, address_line1, photo_urls')
    .eq('landlord_id', landlordId)

  for (const row of landlordPropsForPhotos ?? []) {
    const hasPhotos =
      Array.isArray(row.photo_urls) &&
      row.photo_urls.length > 0 &&
      row.photo_urls.some((u) => u && String(u).trim() !== '')
    if (hasPhotos) continue
    const urls = SAMPLE_PROPERTY_PHOTOS_BY_ADDRESS[row.address_line1]
    if (!urls?.length) continue
    const { error: photoErr } = await supabase.from('properties').update({ photo_urls: urls }).eq('id', row.id)
    if (photoErr) {
      console.error(`Sample photos for ${row.address_line1}:`, photoErr.message)
    } else {
      console.log('Added sample photos:', row.address_line1)
    }
  }

  // Applications
  const { data: apps } = await supabase
    .from('applications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('property_id', propertyId)
    .limit(1)

  let appId
  if (apps?.length) {
    appId = apps[0].id
    console.log('Application exists:', appId)
  } else {
    const { data: a, error: ae } = await supabase
      .from('applications')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        status: 'approved',
        message: 'I am interested in this property.',
      })
      .select('id')
      .single()
    if (ae) {
      console.error('Failed to create application:', ae.message)
      process.exit(1)
    }
    appId = a.id
    console.log('Created application:', appId)
  }

  // More matches for Test Tenant (same tenant, different listings — multiple accepted allowed)
  const { data: landlordPropList } = await supabase
    .from('properties')
    .select('id, address_line1')
    .eq('landlord_id', landlordId)

  const propIdIncludes = (needle) =>
    landlordPropList?.find((p) => String(p.address_line1 || '').includes(needle))?.id

  const pineId = propIdIncludes('Pine')
  const mapleId = propIdIncludes('Maple')

  for (const { pid, message } of [
    {
      pid: pineId,
      message: 'Interested in the Pine Avenue unit — quiet building preferred.',
    },
    {
      pid: mapleId,
      message: 'The Maple Drive listing looks great for our family.',
    },
  ].filter((x) => x.pid)) {
    const { data: existsExtra } = await supabase
      .from('applications')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('property_id', pid)
      .limit(1)
    if (existsExtra?.length) continue
    const { error: extraErr } = await supabase.from('applications').insert({
      tenant_id: tenantId,
      property_id: pid,
      status: 'approved',
      message,
    })
    if (extraErr) {
      console.error('Extra Test Tenant application:', extraErr.message)
    } else {
      console.log('Created additional approved application for Test Tenant:', pid)
    }
  }

  // Birch listing + Test Tenant: Matches card should show Approve/Decline (pending + unlocked_at), not only "Unlock".
  // Declined-filter demos use `declinedTenantId` on the main seed property instead.
  const birchIdExisting = landlordPropList?.find((p) =>
    String(p.address_line1 || '').includes('Birch'),
  )?.id
  let birchPropertyId = birchIdExisting ?? null
  if (!birchPropertyId) {
    const { data: birchRow, error: birchErr } = await supabase
      .from('properties')
      .insert({
        landlord_id: landlordId,
        address_line1: '210 Birch Road, Unit 1',
        city: 'Rochester',
        state: 'NY',
        postal_code: '14616',
        country: 'US',
        bedrooms: 1,
        bathrooms: 1,
        sqft: 640,
        monthly_rent_cents: 110000,
        deposit_cents: 220000,
        status: 'active',
        title: '210 Birch Road, Unit 1',
        amenities: ['laundry'],
        photo_labels: ['living_room'],
        photo_urls: SAMPLE_PROPERTY_PHOTOS_BY_ADDRESS['210 Birch Road, Unit 1'],
      })
      .select('id')
      .single()
    if (birchErr) {
      console.error('Birch property (Test Tenant matches demo):', birchErr.message)
    } else if (birchRow) {
      birchPropertyId = birchRow.id
      console.log('Created Birch property for Test Tenant matches demo:', birchPropertyId)
    }
  }
  if (birchPropertyId && tenantId) {
    const nowIso = new Date().toISOString()
    const { data: birchApps, error: birchAppsErr } = await supabase
      .from('applications')
      .select('id, status, unlocked_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('property_id', birchPropertyId)
      .order('created_at', { ascending: false })

    if (birchAppsErr) {
      console.error('Birch Test Tenant applications:', birchAppsErr.message)
    } else if (!birchApps?.length) {
      const { error: insErr } = await supabase.from('applications').insert({
        tenant_id: tenantId,
        property_id: birchPropertyId,
        status: 'pending',
        unlocked_at: nowIso,
        message: 'Interested in this Birch unit — flexible move-in.',
      })
      if (insErr) {
        console.error('Birch Test Tenant application insert:', insErr.message)
      } else {
        console.log('Created Birch Test Tenant application (pending + unlocked for Matches demo)')
      }
    } else {
      const pending = birchApps.filter((a) => a.status === 'pending')
      const hasUnlockedPending = pending.some((a) => a.unlocked_at != null && String(a.unlocked_at).trim() !== '')
      if (hasUnlockedPending) {
        console.log('Birch Test Tenant: unlocked pending application already present')
      } else if (pending.length > 0) {
        const target = pending[0]
        const { error: upErr } = await supabase
          .from('applications')
          .update({ unlocked_at: nowIso })
          .eq('id', target.id)
        if (upErr) {
          console.error('Birch Test Tenant unlock_at update:', upErr.message)
        } else {
          console.log('Set unlocked_at on Birch Test Tenant pending application:', target.id)
        }
      } else if (birchApps.every((a) => a.status === 'rejected')) {
        const target = birchApps[0]
        const { error: upErr } = await supabase
          .from('applications')
          .update({ status: 'pending', unlocked_at: nowIso })
          .eq('id', target.id)
        if (upErr) {
          console.error('Birch Test Tenant rejected -> pending+unlocked:', upErr.message)
        } else {
          console.log('Upgraded Birch Test Tenant application to pending+unlocked (matches demo)')
        }
      }
    }
  }

  // Declined-tenant application (rejected)
  if (declinedTenantId && propertyId) {
    const { data: existingDeclined } = await supabase
      .from('applications')
      .select('id')
      .eq('tenant_id', declinedTenantId)
      .eq('property_id', propertyId)
      .limit(1)
    if (!existingDeclined?.length) {
      await supabase.from('applications').insert({
        tenant_id: declinedTenantId,
        property_id: propertyId,
        status: 'rejected',
        message: 'I was really hoping to rent this place. Please reconsider.',
      })
      console.log('Created declined tenant application (rejected)')
    }
  }

  // Locked-tenant application (pending, no unlocked_at)
  if (lockedTenantId && propertyId) {
    const { data: existingLocked } = await supabase
      .from('applications')
      .select('id')
      .eq('tenant_id', lockedTenantId)
      .eq('property_id', propertyId)
      .limit(1)
    if (!existingLocked?.length) {
      await supabase.from('applications').insert({
        tenant_id: lockedTenantId,
        property_id: propertyId,
        status: 'pending',
        message: 'Interested in viewing this unit. Flexible on move-in.',
      })
      console.log('Created locked tenant application (pending)')
    }
  }

  // Unlocked-tenant application (pending + unlocked_at so landlord can accept/decline)
  if (unlockedTenantId && propertyId) {
    const { data: existingUnlocked } = await supabase
      .from('applications')
      .select('id')
      .eq('tenant_id', unlockedTenantId)
      .eq('property_id', propertyId)
      .limit(1)
    if (!existingUnlocked?.length) {
      await supabase.from('applications').insert({
        tenant_id: unlockedTenantId,
        property_id: propertyId,
        status: 'pending',
        unlocked_at: new Date().toISOString(),
        message: 'Would love to rent here. Happy to provide references.',
      })
      console.log('Created unlocked tenant application (pending + unlocked_at)')
    }
  }

  // Payments (tenant application fee)
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('id')
    .eq('application_id', appId)
    .limit(1)

  if (!existingPayments?.length) {
    await supabase.from('payments').insert([
      { application_id: appId, payer_id: tenantId, amount_cents: 2500, status: 'succeeded', description: 'Application Fee' },
      { application_id: appId, payer_id: tenantId, amount_cents: 2500, status: 'expired', description: 'Application Fee' },
    ])
    console.log('Created tenant payments')

    // Landlord payments (match unlock style - use description, payer_id = landlord)
    await supabase.from('payments').insert([
      { application_id: appId, payer_id: landlordId, amount_cents: 2999, status: 'succeeded', description: 'Match Unlock - Premium Tenant Profile' },
      { application_id: appId, payer_id: landlordId, amount_cents: 1999, status: 'succeeded', description: 'Background Check Access' },
      { application_id: appId, payer_id: landlordId, amount_cents: 4999, status: 'succeeded', description: 'Premium Listing Boost' },
      { application_id: appId, payer_id: landlordId, amount_cents: 2999, status: 'failed', description: 'Match Unlock - Premium Tenant Profile' },
    ])
    console.log('Created landlord payments')
  }

  // Notifications (link + property_id so "View Property" goes to the specific property)
  await supabase.from('notifications').insert([
    { user_id: tenantId, title: 'Application Approved', body: 'Your application for 123 Oak Street has been approved.', type: 'application_approved', link: '/applications' },
    { user_id: tenantId, title: 'New Match', body: 'A new property matches your preferences.', type: 'property_match', link: `/property/${propertyId}`, property_id: propertyId },
    { user_id: tenantId, title: 'Message', body: "Sarah Johnson sent you a message about the property at 456 Pine Avenue. She'd like to schedule a viewing.", type: 'message', link: '/messages' },
    { user_id: landlordId, title: 'New Application', body: 'A new application for 123 Oak Street.', type: 'application_update', link: '/matches' },
  ])
  console.log('Inserted notifications')

  // Message threads and messages (one thread per landlord–tenant pair)
  const { data: existingThreads } = await supabase
    .from('message_threads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('landlord_id', landlordId)
    .limit(1)

  if (!existingThreads?.length) {
    const { data: thread, error: threadErr } = await supabase
      .from('message_threads')
      .insert({
        tenant_id: tenantId,
        landlord_id: landlordId,
        property_id: propertyId,
        application_id: appId,
      })
      .select('id')
      .single()

    if (threadErr) {
      console.error('Failed to create message thread:', threadErr.message)
    } else {
      const threadId = thread.id
      await supabase.from('messages').insert([
        { thread_id: threadId, sender_id: tenantId, body: 'Hi! I applied for 123 Oak Street and wanted to introduce myself.' },
        { thread_id: threadId, sender_id: landlordId, body: 'Hello! Thanks for your interest. I’d be happy to answer any questions about the property.' },
        { thread_id: threadId, sender_id: tenantId, body: 'When would be a good time to schedule a viewing?' },
        { thread_id: threadId, sender_id: landlordId, body: 'I have availability this weekend. Saturday 2pm or Sunday 10am work for me. Which is better for you?' },
        { thread_id: threadId, sender_id: tenantId, body: 'Saturday at 2pm works great. See you then!' },
      ])
      console.log('Created message thread and 5 messages')
    }
  }

  // Past-tenant reviews for Test Tenant (other landlords — idempotent upsert on landlord_id + tenant_external_id)
  const reviewSeeds = [
    {
      email: 'landlord2@test.rentalcity.com',
      property_name: 'Sunset Studios',
      property_address: '400 Cedar Lane, Unit 5, Rochester, NY',
      rating: 5,
      comment: 'Excellent tenant — quiet, paid on time, and left the unit in great shape.',
      created_at: '2025-10-18T14:30:00.000Z',
    },
    {
      email: 'landlord3@test.rentalcity.com',
      property_name: 'Riverside Commons',
      property_address: '88 River Road, Apt 12, Buffalo, NY',
      rating: 4,
      comment: 'Professional and easy to work with. Minor wear at move-out but within normal range.',
      created_at: '2025-11-22T11:00:00.000Z',
    },
    {
      email: 'landlord4@test.rentalcity.com',
      property_name: 'Market Street Lofts',
      property_address: '12 Market Street, Floor 3, Rochester, NY',
      rating: 5,
      comment: 'Would happily rent to again. Clear communication throughout the lease.',
      created_at: '2026-01-08T09:15:00.000Z',
    },
    {
      email: 'landlord5@test.rentalcity.com',
      property_name: 'Highland Row Townhomes',
      property_address: '220 Highland Ave, Unit B, Rochester, NY',
      rating: 4,
      comment: null,
      created_at: '2026-02-14T16:45:00.000Z',
    },
    {
      email: 'landlord6@test.rentalcity.com',
      property_name: 'Lakeside Court',
      property_address: '9 Lakeside Court, Apt 2, Buffalo, NY',
      rating: 3,
      comment: 'Rent was always on time. A few noise complaints from neighbors in year two; we worked it out.',
      created_at: '2026-02-28T13:20:00.000Z',
    },
    {
      email: 'landlord7@test.rentalcity.com',
      property_name: 'Elmwood Duplex',
      property_address: '105 Elmwood Ave, Rochester, NY',
      rating: 5,
      comment: 'Spotless move-out and flexible on the final walkthrough. Highly recommend.',
      created_at: '2026-03-09T18:00:00.000Z',
    },
  ]
  for (const row of reviewSeeds) {
    const reviewerId = extraLandlordIdByEmail.get(row.email)
    if (!reviewerId) {
      console.warn('Skipping tenant_ratings seed (landlord account missing):', row.email)
      continue
    }
    const { error: trErr } = await supabase.from('tenant_ratings').upsert(
      {
        landlord_id: reviewerId,
        tenant_id: tenantId,
        tenant_external_id: tenantId,
        tenant_name: 'Test Tenant',
        property_name: row.property_name,
        property_address: row.property_address,
        rating: row.rating,
        comment: row.comment,
        created_at: row.created_at,
      },
      { onConflict: 'landlord_id,tenant_external_id' },
    )
    if (trErr) {
      console.warn('tenant_ratings seed:', row.email, trErr.message)
    } else {
      console.log('Seeded review from', row.email)
    }
  }

  // Ratings submitted by main test landlord (one per tenant_external_id)
  const mainLandlordRatingSeeds = [
    {
      tenantId: tenantId,
      tenant_name: 'Test Tenant',
      property_name: '123 Oak Street, Apt 4B',
      property_address: '123 Oak Street, Apt 4B, Rochester, NY 14616',
      rating: 4,
      comment: 'Very responsive tenant',
      created_at: '2026-03-09T12:00:00.000Z',
    },
    {
      tenantId: declinedTenantId,
      tenant_name: 'Declined Tenant',
      property_name: '456 Pine Avenue, Unit 2A',
      property_address: '456 Pine Avenue, Unit 2A, Rochester, NY 14616',
      rating: 3,
      comment: 'Short stay; no major issues at move-out.',
      created_at: '2026-02-20T10:30:00.000Z',
    },
    {
      tenantId: lockedTenantId,
      tenant_name: 'Locked Tenant',
      property_name: '789 Maple Drive, Suite 1C',
      property_address: '789 Maple Drive, Suite 1C, Buffalo, NY 14224',
      rating: 5,
      comment: 'Excellent communication and care for the unit.',
      created_at: '2026-02-11T09:00:00.000Z',
    },
    {
      tenantId: unlockedTenantId,
      tenant_name: 'Unlocked Tenant',
      property_name: '210 Birch Road, Unit 1',
      property_address: '210 Birch Road, Unit 1, Rochester, NY 14616',
      rating: 4,
      comment: null,
      created_at: '2026-01-28T16:15:00.000Z',
    },
    ...ratingDemoTenants.map((t, i) => {
      const labels = [
        ['Northside duplex', '88 Genesee Street, Unit A, Rochester, NY 14616', 5, 'Rent always on time; would rent again.'],
        ['Canal loft', '12 Canal Park, Floor 4, Buffalo, NY 14202', 4, 'Minor wear at move-out, within expectations.'],
        ['Parkside studio', '400 Broadway, Studio 7, Rochester, NY 14611', 5, 'Quiet neighbor; left the place spotless.'],
        ['East ave flat', '1500 East Avenue, Apt 2, Rochester, NY 14610', 3, 'Several late rent notices; eventually caught up.'],
        ['Summit townhome', '8 Summit Circle, Townhome C, Pittsford, NY 14534', 5, null],
        ['Lake ave rental', '920 Lake Avenue, Lower, Rochester, NY 14613', 4, 'Good tenant overall; responsive to inspections.'],
      ]
      const [property_name, property_address, rating, comment] = labels[i] ?? labels[0]
      const month = String(12 - Math.min(i, 5)).padStart(2, '0')
      return {
        tenantId: t.id,
        tenant_name: t.display_name,
        property_name,
        property_address,
        rating,
        comment,
        created_at: `2025-${month}-${String(15 - i).padStart(2, '0')}T14:00:00.000Z`,
      }
    }),
  ].filter((r) => r.tenantId)

  for (const row of mainLandlordRatingSeeds) {
    const { error: trErr } = await supabase.from('tenant_ratings').upsert(
      {
        landlord_id: landlordId,
        tenant_id: row.tenantId,
        tenant_external_id: row.tenantId,
        tenant_name: row.tenant_name,
        property_name: row.property_name,
        property_address: row.property_address,
        rating: row.rating,
        comment: row.comment,
        created_at: row.created_at,
      },
      { onConflict: 'landlord_id,tenant_external_id' },
    )
    if (trErr) {
      console.warn('tenant_ratings seed (main landlord):', row.tenant_name, trErr.message)
    }
  }
  if (mainLandlordRatingSeeds.length) {
    console.log('Seeded', mainLandlordRatingSeeds.length, 'reviews from landlord@test.rentalcity.com')
  }

  // Support requests + reports (admin /admin/issues demo — idempotent via [Demo] markers).
  // Reports use only landlord ↔ main tenant pairs that have a message thread (matches RLS).
  const demoSupportMarker = '[Demo] Billing question'
  const { data: demoSupportExisting } = await supabase
    .from('support_requests')
    .select('id')
    .eq('subject', demoSupportMarker)
    .limit(1)
  if (!demoSupportExisting?.length) {
    const supportRows = [
      {
        user_id: tenantId,
        subject: demoSupportMarker,
        message:
          'I was charged twice for the application fee on Feb 1. Can you help refund the duplicate? Transaction IDs available on request.',
        status: 'open',
      },
      {
        user_id: landlordId,
        subject: '[Demo] Background check timing',
        message:
          'How long should I expect a standard background check to complete for an applicant? One has been pending for 5 business days.',
        status: 'in_progress',
      },
      {
        user_id: tenantId,
        subject: '[Demo] Mobile: blank applications screen',
        message:
          'After logging in on iOS Safari I only see a blank screen on /applications. Desktop Chrome works fine.',
        status: 'resolved',
      },
      {
        user_id: landlordId,
        subject: '[Demo] Listing photos out of order',
        message: 'I reordered photos in the editor but the public listing still shows the old order after saving.',
        status: 'closed',
      },
    ]
    const { error: supErr } = await supabase.from('support_requests').insert(supportRows)
    if (supErr) {
      console.warn('support_requests demo seed:', supErr.message)
    } else {
      console.log('Inserted', supportRows.length, 'demo support requests (admin Issues)')
    }
  } else {
    console.log('Demo support requests already present')
  }

  const demoReportMarker = '[Demo] Noise complaints'
  const { data: demoReportExisting } = await supabase
    .from('reports')
    .select('id')
    .eq('reason', demoReportMarker)
    .limit(1)
  if (!demoReportExisting?.length) {
    const reportRows = [
      {
        reporter_id: landlordId,
        reported_user_id: tenantId,
        reason: demoReportMarker,
        details:
          'Multiple neighbors contacted me about loud music past quiet hours (11pm–7am) on weekends. Documented dates: Mar 1, Mar 8.',
        status: 'pending',
      },
      {
        reporter_id: tenantId,
        reported_user_id: landlordId,
        reason: '[Demo] Unprofessional messages',
        details:
          'Repeated contact outside agreed hours after I asked to keep messages to business hours only.',
        status: 'reviewed',
      },
      {
        reporter_id: landlordId,
        reported_user_id: tenantId,
        reason: '[Demo] Property damage at move-out',
        details:
          'Beyond normal wear: large carpet stains in bedroom, hole in drywall behind door. Photos attached to property file.',
        status: 'pending',
      },
      {
        reporter_id: landlordId,
        reported_user_id: tenantId,
        reason: '[Demo] Resolved: payment dispute',
        details: 'Tenant disputed last month rent; we agreed on a partial credit after walkthrough. No further action needed.',
        status: 'resolved',
      },
    ]
    const { error: repErr } = await supabase.from('reports').insert(reportRows)
    if (repErr) {
      console.warn('reports demo seed:', repErr.message)
    } else {
      console.log('Inserted', reportRows.length, 'demo user reports (admin Issues)')
    }
  } else {
    console.log('Demo reports already present')
  }

  // Admin portal (dev only): auth user + profiles.role = admin
  const ADMIN_EMAIL = 'admin@test.rentalcity.com'
  let adminId
  const adminListRes = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const adminExisting = adminListRes.data?.users?.find((u) => u.email === ADMIN_EMAIL)
  if (adminExisting) {
    adminId = adminExisting.id
    console.log('Admin user exists:', ADMIN_EMAIL)
  } else {
    const { data: ad, error: ae } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (ae) {
      console.warn('Could not create admin user:', ae.message)
    } else if (ad?.user) {
      adminId = ad.user.id
      console.log('Created admin:', ADMIN_EMAIL)
    }
  }
  if (adminId) {
    const { error: arErr } = await supabase
      .from('profiles')
      .update({ role: 'admin', display_name: 'System Admin' })
      .eq('id', adminId)
    if (arErr) console.warn('Admin profile role update:', arErr.message)
  }

  console.log('Seeding complete.')
  console.log('Match states seeded: Locked (pending), Unlocked (pending+unlocked_at), Accepted (approved), Declined (rejected).')
  console.log(
    'Test logins: landlord@test.rentalcity.com / tenant@test.rentalcity.com /',
    ADMIN_EMAIL,
    'with password:',
    TEST_PASSWORD,
  )
  console.log('Run npm run db:migrate first if you have not applied the application unlocked_at migration.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
