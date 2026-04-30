import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  SITE_SETTINGS_DEFAULTS,
  SITE_SETTING_KEYS,
  type SiteSettingKey,
  buildSiteSettingsUpsertRows,
  mergeSiteSettingsFromRows,
  validateSiteSettingValue,
} from '../../lib/siteSettings'
import { AdminPageHeader, admin } from './adminUi'

const fieldLabels: Record<SiteSettingKey, { label: string; hint: string; multiline?: boolean }> = {
  support_contact_email: {
    label: 'Support contact email',
    hint: 'Used for mailto links (verify email, help).',
  },
  support_response_time_line: {
    label: 'Response time (primary line)',
    hint: 'Shown under “Response Time” on support pages.',
  },
  support_hours_line: {
    label: 'Support hours (secondary line)',
    hint: 'e.g. business hours or timezone.',
  },
  support_submit_success_message: {
    label: 'Support form success message',
    hint: 'Shown after a signed-in user submits a support ticket.',
    multiline: true,
  },
}

export function AdminSettingsPage() {
  const [form, setForm] = useState<Record<SiteSettingKey, string>>({ ...SITE_SETTINGS_DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SiteSettingKey, string>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setSaveOk(false)
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [...SITE_SETTING_KEYS])

    setLoading(false)
    if (error) {
      setLoadError(error.message)
      setForm({ ...SITE_SETTINGS_DEFAULTS })
      return
    }
    setForm(mergeSiteSettingsFromRows(data))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function setField(key: SiteSettingKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setSaveOk(false)
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setSaveError(null)
    setSaveOk(false)

    const nextErrors: Partial<Record<SiteSettingKey, string>> = {}
    for (const key of SITE_SETTING_KEYS) {
      const msg = validateSiteSettingValue(key, form[key])
      if (msg) nextErrors[key] = msg
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    const { error } = await supabase
      .from('site_settings')
      .upsert(buildSiteSettingsUpsertRows(form), { onConflict: 'key' })
    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }
    setSaveOk(true)
    void load()
  }

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Sitewide, non-secret copy and support contact strings. Secrets and integrations stay in Supabase dashboard and server env."
      />

      <section className={`${admin.contentTop} ${admin.panelPaddedLg}`}>
        <h2 className="text-lg font-semibold text-gray-900">Sitewide configuration</h2>
        <p className={`${admin.muted} mt-2 max-w-2xl`}>
          These values appear on support surfaces and the verify-email help link. Anyone can read them; only admins can
          change them.
        </p>

        {loadError ? (
          <p className={`${admin.error} mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2`}>
            Could not load settings: {loadError}. If this is a new environment, apply{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">supabase/migrations/20260403100000_site_settings.sql</code>{' '}
            (see <code className="rounded bg-white px-1 py-0.5 text-xs">npm run db:apply-sql</code>).
          </p>
        ) : null}

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          {SITE_SETTING_KEYS.map((key) => {
            const meta = fieldLabels[key]
            const inputClass =
              'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50 disabled:text-gray-500'
            return (
              <div key={key}>
                <label htmlFor={`site-setting-${key}`} className={admin.fieldLabel}>
                  {meta.label}
                </label>
                <p className="mt-0.5 text-xs text-gray-500">{meta.hint}</p>
                {meta.multiline ? (
                  <textarea
                    id={`site-setting-${key}`}
                    rows={3}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    disabled={loading || !!loadError}
                    className={inputClass}
                  />
                ) : (
                  <input
                    id={`site-setting-${key}`}
                    type={key === 'support_contact_email' ? 'email' : 'text'}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    disabled={loading || !!loadError}
                    className={inputClass}
                  />
                )}
                {fieldErrors[key] ? <p className="mt-1 text-xs text-red-600">{fieldErrors[key]}</p> : null}
              </div>
            )
          })}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" disabled={loading || !!loadError || saving} className={admin.btnPrimary}>
              {saving ? 'Saving…' : 'Save sitewide settings'}
            </button>
            {saveOk ? <span className="text-sm text-emerald-700">Saved.</span> : null}
          </div>
          {saveError ? <p className={admin.error}>{saveError}</p> : null}
        </form>
      </section>
    </div>
  )
}
