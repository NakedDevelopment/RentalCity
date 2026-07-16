import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'

const AVATAR_BUCKET = 'avatars'

export function ProfileCreationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [propertyCount, setPropertyCount] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadProfile() {
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      setFullName(data?.display_name?.trim() || '')
      setAvatarUrl(data?.avatar_url?.trim() || null)
    }

    loadProfile()
  }, [user])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setPhotoError('Please select a JPG, PNG, or GIF image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be under 5MB.')
      return
    }

    setUploadingPhoto(true)
    setPhotoError(null)

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setPhotoError(uploadError.message)
      setUploadingPhoto(false)
      e.target.value = ''
      return
    }

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    const url = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id)

    setUploadingPhoto(false)
    e.target.value = ''

    if (updateError) {
      setPhotoError(updateError.message)
      return
    }

    setAvatarUrl(url)
  }

  async function handleNext() {
    if (!user) return
    setLoading(true)
    await supabase
      .from('profiles')
      .update({
        display_name: fullName.trim() || null,
        ...(profileRole === 'landlord'
          ? {
              business_name: businessName.trim() || null,
              landlord_property_count_range: propertyCount || null,
              landlord_experience_level: experienceLevel || null,
            }
          : {}),
      })
      .eq('id', user.id)
    setLoading(false)
    navigate(profileRole === 'landlord' ? '/onboarding/survey/intro' : '/')
  }

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (profileRole === 'landlord') {
    const steps = [
      { number: 1, label: 'Account Created', complete: true, active: false },
      { number: 2, label: 'Profile Setup', complete: false, active: true },
      { number: 3, label: 'Landlord Survey', complete: false, active: false },
      { number: 4, label: 'Add Property', complete: false, active: false },
    ]

    return (
      <div className="min-h-full">
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5">
            {steps.map((step, index) => (
              <div key={step.label} className="flex min-w-0 flex-1 items-center">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                      step.complete || step.active
                        ? 'gradient-primary text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step.complete ? (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </span>
                  <span className={`text-sm ${step.active || step.complete ? 'text-gray-900' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 ? <div className="mx-4 h-px flex-1 bg-gray-200" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-12">
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-7 shadow-sm">
              <div className="mb-5 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              <h1 className="text-center text-[2rem] font-medium text-gray-900">Welcome – Set Up Your Profile</h1>
              <p className="mt-2 text-center text-sm leading-6 text-gray-600">
                Let&apos;s get to know you before you list your properties.
              </p>

              <div className="mt-7 space-y-4">
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">Profile Photo</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => avatarUrl && setPhotoPreviewOpen(true)}
                      className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400 ${avatarUrl ? 'cursor-pointer ring-2 ring-transparent hover:ring-gray-300' : ''}`}
                      aria-label={avatarUrl ? 'View full size' : undefined}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </button>
                    <div>
                      <button
                        type="button"
                        disabled={uploadingPhoto}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                        {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
                      </button>
                      <p className="mt-1 text-xs text-gray-400">JPG, PNG or GIF (max 5MB)</p>
                      {photoError ? <p className="mt-1 text-xs text-red-600">{photoError}</p> : null}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      id="full-name"
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter your full name"
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                    />
                    <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>

                <div>
                  <label htmlFor="business-name" className="mb-2 block text-sm font-medium text-gray-700">
                    Business Name <span className="text-gray-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="business-name"
                      type="text"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      placeholder="Enter your business name"
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                    />
                    <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 13h.01M9 17h.01M15 13h.01M15 17h.01" />
                    </svg>
                  </div>
                </div>

                <div>
                  <label htmlFor="property-count" className="mb-2 block text-sm font-medium text-gray-700">
                    How many properties do you manage?
                  </label>
                  <div className="relative">
                    <select
                      id="property-count"
                      value={propertyCount}
                      onChange={(event) => setPropertyCount(event.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                    >
                      <option value="">Select number of properties</option>
                      <option value="1">1 property</option>
                      <option value="2-5">2-5 properties</option>
                      <option value="6-10">6-10 properties</option>
                      <option value="10+">10+ properties</option>
                    </select>
                    <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <div>
                  <label htmlFor="experience-level" className="mb-2 block text-sm font-medium text-gray-700">
                    How long have you been a landlord?
                  </label>
                  <div className="relative">
                    <select
                      id="experience-level"
                      value={experienceLevel}
                      onChange={(event) => setExperienceLevel(event.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                    >
                      <option value="">Select your experience level</option>
                      <option value="new">Less than 1 year</option>
                      <option value="1-3">1-3 years</option>
                      <option value="4-7">4-7 years</option>
                      <option value="8+">8+ years</option>
                    </select>
                    <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="w-full rounded-lg btn-primary py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-sm leading-7 text-gray-500">
              This information helps us customize your experience and provide better tenant matches for your properties.
            </p>
          </div>
        </div>

        {photoPreviewOpen && avatarUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPhotoPreviewOpen(false)}
          >
            <button
              type="button"
              onClick={() => setPhotoPreviewOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-600 hover:bg-white"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={avatarUrl}
              alt="Profile photo"
              className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link to="/lease-preferences" className="mb-8 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="mb-8 text-center text-[2rem] font-medium text-gray-900">About You</h2>

        <div className="mb-8 space-y-5">
          <div>
            <label htmlFor="tenant-full-name" className="mb-2 block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              id="tenant-full-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={loading}
          className="w-full rounded-lg btn-primary py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
