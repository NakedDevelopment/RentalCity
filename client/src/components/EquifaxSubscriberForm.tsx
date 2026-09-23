import { useState } from 'react'
import type { EquifaxAgreementInput, EquifaxSubscriberDetails } from '../lib/docusignApi'

export function formatBusinessPhone(value: string): string {
  const raw = value.replace(/\D/g, '')
  const digits = (raw.length === 11 && raw.startsWith('1') ? raw.slice(1) : raw).slice(0, 10)
  if (!digits) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function initialAddress(address: string): EquifaxAgreementInput['address'] {
  // The stored agreement address is one line; accept both "NY 10280" and
  // "NY, 10280" when prefilling the new separate fields.
  const match = address.match(/^(.*),\s*([^,]+),\s*([A-Za-z]{2}),?\s+(\d{5}(?:-\d{4})?)$/)
  return {
    street: match?.[1] ?? address,
    unit: '',
    city: match?.[2] ?? '',
    state: match?.[3]?.toUpperCase() ?? '',
    zip: match?.[4] ?? '',
  }
}

export function EquifaxSubscriberForm({
  initial,
  submitting,
  onSubmit,
  onBack,
}: {
  initial: EquifaxSubscriberDetails
  submitting: boolean
  onSubmit: (details: EquifaxAgreementInput) => void
  onBack: () => void
}) {
  const [details, setDetails] = useState<EquifaxAgreementInput>(() => ({
    businessName: initial.businessName,
    phone: formatBusinessPhone(initial.phone),
    address: initialAddress(initial.address),
  }))
  const updateAddress = (field: keyof EquifaxAgreementInput['address'], value: string) => {
    setDetails((current) => ({ ...current, address: { ...current.address, [field]: value } }))
  }
  const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900'
  const { street, unit, city, state, zip } = details.address
  const addressTooLong = `${street}${unit ? `, ${unit}` : ''}, ${city}, ${state} ${zip}`.length > 85

  return (
    <form
      className="space-y-3 rounded-lg border border-gray-200 p-4"
      onSubmit={(event) => { event.preventDefault(); onSubmit(details) }}
    >
      <h3 className="text-sm font-semibold text-gray-900">Updated Equifax agreement — subscriber details</h3>
      <p className="text-xs text-gray-600">
        Confirm the business information that will appear on your agreement. Only use a rental property address if it is also your business mailing address.
      </p>
      <label className="block text-sm font-medium text-gray-700">
        Business / subscriber name
        <input required value={details.businessName} maxLength={60} autoComplete="organization"
          onChange={(event) => setDetails((current) => ({ ...current, businessName: event.target.value }))}
          className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Business phone
        <input required type="tel" inputMode="tel" autoComplete="tel-national"
          placeholder="(555) 555-5555" minLength={14} maxLength={25}
          title="Enter a 10-digit phone number"
          value={details.phone}
          onChange={(event) => setDetails((current) => ({ ...current, phone: formatBusinessPhone(event.target.value) }))}
          className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-gray-500">Type 10 digits; formatting is added automatically.</span>
      </label>
      <div className="border-t border-gray-100 pt-3">
        <p className="text-sm font-medium text-gray-700">Business mailing address</p>
        <div className="mt-2 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Street address
            <input required autoComplete="address-line1" maxLength={60} value={details.address.street}
              onChange={(event) => updateAddress('street', event.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Apartment / suite (optional)
            <input autoComplete="address-line2" maxLength={25} value={details.address.unit}
              onChange={(event) => updateAddress('unit', event.target.value)} className={inputClass} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5rem_7rem]">
            <label className="block text-sm font-medium text-gray-700">
              City
              <input required autoComplete="address-level2" maxLength={45} value={details.address.city}
                onChange={(event) => updateAddress('city', event.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              State
              <input required autoComplete="address-level1" maxLength={2} pattern="[A-Za-z]{2}"
                title="Use the 2-letter state abbreviation" value={details.address.state}
                onChange={(event) => updateAddress('state', event.target.value.toUpperCase())} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              ZIP code
              <input required autoComplete="postal-code" inputMode="numeric" maxLength={10}
                pattern="[0-9]{5}(-[0-9]{4})?" title="Enter a 5-digit ZIP code (or ZIP+4)"
                value={details.address.zip}
                onChange={(event) => updateAddress('zip', event.target.value)} className={inputClass} />
            </label>
          </div>
          {addressTooLong && <p role="alert" className="text-xs text-red-600">This address is too long to fit on the agreement. Please shorten it to 85 characters.</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={submitting || addressTooLong} className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {submitting ? 'Opening…' : 'Continue to sign'}
        </button>
        <button type="button" onClick={onBack} className="text-sm text-gray-600 underline">Back</button>
      </div>
    </form>
  )
}