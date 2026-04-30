import type { SupabaseClient } from '@supabase/supabase-js'

export const SITE_SETTING_KEYS = [
  'support_contact_email',
  'support_response_time_line',
  'support_hours_line',
  'support_submit_success_message',
] as const

export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number]

export const SITE_SETTINGS_DEFAULTS: Record<SiteSettingKey, string> = {
  support_contact_email: 'support@rentalcity.com',
  support_response_time_line: 'We typically respond within 24 hours',
  support_hours_line: 'Monday - Friday, 9 AM - 6 PM EST',
  support_submit_success_message:
    'Support request submitted. Our team will follow up within 24 hours.',
}

/** Kept in sync with migration seed descriptions (used on admin upsert). */
export const SITE_SETTINGS_ROW_META: Record<SiteSettingKey, { description: string }> = {
  support_contact_email: {
    description: 'Mailto target for “Contact support” and similar links.',
  },
  support_response_time_line: {
    description: 'Main line under “Response Time” on support pages.',
  },
  support_hours_line: {
    description: 'Secondary line under response time on support pages.',
  },
  support_submit_success_message: {
    description: 'Toast-style confirmation after submitting the support form.',
  },
}

const MAX_VALUE_LEN = 500

export function validateSiteSettingValue(key: SiteSettingKey, value: string): string | null {
  const t = value.trim()
  if (!t) return 'This field is required.'
  if (t.length > MAX_VALUE_LEN) return `Keep this under ${MAX_VALUE_LEN} characters.`
  if (key === 'support_contact_email') return validateSupportContactEmail(value)
  return null
}

export function mergeSiteSettingsFromRows(
  rows: { key: string; value: string | null }[] | null | undefined,
): Record<SiteSettingKey, string> {
  const out: Record<SiteSettingKey, string> = { ...SITE_SETTINGS_DEFAULTS }
  for (const row of rows ?? []) {
    const k = row.key as SiteSettingKey
    if (k in out && typeof row.value === 'string' && row.value.trim() !== '') {
      out[k] = row.value.trim()
    }
  }
  return out
}

/** Falls back to defaults if the table is missing or the query fails (e.g. before migration). */
export async function fetchSiteSettingsMerged(
  supabase: SupabaseClient,
): Promise<Record<SiteSettingKey, string>> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', [...SITE_SETTING_KEYS])

  if (error) {
    console.warn('[site_settings]', error.message)
    return { ...SITE_SETTINGS_DEFAULTS }
  }
  return mergeSiteSettingsFromRows(data)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSupportContactEmail(email: string): string | null {
  const t = email.trim()
  if (!t) return 'Support email is required.'
  if (!EMAIL_RE.test(t)) return 'Enter a valid email address.'
  return null
}

export function buildSiteSettingsUpsertRows(
  values: Record<SiteSettingKey, string>,
): { key: string; value: string; description: string }[] {
  return SITE_SETTING_KEYS.map((key) => ({
    key,
    value: values[key].trim(),
    description: SITE_SETTINGS_ROW_META[key].description,
  }))
}
